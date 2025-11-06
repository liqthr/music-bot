/**
 * Lyrics API integration and parsing
 * Supports fetching lyrics from Genius API and parsing LRC format
 */

import { getItemWithTTL, setItemWithTTL } from './storage'

/**
 * Lyrics line with optional timestamp
 */
export interface LyricsLine {
  text: string
  timestamp?: number // Timestamp in seconds (for LRC format)
}

/**
 * Parsed lyrics data
 */
export interface ParsedLyrics {
  lines: LyricsLine[]
  isTimestamped: boolean // Whether lyrics have timestamps (LRC format)
  plainText?: string // Plain text version if available
}

/**
 * Cache TTL: 1 hour in milliseconds
 */
const LYRICS_CACHE_TTL = 60 * 60 * 1000

/**
 * Generate cache key for lyrics
 */
function getCacheKey(trackName: string, artistName: string): string {
  return `lyrics:${artistName}:${trackName}`.toLowerCase().replace(/[^a-z0-9:]/g, '')
}

/**
 * Parse LRC format lyrics
 * LRC format: [mm:ss.xx]Lyric line text
 * Also handles plain text lyrics (non-LRC format)
 * @param lyricsText - LRC formatted text or plain text
 * @returns Parsed lyrics with timestamps (if LRC) or plain text
 */
export function parseLRC(lyricsText: string): ParsedLyrics {
  const lines: LyricsLine[] = []
  const lyricsLines = lyricsText.split('\n')
  let hasTimestamps = false

  for (const line of lyricsLines) {
    // Match LRC timestamp format: [mm:ss.xx] or [mm:ss]
    const timestampMatch = line.match(/^\[(\d{2}):(\d{2})(?:\.(\d{2}))?\]/)
    
    if (timestampMatch) {
      hasTimestamps = true
      const minutes = parseInt(timestampMatch[1], 10)
      const seconds = parseInt(timestampMatch[2], 10)
      const centiseconds = timestampMatch[3] ? parseInt(timestampMatch[3], 10) : 0
      
      // Convert to seconds
      const timestamp = minutes * 60 + seconds + centiseconds / 100
      
      // Extract text after timestamp
      const text = line.replace(/^\[\d{2}:\d{2}(?:\.\d{2})?\]/, '').trim()
      
      if (text) {
        lines.push({ text, timestamp })
      }
    } else {
      // Check if it's metadata (e.g., [ar:Artist Name] or [ti:Title])
      const trimmed = line.trim()
      if (trimmed.startsWith('[') && trimmed.includes(':')) {
        // Skip metadata lines
        continue
      } else if (trimmed) {
        // Plain text line
        lines.push({ text: trimmed })
      }
    }
  }

  // Check if we have timestamps
  const isTimestamped = hasTimestamps && lines.some((line) => line.timestamp !== undefined)

  return {
    lines,
    isTimestamped,
    plainText: lines.map((line) => line.text).join('\n'),
  }
}

/**
 * Fetch lyrics from Genius API
 * @param trackName - Name of the track
 * @param artistName - Name of the artist
 * @returns Promise resolving to lyrics text or null if not found
 */
async function fetchLyricsFromGenius(trackName: string, artistName: string): Promise<string | null> {
  try {
    // Use Genius API search endpoint
    // Note: This is a simplified implementation. In production, you'd need:
    // 1. Genius API key (free tier available)
    // 2. Proper API endpoint: https://api.genius.com/search?q=...
    // 3. Parse the response to get lyrics URL
    // 4. Fetch the lyrics page and extract lyrics
    
    // For MVP, we'll use a proxy endpoint that handles the Genius API calls
    const searchQuery = `${artistName} ${trackName}`
    const response = await fetch(`/api/lyrics/genius?q=${encodeURIComponent(searchQuery)}`)
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    return data.lyrics || null
  } catch (error) {
    console.error('Error fetching lyrics from Genius:', error)
    return null
  }
}

/**
 * Fetch lyrics from Musixmatch API
 * @param trackName - Name of the track
 * @param artistName - Name of the artist
 * @returns Promise resolving to lyrics text or null if not found
 */
async function fetchLyricsFromMusixmatch(trackName: string, artistName: string): Promise<string | null> {
  try {
    // Use Musixmatch API
    // Note: This is a simplified implementation. In production, you'd need:
    // 1. Musixmatch API key (free tier available)
    // 2. Proper API endpoint: https://api.musixmatch.com/ws/1.1/matcher.lyrics.get
    // 3. Parse the response
    
    // For MVP, we'll use a proxy endpoint that handles the Musixmatch API calls
    const response = await fetch(
      `/api/lyrics/musixmatch?track=${encodeURIComponent(trackName)}&artist=${encodeURIComponent(artistName)}`
    )
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    return data.lyrics || null
  } catch (error) {
    console.error('Error fetching lyrics from Musixmatch:', error)
    return null
  }
}

/**
 * Fetch lyrics for a track
 * Tries cache first, then API, then caches result
 * @param trackName - Name of the track
 * @param artistName - Name of the artist
 * @param apiProvider - API provider to use ('genius' or 'musixmatch')
 * @returns Promise resolving to parsed lyrics or null if not found
 */
export async function fetchLyrics(
  trackName: string,
  artistName: string,
  apiProvider: 'genius' | 'musixmatch' = 'genius'
): Promise<ParsedLyrics | null> {
  // Check cache first
  const cacheKey = getCacheKey(trackName, artistName)
  const cached = getItemWithTTL<string>(cacheKey)
  
  if (cached) {
    // Parse cached lyrics
    return parseLRC(cached)
  }

  // Fetch from API
  let lyricsText: string | null = null
  
  if (apiProvider === 'genius') {
    lyricsText = await fetchLyricsFromGenius(trackName, artistName)
  } else {
    lyricsText = await fetchLyricsFromMusixmatch(trackName, artistName)
  }

  if (!lyricsText) {
    return null
  }

  // Cache the lyrics
  setItemWithTTL(cacheKey, lyricsText, LYRICS_CACHE_TTL)

  // Parse and return
  return parseLRC(lyricsText)
}

/**
 * Get Genius search URL for a track
 * @param trackName - Name of the track
 * @param artistName - Name of the artist
 * @returns Genius search URL
 */
export function getGeniusSearchUrl(trackName: string, artistName: string): string {
  const query = `${artistName} ${trackName}`.replace(/\s+/g, '-')
  return `https://genius.com/search?q=${encodeURIComponent(query)}`
}

