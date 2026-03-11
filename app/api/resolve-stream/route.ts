import { NextRequest, NextResponse } from 'next/server'
import { resolveStream, getDirectStreamUrl } from '@/lib/stream-resolver'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const trackId = searchParams.get('id')

  if (!trackId) {
    return NextResponse.json(
      { error: 'Missing track ID parameter' },
      { status: 400 }
    )
  }

  try {
    // Extract platform and ID from trackId (format: "platform:id")
    const [platform, platformId] = trackId.split(':')
    
    if (platform !== 'spotify') {
      // For non-Spotify tracks, use existing converter service
      const converterUrl = process.env.CONVERTER_SERVICE_URL
      if (!converterUrl) {
        return NextResponse.json(
          { error: 'Converter service not configured' },
          { status: 503 }
        )
      }

      const streamUrl = `${converterUrl}/convert?platform=${platform}&id=${platformId}&format=mp3`
      return NextResponse.json({
        streamUrl,
        quality: 'mp3-320',
        platform,
        direct: true
      })
    }

    // For Spotify tracks, use SpotiFLAC-style resolution
    const resolution = await resolveStream(platformId)
    
    if (!resolution.bestSource) {
      return NextResponse.json(
        { error: 'No streaming sources found' },
        { status: 404 }
      )
    }

    const directUrl = await getDirectStreamUrl(platformId)
    
    return NextResponse.json({
      streamUrl: directUrl,
      quality: resolution.bestSource.quality,
      platform: resolution.bestSource.platform,
      availableSources: resolution.sources.map(s => ({
        platform: s.platform,
        quality: s.quality
      })),
      hasLossless: resolution.sources.some(s => s.quality === 'flac'),
      direct: resolution.bestSource.direct
    })

  } catch (error) {
    console.error('Stream resolution error:', error)
    return NextResponse.json(
      { error: 'Failed to resolve stream' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { trackIds } = body

    if (!Array.isArray(trackIds)) {
      return NextResponse.json(
        { error: 'trackIds must be an array' },
        { status: 400 }
      )
    }

    // Batch resolve multiple tracks
    const resolutions = await Promise.allSettled(
      trackIds.map(async (trackId: string) => {
        const [platform, platformId] = trackId.split(':')
        if (platform === 'spotify') {
          return await resolveStream(platformId)
        }
        return null
      })
    )

    const results = resolutions.map((result, index) => ({
      trackId: trackIds[index],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null
    }))

    return NextResponse.json({ results })

  } catch (error) {
    console.error('Batch stream resolution error:', error)
    return NextResponse.json(
      { error: 'Batch resolution failed' },
      { status: 500 }
    )
  }
}
