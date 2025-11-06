/**
 * Audio analysis utilities for volume normalization
 * Provides RMS calculation, ReplayGain detection, and gain adjustment
 */

import type { Track, ReplayGainMetadata } from './types'

// Target loudness in LUFS (industry standard for streaming)
const TARGET_LUFS = -14.0

// Maximum gain adjustment to prevent clipping (dB)
const MAX_GAIN_DB = 12.0

// Analysis sample duration (first 30 seconds)
const ANALYSIS_DURATION = 30

/**
 * Check for ReplayGain metadata in track
 * @param track - Track to check for ReplayGain metadata
 * @returns ReplayGain metadata if found, null otherwise
 */
export function checkReplayGain(track: Track): ReplayGainMetadata | null {
  // Check if track has explicit ReplayGain metadata
  if (track.replayGain) {
    return track.replayGain
  }

  // Check for ReplayGain in album metadata (platform-dependent)
  if (track.album && (track.album as any).replayGain) {
    return (track.album as any).replayGain as ReplayGainMetadata
  }

  // Check for common ReplayGain field names in track metadata
  const trackAny = track as any
  if (trackAny.replaygain_track_gain || trackAny.replaygain_album_gain) {
    return {
      trackGain: parseFloat(trackAny.replaygain_track_gain) || undefined,
      albumGain: parseFloat(trackAny.replaygain_album_gain) || undefined,
      trackPeak: trackAny.replaygain_track_peak ? parseFloat(trackAny.replaygain_track_peak) : undefined,
      albumPeak: trackAny.replaygain_album_peak ? parseFloat(trackAny.replaygain_album_peak) : undefined,
    }
  }

  return null
}

/**
 * Analyze track volume using RMS calculation from AnalyserNode
 * Samples audio data while track is playing (first 30 seconds)
 * @param analyserNode - Web Audio API AnalyserNode
 * @param audioElement - HTML audio element
 * @param onProgress - Optional progress callback (0-1)
 * @returns Promise resolving to RMS value in LUFS (approximate)
 */
export async function analyzeTrackVolume(
  analyserNode: AnalyserNode,
  audioElement: HTMLAudioElement,
  onProgress?: (progress: number) => void
): Promise<number> {
  return new Promise((resolve, reject) => {
    if (!audioElement.src) {
      reject(new Error('Audio element has no source'))
      return
    }

    const frequencyData = new Uint8Array(analyserNode.frequencyBinCount)
    const samples: number[] = []
    const sampleInterval = 100 // Sample every 100ms
    let analysisStartTime = Date.now()
    const maxAnalysisTime = ANALYSIS_DURATION * 1000 // 30 seconds in ms

    // Start analysis - sample while track plays
    const analyze = () => {
      const elapsed = Date.now() - analysisStartTime
      
      // Check if we've analyzed enough or track has ended
      if (elapsed >= maxAnalysisTime || audioElement.ended || audioElement.paused) {
        finishAnalysis()
        return
      }

      // Get frequency data
      analyserNode.getByteFrequencyData(frequencyData)

      // Calculate RMS from frequency data
      let sumSquares = 0
      for (let i = 0; i < frequencyData.length; i++) {
        // Convert byte value (0-255) to normalized value (0-1)
        const normalized = frequencyData[i] / 255.0
        sumSquares += normalized * normalized
      }

      const rms = Math.sqrt(sumSquares / frequencyData.length)
      if (rms > 0) {
        samples.push(rms)
      }

      // Report progress
      if (onProgress) {
        onProgress(Math.min(elapsed / maxAnalysisTime, 1.0))
      }

      // Continue analysis
      setTimeout(analyze, sampleInterval)
    }

    const finishAnalysis = () => {
      // Calculate average RMS
      if (samples.length === 0) {
        // No samples collected - return default value (assume normal volume)
        resolve(-14.0)
        return
      }

      const avgRMS = samples.reduce((sum, val) => sum + val, 0) / samples.length

      // Convert RMS to dB
      // RMS to dB: dB = 20 * log10(rms)
      const rmsDb = avgRMS > 0 ? 20 * Math.log10(avgRMS) : -Infinity

      // Convert to approximate LUFS (simplified - not true LUFS measurement)
      // This is an approximation: LUFS ≈ dB - 23 (for typical music)
      const approximateLUFS = rmsDb - 23

      resolve(approximateLUFS)
    }

    // Start analysis immediately
    analyze()
  })
}

/**
 * Calculate gain adjustment needed to normalize track to target loudness
 * @param currentLUFS - Current loudness of track in LUFS
 * @param targetLUFS - Target loudness in LUFS (default -14)
 * @param preventClipping - Whether to limit maximum gain
 * @param replayGain - Optional ReplayGain metadata
 * @returns Gain adjustment in dB
 */
export function calculateGainAdjustment(
  currentLUFS: number | null,
  targetLUFS: number = TARGET_LUFS,
  preventClipping: boolean = true,
  replayGain: ReplayGainMetadata | null = null
): number {
  // If ReplayGain is available, use it (prefer track gain over album gain)
  if (replayGain) {
    const gainDb = replayGain.trackGain ?? replayGain.albumGain
    if (gainDb !== undefined) {
      // Apply clipping prevention if enabled
      if (preventClipping && gainDb > MAX_GAIN_DB) {
        return MAX_GAIN_DB
      }
      return gainDb
    }
  }

  // Otherwise, use RMS analysis result
  if (currentLUFS === null || !isFinite(currentLUFS)) {
    // No analysis data available, return 0 (no adjustment)
    return 0
  }

  // Calculate gain needed to reach target
  const gainDb = targetLUFS - currentLUFS

  // Apply clipping prevention if enabled
  if (preventClipping && gainDb > MAX_GAIN_DB) {
    return MAX_GAIN_DB
  }

  // Also prevent excessive negative gain (don't reduce volume too much)
  if (gainDb < -MAX_GAIN_DB) {
    return -MAX_GAIN_DB
  }

  return gainDb
}

/**
 * Convert gain in dB to linear gain multiplier
 * @param gainDb - Gain in decibels
 * @returns Linear gain multiplier
 */
export function dbToLinear(gainDb: number): number {
  return Math.pow(10, gainDb / 20)
}

/**
 * Convert linear gain multiplier to dB
 * @param linearGain - Linear gain multiplier
 * @returns Gain in decibels
 */
export function linearToDb(linearGain: number): number {
  return 20 * Math.log10(linearGain)
}

