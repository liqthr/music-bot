/**
 * SpotiFLAC-style streaming resolver
 * Cross-references tracks across platforms for high-quality audio
 */

export interface StreamSource {
  platform: 'tidal' | 'qobuz' | 'amazon' | 'youtube' | 'soundcloud' | 'spotify'
  quality: 'flac' | 'mp3-320' | 'mp3-128'
  url: string
  direct?: boolean // If true, can be played directly
}

export interface StreamResolution {
  trackId: string
  sources: StreamSource[]
  bestSource: StreamSource | null
}

/**
 * Resolve streaming sources using SpotiFLAC methodology
 */
export async function resolveStream(spotifyId: string): Promise<StreamResolution> {
  const sources: StreamSource[] = []
  
  try {
    // Step 1: Get cross-platform links via SongLink/Odesli
    const songLinks = await getSongLinks(spotifyId)
    
    // Step 2: Extract streaming URLs from each platform
    for (const [platform, url] of Object.entries(songLinks)) {
      const streamUrl = await extractStreamUrl(platform as any, url)
      if (streamUrl) {
        sources.push(streamUrl)
      }
    }
    
    // Step 3: Add YouTube fallback
    const youtubeSource = await getYouTubeFallback(spotifyId)
    if (youtubeSource) {
      sources.push(youtubeSource)
    }
    
    // Step 4: Sort by quality preference
    sources.sort((a, b) => {
      const qualityOrder = { 'flac': 0, 'mp3-320': 1, 'mp3-128': 2 }
      return qualityOrder[a.quality] - qualityOrder[b.quality]
    })
    
    return {
      trackId: spotifyId,
      sources,
      bestSource: sources[0] || null
    }
    
  } catch (error) {
    console.error('Stream resolution failed:', error)
    return {
      trackId: spotifyId,
      sources: [],
      bestSource: null
    }
  }
}

/**
 * Get cross-platform links via SongLink API
 */
async function getSongLinks(spotifyId: string): Promise<Record<string, string>> {
  const url = `https://api.song.link/v1-alpha.1/links?url=spotify:track:${spotifyId}&userCountry=US`
  
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`SongLink API error: ${response.status}`)
    
    const data = await response.json()
    const links: Record<string, string> = {}
    
    // Extract platform URLs
    if (data.linksByPlatform) {
      for (const [platform, info] of Object.entries(data.linksByPlatform)) {
        if (info && typeof info === 'object' && 'url' in info) {
          links[platform] = (info as any).url
        }
      }
    }
    
    return links
    
  } catch (error) {
    console.error('SongLink fetch failed:', error)
    return {}
  }
}

/**
 * Extract stream URL from platform
 */
async function extractStreamUrl(platform: string, url: string): Promise<StreamSource | null> {
  switch (platform) {
    case 'tidal':
      return await extractTidalStream(url)
    case 'qobuz':
      return await extractQobuzStream(url)
    case 'amazon':
      return await extractAmazonStream(url)
    default:
      return null
  }
}

/**
 * Extract Tidal stream URL (highest priority - FLAC)
 */
async function extractTidalStream(url: string): Promise<StreamSource | null> {
  try {
    // This would require Tidal API integration
    // For now, return null - would need Tidal token extraction
    return null
  } catch (error) {
    console.error('Tidal stream extraction failed:', error)
    return null
  }
}

/**
 * Extract Qobuz stream URL (second priority - FLAC)
 */
async function extractQobuzStream(url: string): Promise<StreamSource | null> {
  try {
    // This would require Qobuz API integration
    // For now, return null - would need Qobuz token extraction
    return null
  } catch (error) {
    console.error('Qobuz stream extraction failed:', error)
    return null
  }
}

/**
 * Extract Amazon stream URL (third priority - MP3)
 */
async function extractAmazonStream(url: string): Promise<StreamSource | null> {
  try {
    // This would require Amazon API integration
    // For now, return null - would need Amazon integration
    return null
  } catch (error) {
    console.error('Amazon stream extraction failed:', error)
    return null
  }
}

/**
 * YouTube fallback using our converter service
 */
async function getYouTubeFallback(spotifyId: string): Promise<StreamSource | null> {
  try {
    const converterUrl = process.env.CONVERTER_SERVICE_URL
    if (!converterUrl) return null
    
    // Use our existing converter service for YouTube fallback
    const streamUrl = `${converterUrl}/convert?platform=spotify&id=${spotifyId}&format=mp3`
    
    return {
      platform: 'youtube',
      quality: 'mp3-320',
      url: streamUrl,
      direct: true
    }
  } catch (error) {
    console.error('YouTube fallback failed:', error)
    return null
  }
}

/**
 * Get direct stream URL for playback
 */
export async function getDirectStreamUrl(trackId: string): Promise<string | null> {
  const resolution = await resolveStream(trackId)
  
  if (!resolution.bestSource) {
    return null
  }
  
  const source = resolution.bestSource
  
  if (source.direct) {
    return source.url
  }
  
  // For non-direct sources, we'd need to proxy through our service
  return `/api/stream-proxy?platform=${source.platform}&url=${encodeURIComponent(source.url)}`
}

/**
 * Enhanced search with streaming capability info
 */
export async function searchWithStreamingInfo(query: string, platform: string): Promise<any[]> {
  // Get search results from existing API
  const searchResponse = await fetch(`/api/search/${platform}?q=${encodeURIComponent(query)}`)
  if (!searchResponse.ok) return []
  
  const { tracks } = await searchResponse.json()
  
  // Add streaming capability info to each track
  const enrichedTracks = await Promise.all(
    tracks.map(async (track: any) => {
      const spotifyId = track.source.platformId
      const resolution = await resolveStream(spotifyId)
      
      return {
        ...track,
        streamingInfo: {
          hasLossless: resolution.sources.some(s => s.quality === 'flac'),
          availableSources: resolution.sources.map(s => ({
            platform: s.platform,
            quality: s.quality
          })),
          bestQuality: resolution.bestSource?.quality || 'mp3-128'
        }
      }
    })
  )
  
  return enrichedTracks
}
