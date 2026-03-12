const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const { execFile } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration
const TEMP_DIR_BASE = path.resolve('./.temp_media');
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// In-memory store for session data and file mappings
const sessions = {}; // { sessionId: { lastActive: timestamp, files: { trackId: { filePath, extension } } } }

/**
 * Clean up inactive sessions
 */
function cleanupInactiveSessions() {
    const now = Date.now();
    for (const sessionId in sessions) {
        if (now - sessions[sessionId].lastActive > SESSION_TIMEOUT_MS) {
            console.log(`Session ${sessionId} timed out. Cleaning up...`);
            const sessionPath = path.join(TEMP_DIR_BASE, sessionId);
            fs.remove(sessionPath)
                .then(() => {
                    delete sessions[sessionId];
                    console.log(`Removed session directory: ${sessionPath}`);
                })
                .catch(err => console.error(`Error removing session dir ${sessionPath}:`, err));
        }
    }
}

/**
 * Setup and initialize the application
 */
async function initializeApp() {
    await fs.ensureDir(TEMP_DIR_BASE);
    console.log(`🎵 Music Backend Starting...`);
    console.log(`📁 Temporary media base directory: ${TEMP_DIR_BASE}`);
    console.log(`⏰ Session timeout: ${SESSION_TIMEOUT_MS / 1000 / 60} minutes`);

    // Start cleanup interval (check every 5 minutes)
    setInterval(cleanupInactiveSessions, 5 * 60 * 1000);

    // Handle process exit for immediate cleanup
    const cleanupAndExit = () => {
        console.log('🧹 Application exiting. Cleaning up all temporary media...');
        fs.removeSync(TEMP_DIR_BASE);
        process.exit(0);
    };

    process.on('exit', cleanupAndExit);
    process.on('SIGINT', () => {
        console.log('🛑 SIGINT received. Cleaning up and exiting...');
        cleanupAndExit();
    });
    process.on('SIGTERM', () => {
        console.log('🛑 SIGTERM received. Cleaning up and exiting...');
        cleanupAndExit();
    });

    // Start server
    app.listen(PORT, () => {
        console.log(`🚀 Music backend running on port ${PORT}`);
        console.log(`🌐 API endpoints:`);
        console.log(`   POST /session - Create new session`);
        console.log(`   POST /download/:sessionId - Download track`);
        console.log(`   GET  /stream/:sessionId/:trackId - Stream audio`);
        console.log(`   POST /session/heartbeat - Keep session alive`);
    });
}

