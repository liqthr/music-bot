import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { tmpdir } from 'os'

// Cache configuration - can be overridden via environment variables
const CACHE_MAX_AGE_MS = parseInt(process.env.AUDIO_CACHE_MAX_AGE_MS || '604800000', 10) // Default: 7 days
const CACHE_MAX_SIZE_BYTES = parseInt(process.env.AUDIO_CACHE_MAX_SIZE_BYTES || '10737418240', 10) // Default: 10GB
const DOWNLOAD_TIMEOUT_MS = parseInt(process.env.AUDIO_DOWNLOAD_TIMEOUT_MS || '60000', 10) // Default: 60 seconds
const LOG_BUFFER_SIZE = 1024 * 10 // Keep last 10KB of logs

// YouTube video ID pattern: exactly 11 alphanumeric characters, hyphens, or underscores
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

// Cache cleanup lock file path
const CACHE_CLEANUP_LOCK_FILE = path.join(tmpdir(), 'music-bot-cache-cleanup.lock')
const CACHE_CLEANUP_LOCK_TTL_MS = 300000 // 5 minutes - lock expires after this time

/**
 * Serve a YouTube video's audio as FLAC or MP3, using a local cache when available.
 *
 * Accepts `videoId` (required, a valid 11-character YouTube ID) and `format` (`flac` or `mp3`, default `flac`)
 * as query parameters. If a cached file exists the handler updates its access time and returns it with
 * appropriate `Content-Type`, `Content-Disposition`, and long-lived `Cache-Control` headers. On cache miss
 * the handler downloads and converts the audio using system tools and then returns the resulting file.
 *
 * Installation requirements (server): yt-dlp and ffmpeg must be available on PATH.
 *
 * @returns A NextResponse containing the audio bytes and headers on success, or a JSON error object with HTTP 400/500 on failure.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const videoId = searchParams.get('videoId')
  const format = searchParams.get('format') || 'flac' // 'flac' or 'mp3'

  if (!videoId) {
    return NextResponse.json(
      { error: 'videoId parameter is required' },
      { status: 400 }
    )
  }

  // Validate videoId against YouTube ID pattern to prevent injection/path traversal
  if (!YOUTUBE_ID_PATTERN.test(videoId)) {
    return NextResponse.json(
      { error: 'Invalid videoId format. Must be a valid YouTube video ID (11 characters: A-Za-z0-9_-)' },
      { status: 400 }
    )
  }

  if (!['flac', 'mp3'].includes(format)) {
    return NextResponse.json(
      { error: 'format must be "flac" or "mp3"' },
      { status: 400 }
    )
  }

  try {
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`
    
    // Use system temp directory
    const tempDir = path.join(tmpdir(), 'music-bot-audio')
    
    // Ensure temp directory exists (async)
    await fs.mkdir(tempDir, { recursive: true })
    
    // Attempt cache cleanup with distributed lock (non-blocking)
    attemptCacheCleanup(tempDir).catch(err => {
      console.error('Cache cleanup attempt error:', err)
    })
    
    const outputFile = path.join(tempDir, `${videoId}.${format}`)

    // Check if file already exists (cache) - async
    try {
      const stats = await fs.stat(outputFile)
      // Update access time to track usage
      await fs.utimes(outputFile, new Date(), stats.mtime)
      
      // Read file asynchronously
      const fileBuffer = await fs.readFile(outputFile)
      const headers = new Headers()
      headers.set('Content-Type', format === 'flac' ? 'audio/flac' : 'audio/mpeg')
      headers.set('Content-Disposition', `inline; filename="${videoId}.${format}"`)
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      
      return new NextResponse(fileBuffer, { headers })
    } catch (error: any) {
      // File doesn't exist, continue to download
      if (error.code !== 'ENOENT') {
        throw error
      }
    }

    // Download audio using yt-dlp
    await downloadAudioFromYouTube(youtubeUrl, outputFile, format, DOWNLOAD_TIMEOUT_MS)

    // Read and return the file (async)
    const fileBuffer = await fs.readFile(outputFile)
    const headers = new Headers()
    headers.set('Content-Type', format === 'flac' ? 'audio/flac' : 'audio/mpeg')
    headers.set('Content-Disposition', `inline; filename="${videoId}.${format}"`)
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')

    return new NextResponse(fileBuffer, { headers })
  } catch (error: any) {
    console.error('Audio download error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to download audio', 
        message: error.message,
        hint: 'Make sure yt-dlp and ffmpeg are installed on the server'
      },
      { status: 500 }
    )
  }
}

/**
 * Acquire a filesystem lock and run cache cleanup for the given temp directory, skipping cleanup if a valid lock exists.
 *
 * Attempts to create a distributed lock file to prevent concurrent cleanups. If a valid lock is already held by another process, the function exits without running cleanup. When the lock is acquired, invokes the cache cleanup routine and ensures the lock file is removed afterwards. Any errors during the lock workflow are logged and do not propagate.
 *
 * @param tempDir - Path to the temporary cache directory to be cleaned
 */
