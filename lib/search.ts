import type { Track, SearchMode } from './types'

const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

/**
 * Search Spotify for tracks matching the provided query.
 *
 * @param query - The search term; an empty or whitespace-only string yields an empty result.
 * @param signal - Optional AbortSignal to cancel the request.
 * @returns An array of `Track` objects for matching Spotify results. Each returned track includes `preview_url` and `platform` set to `'spotify'`. Returns an empty array if the query is blank, the request fails or is not OK, the response contains no tracks, or an error occurs (except for an `AbortError`, which is rethrown).
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

    return data.tracks.items
      .filter((item: any) => item.preview_url) // Only include tracks with preview URLs
      .map((item: any) => ({
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
 * Searches YouTube for tracks that match the given query.
 *
 * @param query - The text to search for.
 * @param signal - Optional AbortSignal to cancel the network request.
 * @returns An array of Track objects for matching videos; each track includes `videoId`, `stream_url` (FLAC download endpoint), and `preview_url` (MP3 preview endpoint). Returns an empty array when no results are found or on non-abort errors.
 * @throws Throws the provided `AbortError` when the operation is aborted via `signal`.
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
        // YouTube tracks use our download endpoint to get FLAC/MP3 audio
        stream_url: `${baseUrl}/api/audio/download?videoId=${item.id.videoId}&format=flac`,
        preview_url: `${baseUrl}/api/audio/download?videoId=${item.id.videoId}&format=mp3`,
      }))
  } catch (error: any) {
    if (error.name === 'AbortError') throw error
    console.error('YouTube search error:', error)
    return []
  }
}

/**
 * Searches the specified platform for tracks matching the query.
 *
 * @param mode - The platform to query (`spotify`, `soundcloud`, or `youtube`)
 * @param query - Search terms to use for the query
 * @param options - Optional settings
 * @param options.signal - AbortSignal to cancel the request
 * @returns An array of matching `Track` objects (empty array on failure)
 * @throws `AbortError` when the provided `signal` aborts the request
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

  // Only search the selected mode - no fallbacks
  try {
    const results = await searchFunctions[mode]()
    return results
  } catch (error: any) {
    if (error.name === 'AbortError') throw error
    console.warn(`Search (${mode}) failed:`, error)
    return []
  }
}