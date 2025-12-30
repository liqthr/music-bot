import { Track } from './types'

/**
 * Validation utility for the Music Bot project.
 * This module ensures data integrity across the application, 
 * meeting the OCR A-Level NEA requirements for robust validation.
 */

/**
 * Validates a Track object to ensure it has all required fields.
 * @param track The track object to validate
 * @returns boolean indicating if the track is valid
 */
export function isValidTrack(track: any): track is Track {
  if (!track || typeof track !== 'object') return false
  
  const requiredFields = ['id', 'name', 'artists', 'platform']
  for (const field of requiredFields) {
    if (!(field in track)) {
      console.warn(`Validation failed: Missing field "${field}" in track`, track)
      return false
    }
  }

  if (!Array.isArray(track.artists) || track.artists.length === 0) {
    console.warn('Validation failed: Artists must be a non-empty array', track)
    return false
  }

  const validPlatforms = ['spotify', 'soundcloud', 'youtube']
  if (!validPlatforms.includes(track.platform)) {
    console.warn(`Validation failed: Invalid platform "${track.platform}"`, track)
    return false
  }

  return true
}

/**
 * Validates a search query.
 * @param query The search string
 * @returns { isValid: boolean, error?: string }
 */
export function validateSearchQuery(query: string): { isValid: boolean; error?: string } {
  const trimmed = query.trim()
  
  if (trimmed.length === 0) {
    return { isValid: false, error: 'Search query cannot be empty' }
  }
  
  if (trimmed.length > 100) {
    return { isValid: false, error: 'Search query is too long (max 100 characters)' }
  }

  // Check for potentially harmful characters (basic sanitization)
  const illegalChars = /[<>]/
  if (illegalChars.test(trimmed)) {
    return { isValid: false, error: 'Search query contains invalid characters' }
  }

  return { isValid: true }
}

/**
 * Validates volume level.
 * @param volume Number between 0 and 1
 * @returns Validated volume level
 */
export function validateVolume(volume: number): number {
  if (isNaN(volume)) return 1
  return Math.max(0, Math.min(1, volume))
}
