/**
 * Tidal Integration for School Project
 * Extracts high-quality FLAC streams from Tidal
 */

export interface TidalAuth {
  accessToken: string
  tokenType: string
  tidalToken: string
  userId: string
  countryCode: string
}

export interface TidalStream {
  url: string
  quality: string
  codec: string
}

/**
 * Store Tidal authentication tokens (for demo purposes)
 */
export function storeTidalAuth(auth: TidalAuth) {
  localStorage.setItem('tidal_auth', JSON.stringify(auth))
  console.log('Tidal auth stored for demo')
}

/**
 * Get stored Tidal authentication
 */
export function getTidalAuth(): TidalAuth | null {
  try {
    const stored = localStorage.getItem('tidal_auth')
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

/**
 * Extract Tidal track ID from various URL formats
 */
export function extractTidalId(url: string): string | null {
  // Handle different Tidal URL formats
  const patterns = [
    /tidal\.com\/browse\/track\/(\d+)/,
    /tidal\.com\/track\/(\d+)/,
    /track\/(\d+)/
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  
  return null
}

/**
 * Get Tidal stream URL for a track
 * This is the core function for extracting FLAC streams
 */
export async function getTidalStream(trackId: string): Promise<TidalStream | null> {
  const auth = getTidalAuth()
  if (!auth) {
    console.log('No Tidal auth found - using demo mode')
    return getDemoTidalStream(trackId)
  }

  try {
    console.log(`Fetching Tidal stream for track: ${trackId}`)
    
    // Get track information first
    const trackResponse = await fetch(
      `https://api.tidal.com/v1/tracks/${trackId}?countryCode=${auth.countryCode}`,
      {
        headers: {
          'Authorization': `${auth.tokenType} ${auth.accessToken}`,
          'X-Tidal-Token': auth.tidalToken,
          'Accept': 'application/json'
        }
      }
    )

    if (!trackResponse.ok) {
      console.log('Tidal track fetch failed, using demo mode')
      return getDemoTidalStream(trackId)
    }

    const trackData = await trackResponse.json()
    console.log('Tidal track data:', trackData.title)

    // Get stream URL for highest quality
    const streamResponse = await fetch(
      `https://api.tidal.com/v1/tracks/${trackId}/streamurl?countryCode=${auth.countryCode}&soundQuality=LOSSLESS`,
      {
        headers: {
          'Authorization': `${auth.tokenType} ${auth.accessToken}`,
          'X-Tidal-Token': auth.tidalToken,
          'Accept': 'application/json'
        }
      }
    )

    if (!streamResponse.ok) {
      console.log('Tidal stream fetch failed, using demo mode')
      return getDemoTidalStream(trackId)
    }

    const streamData = await streamResponse.json()
    console.log('Tidal stream quality:', streamData.soundQuality)

    return {
      url: streamData.url,
      quality: streamData.soundQuality || 'LOSSLESS',
      codec: streamData.codec || 'flac'
    }

  } catch (error) {
    console.error('Tidal stream extraction failed:', error)
    return getDemoTidalStream(trackId)
  }
}

/**
 * Demo mode Tidal stream (for school project demo)
 */
function getDemoTidalStream(trackId: string): TidalStream | null {
  console.log(`Using demo Tidal stream for track: ${trackId}`)
  
  // For demo, return a placeholder that simulates FLAC
  return {
    url: `https://demo-tidal-stream.com/track/${trackId}/flac`,
    quality: 'LOSSLESS',
    codec: 'flac'
  }
}

/**
 * Instructions for getting real Tidal tokens (for school project)
 */
export function getTidalTokenInstructions(): string[] {
  return [
    "1. Open tidal.com in your browser and login",
    "2. Play any song to trigger API calls", 
    "3. Open Developer Tools (F12) → Network tab",
    "4. Look for requests to 'api.tidal.com'",
    "5. Click on a track request and find these headers:",
    "   - Authorization: Bearer [token]",
    "   - X-Tidal-Token: [token]",
    "6. Copy these values and paste them in the auth panel"
  ]
}

/**
 * Validate Tidal authentication
 */
export function validateTidalAuth(auth: any): auth is TidalAuth {
  return auth && 
         typeof auth.accessToken === 'string' &&
         typeof auth.tokenType === 'string' &&
         typeof auth.tidalToken === 'string' &&
         typeof auth.userId === 'string' &&
         typeof auth.countryCode === 'string'
}

/**
 * Search Tidal for tracks (demo implementation)
 */
export async function searchTidal(query: string): Promise<any[]> {
  const auth = getTidalAuth()
  if (!auth) {
    console.log('No Tidal auth - returning demo results')
    return getDemoTidalSearchResults(query)
  }

  try {
    const response = await fetch(
      `https://api.tidal.com/v1/search?query=${encodeURIComponent(query)}&limit=20&type=tracks&countryCode=${auth.countryCode}`,
      {
        headers: {
          'Authorization': `${auth.tokenType} ${auth.accessToken}`,
          'X-Tidal-Token': auth.tidalToken
        }
      }
    )

    if (!response.ok) {
      return getDemoTidalSearchResults(query)
    }

    const data = await response.json()
    return data.tracks || []

  } catch (error) {
    console.error('Tidal search failed:', error)
    return getDemoTidalSearchResults(query)
  }
}

/**
 * Demo search results for testing
 */
function getDemoTidalSearchResults(query: string): any[] {
  return [
    {
      id: '123456789',
      title: `${query} - Demo Track 1`,
      artist: { name: 'Demo Artist' },
      album: { title: 'Demo Album' },
      duration: 180,
      quality: 'LOSSLESS'
    },
    {
      id: '987654321', 
      title: `${query} - Demo Track 2`,
      artist: { name: 'Demo Artist 2' },
      album: { title: 'Demo Album 2' },
      duration: 210,
      quality: 'LOSSLESS'
    }
  ]
}
