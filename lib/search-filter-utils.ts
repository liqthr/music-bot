/**
 * Search filter utilities
 * Handles client-side filtering of search results
 */

import type { Track, SearchFilters, YearRange, DurationRange, DurationPreset } from './types'

/**
 * Predefined list of genres
 */
export const GENRES = [
  'Rock',
  'Pop',
  'Jazz',
  'Classical',
  'Electronic',
  'Hip-Hop',
  'Country',
  'R&B',
  'Metal',
  'Indie',
] as const

export type Genre = typeof GENRES[number]

/**
 * Extract year from track release date
 * @param track - Track to extract year from
 * @returns Year as number or null
 */
function extractYear(track: Track): number | null {
  if (!track.album?.release_date) return null

  const dateStr = track.album.release_date
  // Handle YYYY-MM-DD or YYYY format
  const yearMatch = dateStr.match(/^(\d{4})/)
  if (yearMatch) {
    return parseInt(yearMatch[1], 10)
  }

  return null
}

/**
 * Extract genre from track metadata
 * @param track - Track to extract genre from
 * @returns Genre string or null
 */
function extractGenre(track: Track): string | null {
  // Check if track has explicit genre field
  if (track.genre) {
    return track.genre
  }

  // Check album genres first if available
  if (track.album?.genres && Array.isArray(track.album.genres) && track.album.genres.length > 0) {
    return track.album.genres[0]
  }

  // Try to infer from track name/artist (heuristic with word-boundary matching)
  // This is a simple implementation - in a real app, you'd use more sophisticated methods
  // Note: This heuristic logic may still yield false positives
  const searchText = `${track.name} ${track.artists.map((a) => a.name).join(' ')}`.toLowerCase()

  // Use word-boundary regex to avoid matching substrings inside words
  for (const genre of GENRES) {
    const genreLower = genre.toLowerCase()
    // Match genre as whole word using word boundaries
    const regex = new RegExp(`\\b${genreLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (regex.test(searchText)) {
      return genre
    }
  }

  return null
}

/**
 * Check if track matches genre filter
 * @param track - Track to check
 * @param genres - Selected genres
 * @returns True if track matches
 */
function matchesGenre(track: Track, genres: string[]): boolean {
  if (genres.length === 0) return true

  const trackGenre = extractGenre(track)
  if (!trackGenre) return false

  return genres.some((genre) => trackGenre.toLowerCase() === genre.toLowerCase())
}

/**
 * Check if track matches year range filter
 * @param track - Track to check
 * @param yearRange - Year range filter
 * @returns True if track matches
 */
function matchesYearRange(track: Track, yearRange: YearRange): boolean {
  if (!yearRange.from && !yearRange.to) return true

  const trackYear = extractYear(track)
  if (!trackYear) return false

  if (yearRange.from && trackYear < yearRange.from) return false
  if (yearRange.to && trackYear > yearRange.to) return false

  return true
}

/**
 * Get duration preset range
 * @param preset - Duration preset
 * @returns Duration range in seconds
 */
function getDurationPresetRange(preset: DurationPreset): DurationRange {
  switch (preset) {
    case 'short':
      return { min: 0, max: 180 } // < 3 minutes
    case 'medium':
      return { min: 180, max: 360 } // 3-6 minutes
    case 'long':
      return { min: 360 } // > 6 minutes
    case 'custom':
      return {}
    default:
      return {}
  }
}

/**
 * Check if track matches duration filter
 * @param track - Track to check
 * @param duration - Duration filter
 * @returns True if track matches
 */
function matchesDuration(track: Track, duration: { preset?: DurationPreset; custom?: DurationRange }): boolean {
  if (!duration.preset && !duration.custom) return true

  if (!track.duration_ms) return false

  const durationSeconds = track.duration_ms / 1000

  // Use custom range if provided, otherwise use preset
  const range = duration.custom || getDurationPresetRange(duration.preset!)

  if (range.min !== undefined && durationSeconds < range.min) return false
  if (range.max !== undefined && durationSeconds > range.max) return false

  return true
}

/**
 * Check if track matches platform filter
 * @param track - Track to check
 * @param platforms - Selected platforms
 * @returns True if track matches
 */
function matchesPlatform(track: Track, platforms: ('spotify' | 'soundcloud' | 'youtube')[]): boolean {
  if (platforms.length === 0) return true

  return platforms.includes(track.platform)
}

/**
 * Count active filters
 * @param filters - Search filters
 * @returns Number of active filters
 */
export function countActiveFilters(filters: SearchFilters): number {
  let count = 0

  if (filters.genres && filters.genres.length > 0) {
    count++
  }

  if (filters.yearRange && (filters.yearRange.from || filters.yearRange.to)) {
    count++
  }

  if (filters.duration && (filters.duration.preset || filters.duration.custom)) {
    count++
  }

  if (filters.platforms && filters.platforms.length > 0 && filters.platforms.length < 3) {
    // Only count if not all platforms are selected
    count++
  }

  return count
}

/**
 * Check if filters are empty (no active filters)
 * @param filters - Search filters
 * @returns True if no filters are active
 */
export function isEmptyFilters(filters: SearchFilters): boolean {
  return countActiveFilters(filters) === 0
}

/**
 * Apply filters to search results
 * @param tracks - Array of tracks to filter
 * @param filters - Search filters to apply
 * @returns Filtered array of tracks
 */
export function applyFilters(tracks: Track[], filters: SearchFilters): Track[] {
  if (isEmptyFilters(filters)) {
    return tracks
  }

  return tracks.filter((track) => {
    // Genre filter
    if (filters.genres && filters.genres.length > 0) {
      if (!matchesGenre(track, filters.genres)) {
        return false
      }
    }

    // Year range filter
    if (filters.yearRange) {
      if (!matchesYearRange(track, filters.yearRange)) {
        return false
      }
    }

    // Duration filter
    if (filters.duration) {
      if (!matchesDuration(track, filters.duration)) {
        return false
      }
    }

    // Platform filter
    if (filters.platforms && filters.platforms.length > 0 && filters.platforms.length < 3) {
      // Only filter if not all platforms are selected
      if (!matchesPlatform(track, filters.platforms)) {
        return false
      }
    }

    return true
  })
}

/**
 * Get default filters (empty filters)
 * @returns Default empty filters
 */
export function getDefaultFilters(): SearchFilters {
  return {
    genres: [],
    yearRange: {},
    duration: {},
    platforms: [],
  }
}

