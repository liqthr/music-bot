import type { Track } from './types'

/**
 * Shuffle array using Fisher-Yates algorithm
 * @param array - Array to shuffle
 * @returns New shuffled array (original array is not modified)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  
  // Fisher-Yates shuffle algorithm
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  
  return shuffled
}

/**
 * Shuffle queue while keeping the first track (next to play) in place
 * @param queue - Queue array to shuffle
 * @returns New shuffled queue with first item unchanged
 */
export function shuffleQueue(queue: Track[]): Track[] {
  if (queue.length <= 1) {
    return [...queue]
  }

  // Keep first track, shuffle the rest
  const [first, ...rest] = queue
  const shuffledRest = shuffleArray(rest)
  
  return [first, ...shuffledRest]
}

