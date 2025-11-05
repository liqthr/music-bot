import type { Track, SearchMode } from './types'

const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

/**
 * Search Spotify for tracks
 */
export async function searchSpotify(query: string, signal?: AbortSignal): Promise<Track[]> {
  if (!query.trim()) return []

  try {
    const response = await fetch(`${baseUrl}/api/search/spotify?q=${encodeURIComponent(query)}`, {
      signal,
      headers: {
        'Cache-Control': 'no-cache',
      },
    })

    if (!response.ok) return []

    const data = await response.json()

    if (!data.tracks?.items) return []

    return data.tracks.items.map((item: any) => ({
      id: item.id,
      name: item.name,
      artists: item.artists,
      album: {
        images: item.album.images,
      },
      preview_url: item.preview_url,
      duration_ms: item.duration_ms,
      platform: 'spotify' as const,
      uri: item.uri,
    }))
  } catch (error: any) {
    if (error.name === 'AbortError') throw error
    console.error('Spotify search error:', error)
    return []
  }
}

/**
 * Search SoundCloud for tracks
 */
export async function searchSoundCloud(query: string, signal?: AbortSignal): Promise<Track[]> {
  if (!query.trim()) return []

  try {
    const response = await fetch(`${baseUrl}/api/search/soundcloud?q=${encodeURIComponent(query)}`, {
      signal: signal || AbortSignal.timeout(10000),
      headers: {
        'Cache-Control': 'no-cache',
      },
    })

    if (!response.ok) return []

    const data = await response.json()
    const tracks = Array.isArray(data) ? data : data.collection || []

    return tracks
      .filter((item: any) => item?.title)
      .map((item: any) => ({
        id: String(item.id || `sc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`),
        name: item.title || 'Unknown Title',
        artists: [{ name: item.user?.username || 'Unknown Artist' }],
        album: {
          images: [
            {
              url:
                item.artwork_url?.replace('-large', '-t500x500') ||
                item.artwork_url ||
                item.user?.avatar_url?.replace('-large', '-t500x500') ||
                item.user?.avatar_url ||
                '/images/default.jpg',
            },
          ],
        },
        duration_ms: item.duration || 0,
        preview_url: item.permalink_url
          ? `${baseUrl}/api/soundcloud/stream?url=${encodeURIComponent(item.permalink_url)}`
          : undefined,
        platform: 'soundcloud' as const,
        permalink_url: item.permalink_url || '',
      }))
  } catch (error: any) {
    if (error.name === 'AbortError') throw error
    console.error('SoundCloud search error:', error)
    return []
  }
}

/**
 * Search YouTube for tracks
 */
export async function searchYouTube(query: string, signal?: AbortSignal): Promise<Track[]> {
  if (!query.trim()) return []

  try {
    const response = await fetch(`${baseUrl}/api/search/youtube?q=${encodeURIComponent(query)}`, {
      signal,
      headers: {
        'Cache-Control': 'no-cache',
      },
    })

    if (!response.ok) return []

    const data = await response.json()

    if (!data.items || !Array.isArray(data.items)) return []

    return data.items
      .filter((item: any) => item.id?.videoId)
      .map((item: any) => ({
        id: item.id.videoId,
        name: item.snippet?.title || 'Unknown Title',
        artists: [{ name: item.snippet?.channelTitle || 'YouTube' }],
        album: {
          images: [
            {
              url:
                item.snippet?.thumbnails?.high?.url ||
                item.snippet?.thumbnails?.default?.url ||
                '/images/default.jpg',
            },
          ],
        },
        platform: 'youtube' as const,
        videoId: item.id.videoId,
      }))
  } catch (error: any) {
    if (error.name === 'AbortError') throw error
    console.error('YouTube search error:', error)
    return []
  }
}

/**
 * Unified search function with fallback
 */
export async function searchByMode(
  mode: SearchMode,
  query: string,
  options: { signal?: AbortSignal } = {}
): Promise<Track[]> {
  const { signal } = options

  const searchFunctions = {
    spotify: () => searchSpotify(query, signal),
    soundcloud: () => searchSoundCloud(query, signal),
    youtube: () => searchYouTube(query, signal),
  }

  // Try primary provider first
  try {
    const results = await searchFunctions[mode]()
    if (results.length > 0) return results
  } catch (error: any) {
    if (error.name === 'AbortError') throw error
    console.warn(`Primary search (${mode}) failed:`, error)
  }

  // Try fallback providers without signal for independence
  const fallbacks: Array<() => Promise<Track[]>> = []
  if (mode !== 'spotify') fallbacks.push(() => searchSpotify(query))
  if (mode !== 'soundcloud') fallbacks.push(() => searchSoundCloud(query))
  if (mode !== 'youtube') fallbacks.push(() => searchYouTube(query))

  for (const fallback of fallbacks) {
    try {
      const results = await fallback()
      if (results.length > 0) return results
    } catch (error) {
      console.warn('Fallback search failed:', error)
    }
  }

  return []
}
