import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { tmpdir } from 'os'

/**
 * Download audio from YouTube video and convert to FLAC or MP3
 * Uses yt-dlp to extract audio and ffmpeg to convert formats
 * 
 * Installation requirements:
 * - yt-dlp: https://github.com/yt-dlp/yt-dlp#installation
 * - ffmpeg: https://ffmpeg.org/download.html
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
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    
    const outputFile = path.join(tempDir, `${videoId}.${format}`)

    // Check if file already exists (cache)
    if (fs.existsSync(outputFile)) {
      const fileBuffer = fs.readFileSync(outputFile)
      const headers = new Headers()
      headers.set('Content-Type', format === 'flac' ? 'audio/flac' : 'audio/mpeg')
      headers.set('Content-Disposition', `inline; filename="${videoId}.${format}"`)
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      
      return new NextResponse(fileBuffer, { headers })
    }

    // Download audio using yt-dlp
    await downloadAudioFromYouTube(youtubeUrl, outputFile, format)

    // Read and return the file
    const fileBuffer = fs.readFileSync(outputFile)
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
 * Download audio from YouTube using yt-dlp and convert to desired format
 */
function downloadAudioFromYouTube(
  url: string,
  outputPath: string,
  format: 'flac' | 'mp3'
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

    const tryDownload = () => {
      const command = commands[commandIndex]
      const ytDlp = spawn(command, args)

      let errorOutput = ''
      let stdOutput = ''

      ytDlp.stdout.on('data', (data) => {
        stdOutput += data.toString()
      })

      ytDlp.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })

      ytDlp.on('close', (code) => {
        if (code === 0) {
          // Rename file if needed (yt-dlp might add extension)
          const files = fs.readdirSync(path.dirname(outputPath))
          const matchingFile = files.find(f => f.startsWith(path.basename(outputPath, `.${format}`)))
          if (matchingFile && matchingFile !== path.basename(outputPath)) {
            fs.renameSync(
              path.join(path.dirname(outputPath), matchingFile),
              outputPath
            )
          }
          resolve()
        } else {
          // Try next command
          commandIndex++
          if (commandIndex < commands.length) {
            tryDownload()
          } else {
            reject(new Error(`${command} failed: ${errorOutput || stdOutput}`))
          }
        }
      })

      ytDlp.on('error', (error: any) => {
        // Try next command if this one doesn't exist
        if (error.code === 'ENOENT') {
          commandIndex++
          if (commandIndex < commands.length) {
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