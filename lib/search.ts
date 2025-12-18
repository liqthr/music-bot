import type { Track, SearchMode } from './types'
import { parseSearchQuery } from './search-query-parser'
import { filterTracksByQuery } from './search-matcher'
import { searchResultCache } from './cache-manager'

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
 * Enrich a SoundCloud track with quality information
 * This is called asynchronously to avoid blocking search results
 */
export async function enrichSoundCloudTrackQuality(track: Track): Promise<Track> {
  if (track.platform !== 'soundcloud' || !track.permalink_url) {
    return track
  }

  try {
    const response = await fetch(
      `${baseUrl}/api/soundcloud/stream?url=${encodeURIComponent(track.permalink_url)}&format=json`,
      {
        signal: AbortSignal.timeout(5000),
        headers: {
          'Cache-Control': 'no-cache',
        },
      }
    )

    if (response.ok) {
      const data = await response.json()
      if (data.quality && data.bitrate) {
        return {
          ...track,
          quality: data.quality,
          bitrate: data.bitrate,
        }
      }
    }
  } catch (error) {
    // Silently fail - quality info is optional
    console.debug('Failed to fetch quality info for track:', track.id, error)
  }

  return track
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
        stream_url: `${baseUrl}/api/audio/download?videoId=${item.id.videoId}&format=mp3`,
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
 * Search for a track on alternative platforms for fallback
 * Matches by track name and artist name
 */
export async function findTrackOnAlternativePlatforms(
  track: Track,
  excludePlatform?: SearchMode,
  signal?: AbortSignal
): Promise<Track | null> {
  if (!track.name || !track.artists?.[0]?.name) {
    return null
  }

  // Build search query from track name and artist
  const searchQuery = `${track.name} ${track.artists[0].name}`.trim()

  // Get alternative platforms (exclude current platform)
  const platforms: SearchMode[] = ['spotify', 'soundcloud', 'youtube']
  const alternativePlatforms = excludePlatform
    ? platforms.filter((p) => p !== excludePlatform)
    : platforms

  // Try each alternative platform
  for (const platform of alternativePlatforms) {
    try {
      const results = await searchByMode(platform, searchQuery, { signal })
      
      // Find best match by comparing track name and artist
      const match = results.find((result) => {
        const trackNameMatch =
          result.name.toLowerCase().includes(track.name.toLowerCase()) ||
          track.name.toLowerCase().includes(result.name.toLowerCase())
        
        const artistMatch =
          result.artists?.[0]?.name &&
          track.artists?.[0]?.name &&
          (result.artists[0].name.toLowerCase().includes(track.artists[0].name.toLowerCase()) ||
           track.artists[0].name.toLowerCase().includes(result.artists[0].name.toLowerCase()))

        return trackNameMatch && artistMatch
      })

      if (match) {
        console.log(`[Platform Fallback] Found alternative on ${platform}:`, match.name)
        return match
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw error
      }
      // Continue to next platform on error
      console.debug(`[Platform Fallback] Failed to search ${platform}:`, error)
    }
  }

  return null
}

/**
 * Unified search function - only searches the specified mode, no automatic fallbacks
 * This ensures users see results only from their selected platform
 * Supports advanced query operators (AND, OR, NOT, field-specific, etc.)
 */
export async function searchByMode(
  mode: SearchMode,
  query: string,
  options: { signal?: AbortSignal; filters?: any } = {}
): Promise<Track[]> {
  if (!query.trim()) return []

  const { signal, filters } = options

  // Create cache key from query, mode, and filters
  const cacheKey = `${mode}:${query}:${JSON.stringify(filters || {})}`

  // Check cache first
  const cached = searchResultCache.get(cacheKey)
  if (cached) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Cache] Search result cache hit:', cacheKey)
    }
    return cached
  }

  // Parse query to extract field-specific searches and operators
  const parsedQuery = parseSearchQuery(query)

  // If query has syntax errors, return empty results
  if (parsedQuery.errors.length > 0) {
    return []
  }

  // Extract base query (without field-specific searches for API calls)
  // Field-specific searches and operators will be applied as filters after API response
  let baseQuery = query
    .replace(/\b(artist|album|year|duration):[^\s)]+/gi, '')
    .replace(/\b(AND|OR|NOT)\b/gi, ' ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // If base query is empty but we have field searches, use a wildcard
  if (!baseQuery && parsedQuery.hasFields) {
    baseQuery = '*'
  }

  // Perform platform-specific search
  let results: Track[] = []
  try {
    const searchFunctions = {
      spotify: () => searchSpotify(baseQuery || query, signal),
      soundcloud: () => searchSoundCloud(baseQuery || query, signal),
      youtube: () => searchYouTube(baseQuery || query, signal),
    }

    results = await searchFunctions[mode]()
  } catch (error: any) {
    if (error.name === 'AbortError') {
      // Aborted searches are expected when the user types quickly or changes platform.
      // Don't treat them as errors or spam the console; just return an empty result.
      if (process.env.NODE_ENV === 'development') {
        console.debug(`Search (${mode}) aborted`)
      }
      return []
    }

    console.error(`Search (${mode}) failed:`, error)
    return []
  }

  // Apply advanced query matching (boolean operators, field searches, etc.)
  if (
    parsedQuery.hasOperators ||
    parsedQuery.hasFields ||
    parsedQuery.hasQuotes ||
    parsedQuery.hasGrouping
  ) {
    results = filterTracksByQuery(results, parsedQuery)
  }

  // Cache results
  searchResultCache.set(cacheKey, results)

  if (process.env.NODE_ENV === 'development') {
    console.log('[Cache] Search result cached:', cacheKey)
  }

  return results
}
