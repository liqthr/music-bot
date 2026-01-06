import { NextRequest, NextResponse } from 'next/server'
import ytdl from '@distube/ytdl-core'
import { Readable } from 'stream'

// YouTube video ID pattern: exactly 11 alphanumeric characters, hyphens, or underscores
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

/**
 * Serve a YouTube video's audio as MP3 stream using ytdl-core.
 * 
 * This is a serverless-compatible implementation that doesn't rely on
 * system binaries (yt-dlp, ffmpeg) or filesystem caching.
 *
 * Accepts `videoId` (required, a valid 11-character YouTube ID) and `format`
 * (currently only 'mp3' is supported in serverless environment).
 *
 * @returns A streaming response with audio data or a JSON error object.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const videoId = searchParams.get('videoId')
  const format = searchParams.get('format') || 'mp3'

  if (!videoId) {
    return NextResponse.json(
      { error: 'videoId parameter is required' },
      { status: 400 }
    )
  }

  // Validate videoId against YouTube ID pattern to prevent injection
  if (!YOUTUBE_ID_PATTERN.test(videoId)) {
    return NextResponse.json(
      { error: 'Invalid videoId format. Must be a valid YouTube video ID (11 characters: A-Za-z0-9_-)' },
      { status: 400 }
    )
  }

  // Note: FLAC format requires ffmpeg which isn't available in serverless
  // We only support MP3 (audio-only streams) in this environment
  if (format === 'flac') {
    return NextResponse.json(
      { 
        error: 'FLAC format is not supported in serverless deployment',
        message: 'Please use format=mp3 instead. FLAC requires ffmpeg which is not available on Vercel.',
        hint: 'The application will automatically fall back to MP3 format.'
      },
      { status: 400 }
    )
  }

  try {
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`
    
    // Verify video exists and get info
    let info
    try {
      info = await ytdl.getInfo(youtubeUrl)
    } catch (error: any) {
      console.error('Failed to get video info:', error.message)
      return NextResponse.json(
        { 
          error: 'Failed to fetch video information',
          message: error.message,
          hint: 'The video may be unavailable, age-restricted, or region-locked.'
        },
        { status: 404 }
      )
    }

    // Get the best audio format available
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly')
    
    if (!audioFormats || audioFormats.length === 0) {
      return NextResponse.json(
        { error: 'No audio streams available for this video' },
        { status: 404 }
      )
    }

    // Choose the best audio quality
    const bestAudio = audioFormats.reduce((best, current) => {
      const bestBitrate = parseInt(best.audioBitrate as any) || 0
      const currentBitrate = parseInt(current.audioBitrate as any) || 0
      return currentBitrate > bestBitrate ? current : best
    })

    console.log(`Streaming audio for ${videoId} - Quality: ${bestAudio.audioBitrate || 'unknown'} kbps`)

    // Create audio stream
    const audioStream = ytdl(youtubeUrl, {
      quality: bestAudio.itag,
      filter: 'audioonly',
    })

    // Convert Node.js stream to Web Stream for Response
    const webStream = Readable.toWeb(audioStream) as ReadableStream

    // Set appropriate headers
    const headers = new Headers()
    
    // Determine content type from the format
    const mimeType = bestAudio.mimeType?.split(';')[0] || 'audio/mpeg'
    headers.set('Content-Type', mimeType)
    headers.set('Content-Disposition', `inline; filename="${videoId}.${format}"`)
    headers.set('Cache-Control', 'public, max-age=3600') // Cache for 1 hour
    headers.set('Accept-Ranges', 'bytes')
    
    // Add content length if available
    if (bestAudio.contentLength) {
      headers.set('Content-Length', bestAudio.contentLength)
    }

    return new Response(webStream, { 
      status: 200,
      headers 
    })

  } catch (error: any) {
    console.error('Audio download error:', error)
    
    // Handle specific ytdl-core errors
    if (error.message?.includes('Video unavailable')) {
      return NextResponse.json(
        { 
          error: 'Video is unavailable',
          message: 'This video cannot be accessed. It may be private, deleted, or region-restricted.'
        },
        { status: 404 }
      )
    }
    
    if (error.message?.includes('429')) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: 'Too many requests to YouTube. Please try again later.'
        },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to download audio', 
        message: error.message,
        hint: 'This is a serverless environment using ytdl-core. Some videos may not be accessible.'
      },
      { status: 500 }
    )
  }
}

// Export runtime config for Vercel
export const runtime = 'nodejs'
export const maxDuration = 60 // Maximum execution time in seconds (requires Pro plan for >10s)
