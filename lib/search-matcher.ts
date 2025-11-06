/**
 * Search query matcher
 * Matches tracks against parsed search queries with boolean operators
 */

import type { Track } from './types'
import type { ParsedQuery, QueryToken, FieldSearch } from './search-query-parser'

/**
 * Extract year from track
 */
function extractYear(track: Track): number | null {
  if (!track.album?.release_date) return null
  const dateStr = track.album.release_date
  const yearMatch = dateStr.match(/^(\d{4})/)
  return yearMatch ? parseInt(yearMatch[1], 10) : null
}

/**
 * Extract duration in seconds
 */
function extractDuration(track: Track): number | null {
  if (!track.duration_ms) return null
  return Math.floor(track.duration_ms / 1000)
}

/**
 * Match field-specific search
 */
function matchField(track: Track, field: FieldSearch): boolean {
  switch (field.field) {
    case 'artist':
      return track.artists.some((artist) =>
        artist.name.toLowerCase().includes(field.value.toLowerCase())
      )

    case 'album': {
      const albumName = track.album?.name || ''
      return albumName.toLowerCase().includes(field.value.toLowerCase())
    }

    case 'year': {
      const trackYear = extractYear(track)
      if (!trackYear) return false
      const targetYear = parseInt(field.value, 10)
      if (isNaN(targetYear)) return false

      switch (field.operator) {
        case '>':
          return trackYear > targetYear
        case '<':
          return trackYear < targetYear
        case '>=':
          return trackYear >= targetYear
        case '<=':
          return trackYear <= targetYear
        case '=':
        default:
          return trackYear === targetYear
      }
    }

    case 'duration': {
      const trackDuration = extractDuration(track)
      if (!trackDuration) return false
      const targetDuration = parseInt(field.value, 10)
      if (isNaN(targetDuration)) return false

      switch (field.operator) {
        case '>':
          return trackDuration > targetDuration
        case '<':
          return trackDuration < targetDuration
        case '>=':
          return trackDuration >= targetDuration
        case '<=':
          return trackDuration <= targetDuration
        case '=':
        default:
          return Math.abs(trackDuration - targetDuration) < 5 // 5 second tolerance
      }
    }

    default:
      return false
  }
}

/**
 * Match a term against track
 */
function matchTerm(track: Track, term: string, isQuoted: boolean = false): boolean {
  const searchText = `${track.name} ${track.artists.map((a) => a.name).join(' ')} ${track.album?.name || ''}`.toLowerCase()
  const searchTerm = term.toLowerCase()

  if (isQuoted) {
    // Exact phrase match
    return searchText.includes(searchTerm)
  } else {
    // Word match (all words must be present)
    const words = searchTerm.split(/\s+/)
    return words.every((word) => searchText.includes(word))
  }
}

/**
 * Evaluate a token against a track
 */
function evaluateToken(track: Track, token: QueryToken, fields: FieldSearch[]): boolean {
  switch (token.type) {
    case 'TERM':
      return matchTerm(track, token.value, false)

    case 'QUOTED':
      return matchTerm(track, token.value, true)

    case 'FIELD': {
      // Find matching field search
      const field = fields.find((f) => {
        if (f.field !== token.field) return false
        // For fields with operators, the token value includes the operator
        if (f.operator) {
          return token.value.startsWith(f.operator) && token.value.substring(f.operator.length).trim() === f.value
        }
        return f.value === token.value
      })
      return field ? matchField(track, field) : false
    }

    case 'AND':
    case 'OR':
    case 'NOT':
    case 'LPAREN':
    case 'RPAREN':
      // These are handled by the expression evaluator
      return true

    default:
      return false
  }
}

/**
 * Evaluate query expression with boolean operators
 * Uses a simple recursive descent parser for AND/OR/NOT with parentheses
 */
function evaluateExpression(
  track: Track,
  tokens: QueryToken[],
  fields: FieldSearch[],
  start: number = 0,
  end: number = tokens.length
): { result: boolean; nextIndex: number } {
  if (start >= end) {
    return { result: true, nextIndex: start }
  }

  let index = start
  let result = true
  let currentOp: 'AND' | 'OR' | null = null

  while (index < end) {
    const token = tokens[index]

    // Handle NOT operator
    if (token.type === 'NOT') {
      index++
      if (index >= end) {
        return { result: false, nextIndex: index }
      }

      const nextToken = tokens[index]
      let notResult: boolean

      if (nextToken.type === 'LPAREN') {
        const expr = evaluateExpression(track, tokens, fields, index + 1, end)
        notResult = !expr.result
        index = expr.nextIndex
      } else {
        notResult = !evaluateToken(track, nextToken, fields)
        index++
      }

      if (currentOp === 'OR') {
        result = result || notResult
      } else {
        result = result && notResult
      }
      continue
    }

    // Handle parentheses
    if (token.type === 'LPAREN') {
      const expr = evaluateExpression(track, tokens, fields, index + 1, end)
      const value = expr.result
      index = expr.nextIndex

      if (currentOp === 'OR') {
        result = result || value
      } else if (currentOp === 'AND') {
        result = result && value
      } else {
        result = value
      }
      continue
    }

    if (token.type === 'RPAREN') {
      return { result, nextIndex: index + 1 }
    }

    // Handle operators
    if (token.type === 'AND') {
      currentOp = 'AND'
      index++
      continue
    }

    if (token.type === 'OR') {
      currentOp = 'OR'
      index++
      continue
    }

    // Handle terms
    const value = evaluateToken(track, token, fields)

    if (currentOp === 'OR') {
      result = result || value
    } else if (currentOp === 'AND') {
      result = result && value
    } else {
      result = value
    }

    index++
  }

  return { result, nextIndex: index }
}

/**
 * Match a track against a parsed query
 * @param track - Track to match
 * @param parsedQuery - Parsed query structure
 * @returns True if track matches query
 */
export function matchTrack(track: Track, parsedQuery: ParsedQuery): boolean {
  if (parsedQuery.errors.length > 0) {
    // Invalid query, don't match anything
    return false
  }

  if (parsedQuery.tokens.length === 0) {
    // Empty query, match everything
    return true
  }

  // If no operators, use simple AND logic
  if (!parsedQuery.hasOperators && !parsedQuery.hasGrouping) {
    // Check all field searches first
    for (const field of parsedQuery.fields) {
      if (!matchField(track, field)) {
        return false
      }
    }

    // Check all terms
    for (const token of parsedQuery.tokens) {
      if (token.type === 'TERM' || token.type === 'QUOTED') {
        if (!evaluateToken(track, token, parsedQuery.fields)) {
          return false
        }
      }
    }

    return true
  }

  // Evaluate expression with operators
  const { result } = evaluateExpression(track, parsedQuery.tokens, parsedQuery.fields)
  return result
}

/**
 * Filter tracks based on parsed query
 * @param tracks - Array of tracks to filter
 * @param parsedQuery - Parsed query structure
 * @returns Filtered array of tracks
 */
export function filterTracksByQuery(tracks: Track[], parsedQuery: ParsedQuery): Track[] {
  if (parsedQuery.errors.length > 0) {
    // Return empty array for invalid queries
    return []
  }

  return tracks.filter((track) => matchTrack(track, parsedQuery))
}

