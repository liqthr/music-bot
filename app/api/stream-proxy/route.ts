import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform')
  const url = searchParams.get('url')

  if (!platform || !url) {
    return NextResponse.json(
      { error: 'Missing platform or url parameter' },
      { status: 400 }
    )
  }

  try {
    // Add platform-specific headers and authentication
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'audio',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site'
    }

    // Add platform-specific authentication
    switch (platform) {
      case 'tidal':
        // Would need Tidal token - for now just proxy
        break
      case 'qobuz':
        // Would need Qobuz app ID/secret - for now just proxy
        break
      case 'amazon':
        // Would need Amazon authentication - for now just proxy
        break
      default:
        break
    }

    // Handle range requests for streaming
    const rangeHeader = request.headers.get('range')
    if (rangeHeader) {
      headers['Range'] = rangeHeader
    }

    // Fetch the stream
    const response = await fetch(url, {
      method: 'GET',
      headers,
      // Important: Don't follow redirects automatically for some platforms
      redirect: 'manual'
    })

    // Handle redirects
    if (response.status === 301 || response.status === 302) {
      const location = response.headers.get('location')
      if (location) {
        const redirectResponse = await fetch(location, { headers })
        if (redirectResponse.ok) {
          return new Response(redirectResponse.body, {
            status: redirectResponse.status,
            headers: {
              'Content-Type': redirectResponse.headers.get('Content-Type') || 'audio/mpeg',
              'Content-Length': redirectResponse.headers.get('Content-Length') || '',
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=3600',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, OPTIONS',
              'Access-Control-Allow-Headers': 'Range'
            }
          })
        }
      }
    }

    if (!response.ok) {
      throw new Error(`Stream fetch failed: ${response.status}`)
    }

    // Return the proxied stream
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
        'Content-Length': response.headers.get('Content-Length') || '',
        'Accept-Ranges': response.headers.get('Accept-Ranges') || 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Range'
      }
    })

  } catch (error) {
    console.error('Stream proxy error:', error)
    return NextResponse.json(
      { error: 'Stream proxy failed' },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type'
    }
  })
}
