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
    // Validation: Log parameter types for debugging
    // The TypeScript error indicates videoEmbeddable expects string, not boolean
    console.log('[YouTube API Debug] Parameter validation:', {
      part: ['snippet'],
      q: query,
      maxResults: 10,
      type: ['video'],
      videoCategoryId: '10',
      // Note: videoEmbeddable: true causes TypeScript error
      // Hypothesis 1: Should be string "true" instead of boolean
      // Hypothesis 2: Parameter should be removed entirely
    })

    // Test: Remove videoEmbeddable parameter first (most likely fix)
    // If this compiles, we know the issue is with videoEmbeddable type
    const response = await youtube.search.list({
      part: ['snippet'],
      q: query,
      maxResults: 10,
      type: ['video'],
      videoCategoryId: '10', // Music category
      // Removed videoEmbeddable: true - TypeScript expects string, not boolean
    })

    console.log('[YouTube API Debug] Search completed successfully')
    return NextResponse.json(response.data)
  } catch (error: any) {
    console.error('YouTube search error:', error.response?.data || error.message)
    return NextResponse.json(
      { error: 'Failed to search YouTube', message: error.message },
      { status: 500 }
    )
  }
}
