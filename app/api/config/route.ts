import { NextRequest, NextResponse } from 'next/server'

/**
 * Public client configuration for Spotify auth
 * Used by the legacy Web Playback authentication flow and can be reused from React.
 */
export const GET = async (request: NextRequest) => {
  const spotifyClientId = process.env.SPOTIFY_CLIENT_ID || ''

  // Derive origin from request in case NEXT_PUBLIC_APP_URL is not set
  const requestOrigin = request.nextUrl.origin
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || requestOrigin

  const isProduction = process.env.NODE_ENV === 'production'

  const spotifyRedirectUri = isProduction
    ? `${appUrl.replace(/\/$/, '')}/callback`
    : 'http://localhost:3000/callback'

  const spotifyScopes = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-read-playback-state',
    'user-modify-playback-state',
  ].join(' ')

  return NextResponse.json({
    spotifyClientId,
    spotifyRedirectUri,
    spotifyScopes,
  })
}


