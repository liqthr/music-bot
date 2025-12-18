import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

/**
 * Spotify search endpoint
 * Searches Spotify tracks using client credentials flow
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

  try {
    // Get client credentials token
    const clientId = process.env.SPOTIFY_CLIENT_ID
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Missing Spotify credentials' },
        { status: 500 }
      )
    }

    // Get access token
    const tokenResponse = await axios.post(
      'https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    const accessToken = tokenResponse.data.access_token

    // Search Spotify
    const searchResponse = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    return NextResponse.json(searchResponse.data)
  } catch (error: any) {
    console.error('Spotify search error:', error.response?.data || error.message)
    return NextResponse.json(
      { error: 'Failed to search Spotify tracks' },
      { status: 500 }
    )
  }
}
