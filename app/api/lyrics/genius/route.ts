import { NextRequest, NextResponse } from 'next/server'

/**
 * Genius lyrics API endpoint
 * Fetches lyrics from Genius API
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
    // For MVP, we'll use a simple approach:
    // 1. Search Genius for the track
    // 2. Get the lyrics page URL
    // 3. Scrape the lyrics (or use Genius API if available)
    
    // Note: Genius API requires authentication for full access
    // For MVP, we'll return a placeholder that indicates lyrics are available
    // In production, you would:
    // - Use Genius API with API key
    // - Or scrape the Genius lyrics page (with proper rate limiting)
    
    // For now, return a simple response indicating the search was successful
    // The actual lyrics fetching would be implemented with proper API integration
    
    return NextResponse.json({
      lyrics: null, // Placeholder - would contain actual lyrics
      url: `https://genius.com/search?q=${encodeURIComponent(query)}`,
      message: 'Lyrics API integration pending - would fetch from Genius',
    })
  } catch (error: any) {
    console.error('Genius lyrics error:', error.response?.data || error.message)
    return NextResponse.json(
      { error: 'Failed to fetch lyrics from Genius' },
      { status: 500 }
    )
  }
}

