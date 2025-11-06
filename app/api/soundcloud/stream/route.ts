import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

/**
 * SoundCloud stream URL resolver
 * Resolves track URL to actual audio stream URL
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const trackUrl = searchParams.get('url')
  const format = searchParams.get('format') // 'json' to return JSON, otherwise redirect

  if (!trackUrl) {
    return NextResponse.json(
      { error: 'Track URL is required' },
      { status: 400 }
    )
  }

  const clientId = process.env.SOUNDCLOUD_CLIENT_ID

  if (!clientId) {
    return NextResponse.json(
      { error: 'Missing SoundCloud client ID' },
      { status: 500 }
    )
  }

  try {
    // Resolve track URL
    const resolveResponse = await axios({
      method: 'GET',
      url: 'https://api-v2.soundcloud.com/resolve',
      params: {
        url: trackUrl,
        client_id: clientId,
      },
      timeout: 8000,
    })

    const track = resolveResponse.data

    if (!track?.id) {
      return NextResponse.json(
        { error: 'Invalid track data received' },
        { status: 400 }
      )
    }

    // Get track details if media info is missing
    if (!track.media?.transcodings) {
      const trackDetailResponse = await axios({
        method: 'GET',
        url: `https://api-v2.soundcloud.com/tracks/${track.id}`,
        params: {
          client_id: clientId,
        },
        timeout: 8000,
      })

      if (trackDetailResponse.data?.media) {
        track.media = trackDetailResponse.data.media
      }
    }

    if (!track.media?.transcodings?.length) {
      return NextResponse.json(
        { error: 'No transcoding information available' },
        { status: 404 }
      )
    }

    // Find progressive MP3 streams, prioritizing HQ
    const allProgressiveStreams = track.media.transcodings.filter(
      (t: any) => t.format?.protocol === 'progressive' && t.format?.mime_type?.includes('audio/mpeg')
    )

    // First try: HQ progressive MP3 (quality === "hq")
    let streamInfo = allProgressiveStreams.find((t: any) => t.quality === 'hq')

    // Second try: Standard progressive MP3 (quality === "sq")
    if (!streamInfo) {
      streamInfo = allProgressiveStreams.find((t: any) => t.quality === 'sq')
    }

    // Third try: Any progressive MP3 without explicit quality (fallback)
    if (!streamInfo) {
      streamInfo = allProgressiveStreams.find((t: any) => !t.quality)
    }

    // Fourth try: Any progressive MP3 (last resort)
    if (!streamInfo && allProgressiveStreams.length > 0) {
      streamInfo = allProgressiveStreams[0]
    }

    // Fifth try: HLS stream as last resort
    if (!streamInfo) {
      streamInfo = track.media.transcodings.find((t: any) => t.format?.protocol === 'hls')
    }

    if (!streamInfo) {
      return NextResponse.json(
        { error: 'No suitable stream format found' },
        { status: 404 }
      )
    }

    // Determine quality and bitrate
    // Note: Bitrate values are estimates - actual codec/bitrate may vary
    let quality: 'hq' | 'standard' | 'preview' | 'low' = 'standard'
    let bitrate: number | undefined

    // Use streamInfo-provided bitrate if available, otherwise use estimates
    if (streamInfo.bitrate) {
      bitrate = streamInfo.bitrate
    } else {
      // Approximate defaults (estimates only)
      if (streamInfo.quality === 'hq') {
        quality = 'hq'
        bitrate = 256 // Estimated: HQ typically ~256 kbps (may be AAC or MP3)
      } else if (streamInfo.quality === 'sq') {
        quality = 'standard'
        bitrate = 128 // Estimated: Standard typically ~128 kbps
      } else if (streamInfo.quality) {
        quality = streamInfo.quality as 'preview' | 'low'
      }
    }

    // Get actual stream URL
    const streamResponse = await axios({
      method: 'GET',
      url: streamInfo.url,
      params: {
        client_id: clientId,
      },
      timeout: 8000,
    })

    if (!streamResponse.data?.url) {
      return NextResponse.json(
        { error: 'Failed to get stream URL' },
        { status: 500 }
      )
    }

    const streamUrl = streamResponse.data.url

    // If format=json, return JSON with stream URL and quality info
    if (format === 'json') {
      return NextResponse.json(
        {
          url: streamUrl,
          quality,
          bitrate,
        },
        {
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      )
    }

    // Otherwise, redirect to stream URL with no-cache header
    return NextResponse.redirect(streamUrl, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    console.error('SoundCloud stream error:', error.response?.data || error.message)
    return NextResponse.json(
      { error: 'Failed to resolve stream URL', message: error.message },
      { status: 500 }
    )
  }
}
