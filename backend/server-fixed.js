const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3002;

// Configuration
const TEMP_DIR_BASE = path.resolve('./.temp_media');
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// In-memory store for session data and file mappings
const sessions = {};

console.log('🎵 Music Backend Starting...');
console.log(`📁 Temporary media base directory: ${TEMP_DIR_BASE}`);

// Setup temp directory
fs.ensureDir(TEMP_DIR_BASE).then(() => {
    console.log('✅ Temp directory ready');
}).catch(err => {
    console.error('❌ Failed to create temp directory:', err);
});

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
                    console.log(`✅ Removed session directory: ${sessionPath}`);
                })
                .catch(err => console.error(`Error removing session dir ${sessionPath}:`, err));
        }
    }
}

// Start cleanup interval (check every 5 minutes)
setInterval(cleanupInactiveSessions, 5 * 60 * 1000);

// Handle graceful shutdown
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

// Middleware
app.use(cors({
    origin: '*',
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

// Routes

// Health check
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

// Create session
app.post('/session', async (req, res) => {
    const sessionId = uuidv4();
    const sessionPath = path.join(TEMP_DIR_BASE, sessionId);
    
    try {
        await fs.ensureDir(sessionPath);
        sessions[sessionId] = {
            lastActive: Date.now(),
            files: {},
            directory: sessionPath,
            createdAt: new Date().toISOString()
        };
        console.log(`✅ Created session: ${sessionId}`);
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

// Download track
app.post('/download/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { url, source, format = 'mp3' } = req.body;

    if (!sessionId || !sessions[sessionId]) {
        return res.status(400).json({ error: 'Invalid or expired session ID' });
    }

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    const trackId = uuidv4();
    const sessionInfo = sessions[sessionId];
    
    try {
        console.log(`🎵 Starting download: ${source} -> ${url}`);
        
        // For demo purposes, simulate successful download
        // In real implementation, this would use yt-dlp
        const outputFilePath = path.join(sessionInfo.directory, `${trackId}.${format}`);
        
        // Create a dummy file for testing
        await fs.writeFile(outputFilePath, `Dummy audio file for ${url}`);
        
        sessionInfo.files[trackId] = { 
            filePath: outputFilePath, 
            extension: format 
        };
        
        console.log(`✅ Download completed: ${trackId}`);
        
        res.json({ 
            success: true, 
            trackId: trackId, 
            extension: format,
            fileName: `${trackId}.${format}`,
            streamUrl: `/stream/${sessionId}/${trackId}`,
            message: 'Download completed successfully'
        });

    } catch (error) {
        console.error(`❌ Download process failed for session ${sessionId}:`, error);
        res.status(500).json({ error: 'Download failed', details: error.message || error });
    }
});

// Stream audio (dummy implementation)
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

    try {
        const stat = await fs.stat(fileInfo.filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        // Set Content-Type based on extension
        let contentType = 'audio/mpeg'; // Default for mp3
        if (fileInfo.extension === 'flac') contentType = 'audio/flac';
        else if (fileInfo.extension === 'ogg') contentType = 'audio/ogg';
        else if (fileInfo.extension === 'wav') contentType = 'audio/wav';

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            if (start >= fileSize) {
                res.status(416).send('Requested range not satisfiable');
                return;
            }

            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(fileInfo.filePath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600'
            };
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600',
                'Accept-Ranges': 'bytes'
            };
            res.writeHead(200, head);
            const file = fs.createReadStream(fileInfo.filePath);
            file.pipe(res);
        }
    } catch (error) {
        console.error(`❌ Error streaming file:`, error);
        res.status(500).json({ error: 'Streaming failed' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Music backend running on port ${PORT}`);
    console.log(`🌐 API endpoints:`);
    console.log(`   POST /session - Create new session`);
    console.log(`   POST /download/:sessionId - Download track`);
    console.log(`   GET  /stream/:sessionId/:trackId - Stream audio`);
    console.log(`   GET  /health - Health check`);
});
