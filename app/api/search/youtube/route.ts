import { NextRequest, NextResponse } from 'next/server'
import { youtube_v3 } from '@googleapis/youtube'

const youtube = new youtube_v3.Youtube({
  auth: process.env.YOUTUBE_API_KEY,
})

/**
 * YouTube search endpoint
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

  if (!process.env.YOUTUBE_API_KEY) {
    return NextResponse.json(
      { error: 'Missing YouTube API key' },
      { status: 500 }
    )
  }

  try {
    const response = await youtube.search.list({
      part: ['snippet'],
      q: query,
      maxResults: 10,
      type: ['video'],
      videoCategoryId: '10', // Music category
      videoEmbeddable: true,
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    console.error('YouTube search error:', error.response?.data || error.message)
    return NextResponse.json(
      { error: 'Failed to search YouTube', message: error.message },
      { status: 500 }
    )
  }
}
