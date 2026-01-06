/**
 * Utility functions for time formatting and manipulation
 * This module is part of the refactoring to improve modularity and code reuse.
 */

/**
 * Format time in MM:SS format
 * @param seconds - The total number of seconds to format
 * @returns A string in MM:SS format
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds === Infinity) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins < 10 ? '0' + mins : mins}:${secs < 10 ? '0' + secs : secs}`
}

/**
 * Convert milliseconds to a human-readable duration string
 * @param ms - Duration in milliseconds
 * @returns A string like "3:45"
 */
export function formatMsToDuration(ms: number): string {
  return formatTime(Math.floor(ms / 1000))
}
