import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

/**
 * SoundCloud search endpoint
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query || query.trim() === '') {
    return NextResponse.json(
      { error: 'Search query is required' },
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
    // Try v2 API first
    const response = await axios({
      method: 'GET',
      url: 'https://api-v2.soundcloud.com/search/tracks',
      params: {
        q: query,
        client_id: clientId,
        limit: 10,
        offset: 0,
      },
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 8000,
    })

    if (response.data?.collection) {
      return NextResponse.json(response.data.collection)
    }

    // If no collection, check if it's a single track object
    if (response.data?.kind === 'track') {
      return NextResponse.json([response.data])
    }

    return NextResponse.json(response.data)
  } catch (error: any) {
    // Try fallback endpoint
    try {
      const fallbackResponse = await axios({
        method: 'GET',
        url: 'https://api.soundcloud.com/tracks',
        params: {
          q: query,
          client_id: clientId,
          limit: 10,
          linked_partitioning: 1,
        },
        headers: {
          Accept: 'application/json',
        },
        timeout: 8000,
      })

      return NextResponse.json(fallbackResponse.data.collection || fallbackResponse.data)
    } catch (fallbackError: any) {
      console.error('SoundCloud search error:', fallbackError.response?.data || fallbackError.message)
      return NextResponse.json(
        { error: 'Failed to search SoundCloud tracks' },
        { status: 500 }
      )
    }
  }
}
