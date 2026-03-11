import { spawn } from 'child_process'
import express from 'express'

const app = express()
const SECRET = process.env.CONVERTER_SECRET
if (!SECRET) throw new Error('CONVERTER_SECRET env var is required')

// Auth middleware
app.use((req, res, next) => {
  if (req.headers['x-converter-secret'] !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
})

/**
 * GET /convert?id=<youtube-video-id>&format=flac|mp3
 * Streams converted audio back to the caller.
 */
app.get('/convert', (req, res) => {
  const { id, format = 'flac' } = req.query

  if (!id || typeof id !== 'string' || !/^[\w-]{11}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid video ID' })
  }

  const mimeType = format === 'flac' ? 'audio/flac' : 'audio/mpeg'
  const ffmpegFormat = format === 'flac' ? 'flac' : 'mp3'

  res.setHeader('Content-Type', mimeType)
  res.setHeader('Transfer-Encoding', 'chunked')
  res.setHeader('Cache-Control', 'public, max-age=3600')

  const ytdlp = spawn('yt-dlp', [
    '--no-playlist', '-f', 'bestaudio', '-o', '-',
    `https://www.youtube.com/watch?v=${id}`,
  ])

  const ffmpeg = spawn('ffmpeg', [
    '-loglevel', 'error',
    '-i', 'pipe:0',
    '-vn',
    '-f', ffmpegFormat,
    ...(format === 'mp3' ? ['-ab', '320k'] : []),
    'pipe:1',
  ])

  ytdlp.stdout.pipe(ffmpeg.stdin)
  ffmpeg.stdout.pipe(res)

  const cleanup = (err) => {
    ytdlp.kill()
    ffmpeg.kill()
    if (err && !res.headersSent) res.status(500).json({ error: err.message })
    else if (!res.writableEnded) res.end()
  }

  ytdlp.on('error', cleanup)
  ffmpeg.on('error', cleanup)
  res.on('close', cleanup)
})

app.listen(3001, () => console.log('Converter running on :3001'))
