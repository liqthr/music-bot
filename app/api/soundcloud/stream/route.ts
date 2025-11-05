import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

/**
 * SoundCloud stream URL resolver
 * Resolves track URL to actual audio stream URL
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const trackUrl = searchParams.get('url')

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

    // Find progressive MP3 stream or HLS fallback
    const progressiveStream = track.media.transcodings.find(
      (t: any) => t.format?.protocol === 'progressive' && t.format?.mime_type?.includes('audio/mpeg')
    )

    const hlsStream = !progressiveStream
      ? track.media.transcodings.find((t: any) => t.format?.protocol === 'hls')
      : null

    const streamInfo = progressiveStream || hlsStream

    if (!streamInfo) {
      return NextResponse.json(
        { error: 'No suitable stream format found' },
        { status: 404 }
      )
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

    // Redirect to stream URL with no-cache header
    return NextResponse.redirect(streamResponse.data.url, {
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