async function attemptCacheCleanup(tempDir: string): Promise<void> {
  try {
    // Try to acquire lock
    let lockAcquired = false
    try {
      // Stat the lock file to check if it exists and compute age
      const lockStats = await fs.stat(CACHE_CLEANUP_LOCK_FILE)
      const lockAge = Date.now() - lockStats.mtime.getTime()
      if (lockAge < CACHE_CLEANUP_LOCK_TTL_MS) {
        // Lock is still valid, another cleanup is running
        return
      }
      // Lock expired, immediately attempt to unlink and swallow any error
      // (another process may have removed it already)
      await fs.unlink(CACHE_CLEANUP_LOCK_FILE).catch(() => {})
    } catch {
      // Lock doesn't exist (stat failed), we can proceed
    }

    // Create lock file
    try {
      await fs.writeFile(CACHE_CLEANUP_LOCK_FILE, Date.now().toString(), { flag: 'wx' })
      lockAcquired = true
    } catch {
      // Failed to acquire lock, another process got it first
      return
    }

    try {
      await cleanupCache(tempDir)
    } finally {
      // Always release lock
      if (lockAcquired) {
        await fs.unlink(CACHE_CLEANUP_LOCK_FILE).catch(() => {})
      }
    }
  } catch (error) {
    console.error('Cache cleanup lock error:', error)
  }
}

/**
 * Remove expired or least-recently-used files from the cache directory to enforce age and size limits.
 *
 * Deletes files whose access time is older than CACHE_MAX_AGE_MS. If the cache still exceeds
 * CACHE_MAX_SIZE_BYTES, deletes files in order of oldest access time (falling back to modification time)
 * until the total size is under the limit. Logs removed files and any deletion or cleanup errors.
 *
 * @param tempDir - Path to the cache directory to clean
 */
async function cleanupCache(tempDir: string): Promise<void> {
  try {
    const files = await fs.readdir(tempDir)
    const fileStats = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(tempDir, file)
        try {
          const stats = await fs.stat(filePath)
          return { path: filePath, stats, name: file }
        } catch {
          return null
        }
      })
    )

    const validFiles = fileStats.filter((f): f is NonNullable<typeof f> => f !== null)
    const now = Date.now()

    // Remove files older than max age based on access time
    const filesToDelete: string[] = []
    for (const file of validFiles) {
      // Use atime for LRU, fallback to mtime if atime is missing or invalid
      const atimeMs = file.stats.atime?.getTime()
      const accessTime = (atimeMs && !isNaN(atimeMs)) ? atimeMs : file.stats.mtime.getTime()
      const age = now - accessTime
      if (age > CACHE_MAX_AGE_MS) {
        filesToDelete.push(file.path)
      }
    }

    // If still over size limit, delete oldest files first (by access time)
    if (filesToDelete.length < validFiles.length) {
      const remainingFiles = validFiles.filter(f => !filesToDelete.includes(f.path))
      let totalSize = remainingFiles.reduce((sum, f) => sum + f.stats.size, 0)

      if (totalSize > CACHE_MAX_SIZE_BYTES) {
        // Sort by access time (oldest access first) for LRU behavior
        remainingFiles.sort((a, b) => {
          const aTimeMs = a.stats.atime?.getTime()
          const bTimeMs = b.stats.atime?.getTime()
          const aTime = (aTimeMs && !isNaN(aTimeMs)) ? aTimeMs : a.stats.mtime.getTime()
          const bTime = (bTimeMs && !isNaN(bTimeMs)) ? bTimeMs : b.stats.mtime.getTime()
          return aTime - bTime
        })
        
        for (const file of remainingFiles) {
          if (totalSize <= CACHE_MAX_SIZE_BYTES) break
          filesToDelete.push(file.path)
          totalSize -= file.stats.size
        }
      }
    }

    // Delete files
    await Promise.all(
      filesToDelete.map(filePath =>
        fs.unlink(filePath).catch(err => {
          console.error(`Failed to delete cache file ${filePath}:`, err)
        })
      )
    )

    if (filesToDelete.length > 0) {
      console.log(`Cache cleanup: removed ${filesToDelete.length} file(s)`)
    }
  } catch (error) {
    console.error('Cache cleanup error:', error)
  }
}