// Middleware
app.use(cors({
    origin: '*', // Allow all origins for development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));

// Middleware to update session activity for relevant requests
app.use((req, res, next) => {
    const sessionId = req.body.sessionId || req.params.sessionId || req.query.sessionId;
    if (sessionId && sessions[sessionId]) {
        sessions[sessionId].lastActive = Date.now();
    }
    next();
});

/**
 * Routes
 */

// 1. Create a new session
app.post('/session', async (req, res) => {
    const sessionId = uuidv4();
    const sessionPath = path.join(TEMP_DIR_BASE, sessionId);
    
    try {
        await fs.ensureDir(sessionPath);
        sessions[sessionId] = {
            lastActive: Date.now(),
            files: {}, // { trackId: { filePath, extension } }
            directory: sessionPath,
            createdAt: new Date().toISOString()
        };
        console.log(`✅ Created session: ${sessionId} at ${sessionPath}`);
        res.json({ 
            sessionId: sessionId,
            message: 'Session created successfully',
            timeoutMinutes: SESSION_TIMEOUT_MS / 1000 / 60
        });
    } catch (err) {
        console.error(`❌ Failed to create session ${sessionId}:`, err);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// 2. Heartbeat to keep session alive
app.post('/session/heartbeat', (req, res) => {
    const { sessionId } = req.body;
    if (sessionId && sessions[sessionId]) {
        sessions[sessionId].lastActive = Date.now();
        res.json({ 
            success: true, 
            message: 'Session heartbeat received',
            lastActive: new Date(sessions[sessionId].lastActive).toISOString()
        });
    } else {
        res.status(400).json({ error: 'Invalid or expired session ID' });
    }
});

// 3. Download a song (called by frontend for play/queue)
app.post('/download/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { url, source, format = 'flac' } = req.body; // 'source' could be 'spotify', 'youtube', etc.

    if (!sessionId || !sessions[sessionId]) {
        return res.status(400).json({ error: 'Invalid or expired session ID' });
    }

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    const trackId = uuidv4(); // Unique ID for this download instance
    const sessionInfo = sessions[sessionId];
    
    try {
        console.log(`🎵 Starting download: ${source} -> ${url}`);
        
        // Download logic using yt-dlp (works for YouTube, Spotify with plugins)
        const outputFilePathTemplate = path.join(sessionInfo.directory, `${trackId}.%(ext)s`);
        
        const downloadPromise = new Promise((resolve, reject) => {
            const args = [
                '--extract-audio',
                '--audio-format', format,
                '--output', outputFilePathTemplate,
                '--no-playlist',
                '--embed-thumbnail',
                url
            ];

            // Add additional options for better quality
            if (source === 'youtube') {
                args.push('--audio-quality', '0'); // Best audio quality
            } else if (source === 'spotify') {
                args.push('--add-header', 'Cookie: session_token=your_session_token'); // May need auth
            }

            execFile('yt-dlp', args, {
                timeout: 300000, // 5 minutes timeout
                maxBuffer: 1024 * 1024 * 10 // 10MB buffer
            }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`❌ Download error for ${url}:`, error.message);
                    // Clean up partially downloaded file
                    fs.glob(path.join(sessionInfo.directory, `${trackId}.*`))
                        .then(files => files.forEach(f => fs.removeSync(f)))
                        .catch(console.error);
                    return reject({ message: 'Download failed', details: stderr });
                }

                console.log(`✅ Download completed: ${trackId}`);
                
                // Find the actual downloaded file
                fs.readdir(sessionInfo.directory)
                    .then(files => {
                        const downloadedFile = files.find(f => f.startsWith(trackId) && f.includes('.'));
                        if (downloadedFile) {
                            const actualFilePath = path.join(sessionInfo.directory, downloadedFile);
                            const extension = path.extname(downloadedFile).slice(1);
                            
                            // Store mapping
                            sessionInfo.files[trackId] = { 
                                filePath: actualFilePath, 
                                extension: extension || format 
                            };
                            
                            console.log(`📁 Mapped ${trackId} -> ${downloadedFile} (${extension})`);
                            resolve({ 
                                trackId: trackId, 
                                extension: extension || format,
                                fileName: downloadedFile 
                            });
                        } else {
                            console.error(`❌ Downloaded file not found for ${trackId}!`);
                            reject({ message: 'Download succeeded but file not found' });
                        }
                    })
                    .catch(reject);
            });
        });

        const downloadResult = await downloadPromise;
        res.json({ 
            success: true, 
            trackId: downloadResult.trackId, 
            extension: downloadResult.extension,
            fileName: downloadResult.fileName,
            streamUrl: `/stream/${sessionId}/${downloadResult.trackId}`,
            message: 'Download completed successfully'
        });

    } catch (error) {
        console.error(`❌ Download process failed for session ${sessionId}:`, error);
        res.status(500).json({ error: 'Download failed', details: error.message || error });
    }
});

// 4. Stream an audio file
app.get('/stream/:sessionId/:trackId', async (req, res) => {
    const { sessionId, trackId } = req.params;

    if (!sessionId || !sessions[sessionId]) {
        return res.status(404).json({ error: 'Session not found or expired' });
    }

    const sessionInfo = sessions[sessionId];
    const fileInfo = sessionInfo.files[trackId];

    if (!fileInfo || !fileInfo.filePath) {
        console.error(`❌ File info not found for track ${trackId} in session ${sessionId}`);
        return res.status(404).json({ error: 'Track not found in session' });
    }

    const filePath = fileInfo.filePath;
    const extension = fileInfo.extension || 'flac';

    // Update session activity upon streaming request
    sessionInfo.lastActive = Date.now();

    try {
        const stat = await fs.stat(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        // Set Content-Type based on extension
        let contentType = 'audio/flac'; // Default
        if (extension === 'mp3') contentType = 'audio/mpeg';
        else if (extension === 'ogg') contentType = 'audio/ogg';
        else if (extension === 'wav') contentType = 'audio/wav';
        else if (extension === 'm4a') contentType = 'audio/mp4';

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            if (start >= fileSize) {
                res.status(416).send('Requested range not satisfiable');
                return;
            }

            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(filePath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600'
            };
            res.writeHead(206, head); // 206 Partial Content
            file.pipe(res);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600',
                'Accept-Ranges': 'bytes'
            };
            res.writeHead(200, head); // 200 OK
            const file = fs.createReadStream(filePath);
            file.pipe(res);
        }
    } catch (error) {
        console.error(`❌ Error streaming file ${filePath}:`, error);
        res.status(500).json({ error: 'Streaming failed' });
    }
});

// 5. Get session info
app.get('/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    
    if (!sessionId || !sessions[sessionId]) {
        return res.status(404).json({ error: 'Session not found' });
    }

    const sessionInfo = sessions[sessionId];
    const files = Object.entries(sessionInfo.files).map(([trackId, fileInfo]) => ({
        trackId,
        fileName: path.basename(fileInfo.filePath),
        extension: fileInfo.extension,
        size: fs.statSync(fileInfo.filePath).size
    }));

    res.json({
        sessionId: sessionId,
        createdAt: sessionInfo.createdAt,
        lastActive: new Date(sessionInfo.lastActive).toISOString(),
        files: files,
        totalFiles: files.length
    });
});

// 6. Delete file from session
app.delete('/session/:sessionId/file/:trackId', async (req, res) => {
    const { sessionId, trackId } = req.params;
    
    if (!sessionId || !sessions[sessionId]) {
        return res.status(404).json({ error: 'Session not found' });
    }

    const sessionInfo = sessions[sessionId];
    const fileInfo = sessionInfo.files[trackId];

    if (!fileInfo) {
        return res.status(404).json({ error: 'File not found in session' });
    }

    try {
        await fs.remove(fileInfo.filePath);
        delete sessionInfo.files[trackId];
        console.log(`🗑️ Deleted file: ${trackId} from session ${sessionId}`);
        res.json({ success: true, message: 'File deleted successfully' });
    } catch (error) {
        console.error(`❌ Error deleting file:`, error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    const activeSessions = Object.keys(sessions).length;
    const totalFiles = Object.values(sessions).reduce((total, session) => 
        total + Object.keys(session.files).length, 0
    );
    
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        activeSessions,
        totalFiles,
        tempDir: TEMP_DIR_BASE
    });
});

// Initialize the application
initializeApp().catch(console.error);
