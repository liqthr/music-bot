/**
 * Crossfade timing calculations and utilities
 */

/**
 * Calculate fade points for crossfade transition
 * @param currentDuration - Duration of current track in seconds
 * @param crossfadeDuration - Crossfade duration in seconds
 * @returns Object with fade start times and end times
 */
export function calculateFadePoints(currentDuration: number, crossfadeDuration: number) {
  // If track is shorter than crossfade duration, disable crossfade
  if (currentDuration <= crossfadeDuration) {
    // Use the shorter duration for both fades to keep them consistent
    const fadeDuration = Math.min(currentDuration, crossfadeDuration)
    return {
      canCrossfade: false,
      fadeOutStart: 0,
      fadeOutEnd: fadeDuration,
      fadeInStart: 0,
      fadeInEnd: fadeDuration,
    }
  }

  // Fade out starts when there's crossfadeDuration time remaining
  const fadeOutStart = currentDuration - crossfadeDuration
  const fadeOutEnd = currentDuration

  // Fade in starts at 0 and ends at crossfadeDuration
  const fadeInStart = 0
  const fadeInEnd = crossfadeDuration

  return {
    canCrossfade: true,
    fadeOutStart,
    fadeOutEnd,
    fadeInStart,
    fadeInEnd,
  }
}

/**
 * Calculate preload trigger point (80% of track duration)
 * @param duration - Track duration in seconds
 * @returns Time in seconds when preload should trigger
 */
export function calculatePreloadPoint(duration: number): number {
  return duration * 0.8
}

/**
 * Check if current time has reached preload point
 * @param currentTime - Current playback time in seconds
 * @param duration - Track duration in seconds
 * @returns true if preload should trigger
 */
export function shouldPreload(currentTime: number, duration: number): boolean {
  if (!duration || duration === 0) return false
  const preloadPoint = calculatePreloadPoint(duration)
  return currentTime >= preloadPoint
}

/**
 * Check if crossfade should start
 * @param currentTime - Current playback time in seconds
 * @param duration - Track duration in seconds
 * @param crossfadeDuration - Crossfade duration in seconds
 * @returns true if crossfade should start
 */
export function shouldStartCrossfade(
  currentTime: number,
  duration: number,
  crossfadeDuration: number
): boolean {
  if (!duration || duration === 0 || crossfadeDuration === 0) return false
  if (duration <= crossfadeDuration) return false

  const fadeOutStart = duration - crossfadeDuration
  return currentTime >= fadeOutStart
}