/**
 * Download and extract audio from a YouTube URL into the specified file in FLAC or MP3 format.
 *
 * @param url - The YouTube video URL to download audio from.
 * @param outputPath - Destination file path (should end with `.flac` or `.mp3`); the produced file will be created or renamed to this path.
 * @param format - Desired audio format: `'flac'` or `'mp3'`.
 * @param timeoutMs - Maximum time in milliseconds to allow the external downloader to run before aborting.
 * @returns Resolves when the audio file is successfully produced at `outputPath`; rejects on timeout, if neither downloader is available, or on download/conversion failure.
 */
function downloadAudioFromYouTube(
  url: string,
  outputPath: string,
  format: 'flac' | 'mp3',
  timeoutMs: number = 60000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      '--extract-audio',
      '--audio-format', format === 'flac' ? 'flac' : 'mp3',
      '--audio-quality', format === 'flac' ? '0' : '192', // FLAC lossless, MP3 192kbps
      '--output', outputPath.replace(`.${format}`, '.%(ext)s'),
      '--no-playlist',
      '--quiet',
      '--no-warnings',
    ]

    // Try yt-dlp first, fallback to youtube-dl
    const commands = ['yt-dlp', 'youtube-dl']
    let commandIndex = 0
    let timeoutId: NodeJS.Timeout | null = null
    let settled = false

    const clearDownloadTimeout = () => {
      if (timeoutId) {
        global.clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    const tryDownload = () => {
      const command = commands[commandIndex]
      const ytDlp = spawn(command, args)

      // Use circular buffer to limit memory usage
      let errorOutput = ''
      let stdOutput = ''

      const appendToBuffer = (buffer: string, data: string, maxSize: number): string => {
        const newBuffer = buffer + data
        if (newBuffer.length > maxSize) {
          // Keep only the last maxSize bytes
          return newBuffer.slice(-maxSize)
        }
        return newBuffer
      }

      ytDlp.stdout.on('data', (data) => {
        stdOutput = appendToBuffer(stdOutput, data.toString(), LOG_BUFFER_SIZE)
      })

      ytDlp.stderr.on('data', (data) => {
        errorOutput = appendToBuffer(errorOutput, data.toString(), LOG_BUFFER_SIZE)
      })

      // Set up timeout timer
      timeoutId = setTimeout(() => {
        if (settled) return
        settled = true
        clearDownloadTimeout()
        ytDlp.removeAllListeners()
        ytDlp.kill('SIGTERM')
        // Give it a moment to terminate gracefully, then force kill
        setTimeout(() => {
          if (!ytDlp.killed) {
            ytDlp.kill('SIGKILL')
          }
        }, 1000)
        reject(new Error(`Download timeout after ${timeoutMs}ms`))
      }, timeoutMs)

      ytDlp.on('close', (code) => {
        if (settled) return
        settled = true
        clearDownloadTimeout()
        ytDlp.removeAllListeners()
        if (code === 0) {
          // Rename file if needed (yt-dlp might add extension) - async
          fs.readdir(path.dirname(outputPath))
            .then(files => {
              const matchingFile = files.find(f => f.startsWith(path.basename(outputPath, `.${format}`)))
              if (matchingFile && matchingFile !== path.basename(outputPath)) {
                return fs.rename(
                  path.join(path.dirname(outputPath), matchingFile),
                  outputPath
                )
              }
            })
            .then(() => resolve())
            .catch(reject)
        } else {
          // Try next command
          commandIndex++
          if (commandIndex < commands.length) {
            // Reset settled flag and clear timeout for retry
            settled = false
            clearDownloadTimeout()
            tryDownload()
          } else {
            const errorMsg = errorOutput || stdOutput || 'Unknown error'
            // Only include last part of error message to avoid huge responses
            const truncatedError = errorMsg.length > 500 
              ? errorMsg.slice(-500) + '... (truncated)'
              : errorMsg
            reject(new Error(`${command} failed: ${truncatedError}`))
          }
        }
      })

      ytDlp.on('error', (error: any) => {
        if (settled) return
        settled = true
        clearDownloadTimeout()
        ytDlp.removeAllListeners()
        // Try next command if this one doesn't exist
        if (error.code === 'ENOENT') {
          commandIndex++
          if (commandIndex < commands.length) {
            // Reset settled flag and clear timeout for retry
            settled = false
            clearDownloadTimeout()
            tryDownload()
          } else {
            reject(new Error(`Neither yt-dlp nor youtube-dl found. Please install yt-dlp: https://github.com/yt-dlp/yt-dlp#installation`))
          }
        } else {
          reject(error)
        }
      })
    }

    tryDownload()
  })
}