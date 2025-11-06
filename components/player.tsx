'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { Track, CrossfadeSettings, NormalizationSettings, PlaybackSettings } from '@/lib/types'
import { audioProcessor } from '@/lib/audio-processor'
import { shouldPreload, shouldStartCrossfade, calculateFadePoints } from '@/lib/crossfade'
import {
  checkReplayGain,
  analyzeTrackVolume,
  calculateGainAdjustment,
  dbToLinear,
} from '@/lib/audio-analysis'
import { needsMemoryCleanup } from '@/lib/memory-monitor'
import { errorHandler, type ErrorInfo } from '@/lib/error-handler'

interface PlayerProps {
  track: Track | null
  nextTrack: Track | null
  isPlaying: boolean
  onTogglePlay: () => void
  onNext: () => void
  onPrevious: () => void
  onTimeUpdate: (time: number) => void
  onDurationChange: (duration: number) => void
  volume: number
  onVolumeChange: (volume: number) => void
  seekTo?: number
  crossfadeSettings: CrossfadeSettings
  onCrossfadeStateChange: (isCrossfading: boolean) => void
  normalizationSettings: NormalizationSettings
  onNormalizationStateChange: (isNormalizing: boolean) => void
  playbackSettings: PlaybackSettings
  onError?: (error: ErrorInfo) => void
  onRetryStatus?: (status: string) => void
  autoSkipOnError?: boolean
}

/**
 * Get audio URL for a track
 */
function getAudioUrl(track: Track): string | null {
  let audioUrl = track.stream_url || track.preview_url

  // Handle YouTube tracks
  if (track.platform === 'youtube' && track.videoId) {
    const testAudio = new Audio()
    const flacSupported = testAudio.canPlayType('audio/flac')
    audioUrl = flacSupported
      ? `/api/audio/download?videoId=${track.videoId}&format=flac`
      : `/api/audio/download?videoId=${track.videoId}&format=mp3`
  }

  // Handle SoundCloud tracks
  if (track.platform === 'soundcloud' && track.permalink_url && !audioUrl?.includes('/api/soundcloud/stream')) {
    audioUrl = `/api/soundcloud/stream?url=${encodeURIComponent(track.permalink_url)}`
  }

  return audioUrl || null
}

/**
 * Audio player component with crossfade and gapless playback support
 * Uses Web Audio API for precise volume control and dual audio elements for seamless transitions
 */
export function Player({
  track,
  nextTrack,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrevious,
  onTimeUpdate,
  onDurationChange,
  volume,
  onVolumeChange,
  seekTo,
  crossfadeSettings,
  onCrossfadeStateChange,
  normalizationSettings,
  onNormalizationStateChange,
  playbackSettings,
  onError,
  onRetryStatus,
  autoSkipOnError = true,
}: PlayerProps) {
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const nextAudioRef = useRef<HTMLAudioElement | null>(null)
  const currentGainNodeRef = useRef<GainNode | null>(null)
  const nextGainNodeRef = useRef<GainNode | null>(null)
  const currentBassFilterRef = useRef<BiquadFilterNode | null>(null)
  const currentMidFilterRef = useRef<BiquadFilterNode | null>(null)
  const currentTrebleFilterRef = useRef<BiquadFilterNode | null>(null)
  const currentSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const nextSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const preloadTriggeredRef = useRef(false)
  const crossfadeStartedRef = useRef(false)
  const isManualSkipRef = useRef(false)
  const crossfadeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const performCrossfadeRef = useRef<((fadePoints: ReturnType<typeof calculateFadePoints>, context: AudioContext) => void) | null>(null)
  const startCrossfadeRef = useRef<((currentTime: number, duration: number) => Promise<void>) | null>(null)
  const nextTrackIdRef = useRef<string | null>(null)
  const analyserNodeRef = useRef<AnalyserNode | null>(null)
  const normalizationCacheRef = useRef<Map<string, number>>(new Map()) // trackId -> gainAdjustment (dB)
  const baseVolumeRef = useRef<number>(1.0) // Base volume before normalization
  const normalizationGainRef = useRef<number>(0) // Current normalization gain in dB
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isRetryingRef = useRef(false)

  // Initialize AudioContext
  const initializeAudioContext = useCallback(async (): Promise<AudioContext | null> => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      return audioContextRef.current
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      audioContextRef.current = new AudioContextClass({ sampleRate: 44100 })
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }
      
      return audioContextRef.current
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error)
      return null
    }
  }, [])

  // Create audio source and connect to AudioContext
  const createAudioSource = useCallback(
    async (audioElement: HTMLAudioElement, isNext: boolean = false): Promise<void> => {
      const context = await initializeAudioContext()
      if (!context) return

      const sourceNode = context.createMediaElementSource(audioElement)
      const gainNode = context.createGain()
      gainNode.gain.value = isNext ? 0 : volume // Next track starts at 0 volume

      // Create analyser node for normalization (only for current track)
      if (!isNext && !analyserNodeRef.current) {
        const analyser = context.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.8
        analyserNodeRef.current = analyser
      }

      // Create EQ filters for current track
      if (!isNext) {
        if (!currentBassFilterRef.current) {
          const bassFilter = context.createBiquadFilter()
          bassFilter.type = 'lowshelf'
          bassFilter.frequency.value = 200
          bassFilter.gain.value = 0
          currentBassFilterRef.current = bassFilter
        }
        if (!currentMidFilterRef.current) {
          const midFilter = context.createBiquadFilter()
          midFilter.type = 'peaking'
          midFilter.frequency.value = 1000
          midFilter.Q.value = 1.0
          midFilter.gain.value = 0
          currentMidFilterRef.current = midFilter
        }
        if (!currentTrebleFilterRef.current) {
          const trebleFilter = context.createBiquadFilter()
          trebleFilter.type = 'highshelf'
          trebleFilter.frequency.value = 4000
          trebleFilter.gain.value = 0
          currentTrebleFilterRef.current = trebleFilter
        }
      }

      // Connect audio graph: source → gain → bass → mid → treble → analyser → destination
      sourceNode.connect(gainNode)
      if (!isNext && currentBassFilterRef.current && currentMidFilterRef.current && currentTrebleFilterRef.current) {
        gainNode.connect(currentBassFilterRef.current)
        currentBassFilterRef.current.connect(currentMidFilterRef.current)
        currentMidFilterRef.current.connect(currentTrebleFilterRef.current)
        if (analyserNodeRef.current) {
          currentTrebleFilterRef.current.connect(analyserNodeRef.current)
          analyserNodeRef.current.connect(context.destination)
        } else {
          currentTrebleFilterRef.current.connect(context.destination)
        }
      } else if (analyserNodeRef.current && !isNext) {
        gainNode.connect(analyserNodeRef.current)
        analyserNodeRef.current.connect(context.destination)
      } else {
        gainNode.connect(context.destination)
      }

      if (isNext) {
        nextSourceNodeRef.current = sourceNode
        nextGainNodeRef.current = gainNode
      } else {
        currentSourceNodeRef.current = sourceNode
        currentGainNodeRef.current = gainNode
      }
    },
    [initializeAudioContext, volume]
  )

  // Load current track
  useEffect(() => {
    if (!track || !currentAudioRef.current) {
      // Cleanup if no track - release audio buffers
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current.src = ''
        // Clear audio buffer by removing source
        currentAudioRef.current.load()
      }
      if (nextAudioRef.current) {
        nextAudioRef.current.pause()
        nextAudioRef.current.src = ''
        nextAudioRef.current.load()
      }
      if (currentSourceNodeRef.current) {
        try {
          currentSourceNodeRef.current.disconnect()
        } catch (e) {
          // Ignore disconnect errors
        }
        currentSourceNodeRef.current = null
      }
      if (nextSourceNodeRef.current) {
        try {
          nextSourceNodeRef.current.disconnect()
        } catch (e) {
          // Ignore disconnect errors
        }
        nextSourceNodeRef.current = null
      }
      if (currentGainNodeRef.current) {
        try {
          currentGainNodeRef.current.disconnect()
        } catch (e) {
          // Ignore disconnect errors
        }
        currentGainNodeRef.current = null
      }
      if (nextGainNodeRef.current) {
        try {
          nextGainNodeRef.current.disconnect()
        } catch (e) {
          // Ignore disconnect errors
        }
        nextGainNodeRef.current = null
      }
      return
    }

    // Check if next track is already playing (from crossfade) and matches the new track
    // If so, swap the audio elements instead of loading a new track
    if (
      nextAudioRef.current &&
      nextAudioRef.current.src &&
      nextAudioRef.current.readyState >= 2 &&
      !isManualSkipRef.current &&
      nextTrackIdRef.current === track.id
    ) {
      // Next track is already playing and matches the new track - swap elements
      const tempAudio = currentAudioRef.current
      const tempSource = currentSourceNodeRef.current
      const tempGain = currentGainNodeRef.current

      // Swap refs
      currentAudioRef.current = nextAudioRef.current
      currentSourceNodeRef.current = nextSourceNodeRef.current
      currentGainNodeRef.current = nextGainNodeRef.current

      nextAudioRef.current = tempAudio
      nextSourceNodeRef.current = tempSource
      nextGainNodeRef.current = tempGain

      // Clean up old current audio - release buffers
      if (tempAudio) {
        tempAudio.pause()
        tempAudio.src = ''
        tempAudio.load() // Clear audio buffer
      }
      if (tempSource) {
        try {
          tempSource.disconnect()
        } catch (e) {
          // Ignore disconnect errors
        }
      }
      if (tempGain) {
        try {
          tempGain.disconnect()
        } catch (e) {
          // Ignore disconnect errors
        }
      }

      // Reset flags
      preloadTriggeredRef.current = false
      crossfadeStartedRef.current = false
      nextTrackIdRef.current = null
      onCrossfadeStateChange(false)

      // Update duration and time from the now-current audio
      if (currentAudioRef.current) {
        const duration = currentAudioRef.current.duration
        if (duration && !isNaN(duration)) {
          onDurationChange(duration)
        }
        const currentTime = currentAudioRef.current.currentTime
        if (currentTime && !isNaN(currentTime)) {
          onTimeUpdate(currentTime)
        }
      }

      return
    }

    const audio = currentAudioRef.current
    const audioUrl = getAudioUrl(track)

    if (!audioUrl) {
      console.warn('No audio URL available for track:', track.name)
      return
    }

    // Reset flags and cleanup
    preloadTriggeredRef.current = false
    crossfadeStartedRef.current = false
    isManualSkipRef.current = false
    if (crossfadeTimeoutRef.current) {
      clearTimeout(crossfadeTimeoutRef.current)
      crossfadeTimeoutRef.current = null
    }
    onCrossfadeStateChange(false)

    // Clean up existing source node before creating a new one - release buffers
    if (currentSourceNodeRef.current) {
      try {
        currentSourceNodeRef.current.disconnect()
      } catch (e) {
        // Ignore disconnect errors
      }
      currentSourceNodeRef.current = null
    }
    if (currentGainNodeRef.current) {
      try {
        currentGainNodeRef.current.disconnect()
      } catch (e) {
        // Ignore disconnect errors
      }
      currentGainNodeRef.current = null
    }
    // Clear audio buffer
    if (audio.src) {
      audio.pause()
      audio.src = ''
      audio.load()
    }
    if (currentBassFilterRef.current) {
      currentBassFilterRef.current.disconnect()
      currentBassFilterRef.current = null
    }
    if (currentMidFilterRef.current) {
      currentMidFilterRef.current.disconnect()
      currentMidFilterRef.current = null
    }
    if (currentTrebleFilterRef.current) {
      currentTrebleFilterRef.current.disconnect()
      currentTrebleFilterRef.current = null
    }
    // Reset normalization
    normalizationGainRef.current = 0
    baseVolumeRef.current = volume

    // Set up event listeners
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        onDurationChange(audio.duration)
      }
    }

    const handleTimeUpdate = () => {
      if (!isNaN(audio.currentTime)) {
        onTimeUpdate(audio.currentTime)

        const duration = audio.duration
        if (duration && duration > 0) {
          // Check for preload trigger (80%)
          if (
            !preloadTriggeredRef.current &&
            nextTrack &&
            shouldPreload(audio.currentTime, duration)
          ) {
            preloadTriggeredRef.current = true
            // Preload next track
            if (nextAudioRef.current) {
              const nextUrl = getAudioUrl(nextTrack)
              if (nextUrl) {
                nextTrackIdRef.current = nextTrack.id
                nextAudioRef.current.src = nextUrl
                nextAudioRef.current.load()
                nextAudioRef.current.preload = 'auto'
              }
            }
          }

          // Check for crossfade start
          if (
            crossfadeSettings.enabled &&
            !crossfadeStartedRef.current &&
            nextTrack &&
            shouldStartCrossfade(audio.currentTime, duration, crossfadeSettings.duration)
          ) {
            crossfadeStartedRef.current = true
            onCrossfadeStateChange(true)
            if (startCrossfadeRef.current) {
              startCrossfadeRef.current(audio.currentTime, duration)
            }
          }
        }
      }
    }

    const handleEnded = () => {
      if (!isManualSkipRef.current) {
        // If crossfade was active, it should have already triggered onNext
        if (!crossfadeStartedRef.current) {
          onNext()
        }
      }
      onCrossfadeStateChange(false)
    }

    const handleError = async (e: Event) => {
      if (!track || !audio) return

      // Clear any existing retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }

      // Handle error with retry logic
      const errorInfo = errorHandler.handleAudioError(e, audio, track)
      
      if (onError) {
        onError(errorInfo)
      }

      // Check if error is retryable
      if (!errorHandler.isRetryable(errorInfo)) {
        // Non-retryable error - skip if auto-skip is enabled
        if (autoSkipOnError) {
          setTimeout(() => {
            onNext()
          }, 1000)
        }
        return
      }

      // Retry loading the audio
      isRetryingRef.current = true
      const audioUrl = getAudioUrl(track)
      if (!audioUrl) return

      try {
        await errorHandler.retry(
          async () => {
            return new Promise<void>((resolve, reject) => {
              // Clear previous error handlers
              const tempAudio = new Audio()
              tempAudio.crossOrigin = 'anonymous'
              
              const cleanup = () => {
                tempAudio.removeEventListener('canplay', onCanPlay)
                tempAudio.removeEventListener('error', onError)
              }

              const onCanPlay = () => {
                cleanup()
                resolve()
              }

              const onError = (err: Event) => {
                cleanup()
                const mediaError = (err.target as HTMLAudioElement)?.error
                reject({
                  code: mediaError?.code,
                  message: mediaError?.message || 'Audio load failed',
                })
              }

              tempAudio.addEventListener('canplay', onCanPlay, { once: true })
              tempAudio.addEventListener('error', onError, { once: true })
              
              tempAudio.src = audioUrl
              tempAudio.load()
              
              // Timeout after 10 seconds
              setTimeout(() => {
                cleanup()
                reject(new Error('Load timeout'))
              }, 10000)
            })
          },
          track,
          (attempt) => {
            const status = errorHandler.getRetryStatusMessage(attempt, 3)
            if (onRetryStatus) {
              onRetryStatus(status)
            }
          }
        )

        // Retry successful - reload the audio
        audio.src = audioUrl
        audio.load()
        isRetryingRef.current = false
        if (onRetryStatus) {
          onRetryStatus('')
        }
      } catch (retryError) {
        // All retries failed
        isRetryingRef.current = false
        if (onRetryStatus) {
          onRetryStatus('')
        }
        
        // Auto-skip if enabled
        if (autoSkipOnError) {
          setTimeout(() => {
            onNext()
          }, 1000)
        }
      }
    }

    const handleCanPlay = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        onDurationChange(audio.duration)
      }
    }

    // Normalize track volume
    const applyNormalization = async () => {
      if (!track || !currentGainNodeRef.current) {
        return
      }

      // If normalization is disabled, reset gain
      if (!normalizationSettings.enabled) {
        normalizationGainRef.current = 0
        applyNormalizationGain(0)
        return
      }

      // Check cache first
      const cachedGain = normalizationCacheRef.current.get(track.id)
      if (cachedGain !== undefined) {
        normalizationGainRef.current = cachedGain
        applyNormalizationGain(cachedGain)
        return
      }

      // Check for ReplayGain metadata
      const replayGain = checkReplayGain(track)
      if (replayGain) {
        const gainDb = calculateGainAdjustment(
          null,
          normalizationSettings.targetLUFS,
          normalizationSettings.preventClipping,
          replayGain
        )
        normalizationGainRef.current = gainDb
        normalizationCacheRef.current.set(track.id, gainDb)
        applyNormalizationGain(gainDb)
        return
      }

      // Analyze track volume if analyser is available
      if (analyserNodeRef.current && audio.readyState >= 2) {
        onNormalizationStateChange(true)
        try {
          const currentLUFS = await analyzeTrackVolume(analyserNodeRef.current, audio)
          const gainDb = calculateGainAdjustment(
            currentLUFS,
            normalizationSettings.targetLUFS,
            normalizationSettings.preventClipping,
            null
          )
          normalizationGainRef.current = gainDb
          normalizationCacheRef.current.set(track.id, gainDb)
          applyNormalizationGain(gainDb)
        } catch (error) {
          console.error('Failed to analyze track volume:', error)
          normalizationGainRef.current = 0
        } finally {
          onNormalizationStateChange(false)
        }
      }
    }

    // Apply normalization gain to gain node
    const applyNormalizationGain = (gainDb: number) => {
      if (!currentGainNodeRef.current) return

      // Convert dB gain to linear gain
      const linearGain = dbToLinear(gainDb)
      
      // Apply normalization: baseVolume * normalizationGain
      // The gain node already has the base volume, so we multiply by normalization
      const context = audioContextRef.current
      if (context) {
        const now = context.currentTime
        currentGainNodeRef.current.gain.cancelScheduledValues(now)
        currentGainNodeRef.current.gain.setValueAtTime(baseVolumeRef.current * linearGain, now)
      }
    }

    // Set audio source
    audio.src = audioUrl
    audio.load()

    // Apply playback settings function
    const applyPlaybackSettings = () => {
      if (!audio) return
      
      // Apply playback speed and pitch
      // Combine speed and pitch: finalRate = speed * 2^(pitch/12)
      const pitchRatio = Math.pow(2, playbackSettings.pitch / 12)
      audio.playbackRate = playbackSettings.speed * pitchRatio
      
      // Apply equalizer (will be applied when AudioProcessor is ready)
      // We'll apply it in a separate useEffect
    }
    
    // Create audio source node
    createAudioSource(audio, false)
      .then(() => {
        // Apply normalization after source is created
        if (audio.readyState >= 2) {
          applyNormalization()
        } else {
          audio.addEventListener('canplay', () => applyNormalization(), { once: true })
        }
        
        // Apply playback settings
        applyPlaybackSettings()
        
        // Also apply EQ settings after filters are created
        if (currentBassFilterRef.current && currentMidFilterRef.current && currentTrebleFilterRef.current) {
          const context = audioContextRef.current
          if (context) {
            const now = context.currentTime
            currentBassFilterRef.current.gain.setTargetAtTime(
              Math.max(-12, Math.min(12, playbackSettings.equalizer.bass)),
              now,
              0.01
            )
            currentMidFilterRef.current.gain.setTargetAtTime(
              Math.max(-12, Math.min(12, playbackSettings.equalizer.mid)),
              now,
              0.01
            )
            currentTrebleFilterRef.current.gain.setTargetAtTime(
              Math.max(-12, Math.min(12, playbackSettings.equalizer.treble)),
              now,
              0.01
            )
          }
        }
      })
      .catch(console.error)

    // Add event listeners
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    // Cleanup function - release audio buffers
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.pause()
      audio.src = ''
      audio.load() // Clear audio buffer

      // Clean up audio nodes if memory is high
      if (needsMemoryCleanup()) {
        if (currentSourceNodeRef.current) {
          try {
            currentSourceNodeRef.current.disconnect()
          } catch (e) {
            // Ignore disconnect errors
          }
          currentSourceNodeRef.current = null
        }
        if (nextSourceNodeRef.current) {
          try {
            nextSourceNodeRef.current.disconnect()
          } catch (e) {
            // Ignore disconnect errors
          }
          nextSourceNodeRef.current = null
        }
      }
    }
  }, [track, nextTrack, crossfadeSettings, normalizationSettings, onDurationChange, onTimeUpdate, onNext, onCrossfadeStateChange, onNormalizationStateChange, createAudioSource, volume])

  // Re-apply normalization when settings change
  useEffect(() => {
    if (track && currentGainNodeRef.current) {
      // Re-check normalization
      const applyNormalization = async () => {
        if (!normalizationSettings.enabled) {
          normalizationGainRef.current = 0
          applyNormalizationGain(0)
          return
        }

        // Check cache first
        const cachedGain = normalizationCacheRef.current.get(track.id)
        if (cachedGain !== undefined) {
          normalizationGainRef.current = cachedGain
          applyNormalizationGain(cachedGain)
          return
        }

        // Check for ReplayGain metadata
        const replayGain = checkReplayGain(track)
        if (replayGain) {
          const gainDb = calculateGainAdjustment(
            null,
            normalizationSettings.targetLUFS,
            normalizationSettings.preventClipping,
            replayGain
          )
          normalizationGainRef.current = gainDb
          normalizationCacheRef.current.set(track.id, gainDb)
          applyNormalizationGain(gainDb)
        }
      }

      const applyNormalizationGain = (gainDb: number) => {
        if (!currentGainNodeRef.current) return
        const linearGain = dbToLinear(gainDb)
        const context = audioContextRef.current
        if (context) {
          const now = context.currentTime
          currentGainNodeRef.current.gain.cancelScheduledValues(now)
          currentGainNodeRef.current.gain.setValueAtTime(baseVolumeRef.current * linearGain, now)
        }
      }

      applyNormalization()
    }
  }, [normalizationSettings, track])

  // Apply playback settings when they change
  useEffect(() => {
    if (!currentAudioRef.current) return
    
    const audio = currentAudioRef.current
    
    // Apply playback speed and pitch
    // Combine speed and pitch: finalRate = speed * 2^(pitch/12)
    const pitchRatio = Math.pow(2, playbackSettings.pitch / 12)
    audio.playbackRate = playbackSettings.speed * pitchRatio
    
    // Apply equalizer using our own filters
    const context = audioContextRef.current
    if (context && currentBassFilterRef.current && currentMidFilterRef.current && currentTrebleFilterRef.current) {
      const now = context.currentTime
      currentBassFilterRef.current.gain.setTargetAtTime(
        Math.max(-12, Math.min(12, playbackSettings.equalizer.bass)),
        now,
        0.01
      )
      currentMidFilterRef.current.gain.setTargetAtTime(
        Math.max(-12, Math.min(12, playbackSettings.equalizer.mid)),
        now,
        0.01
      )
      currentTrebleFilterRef.current.gain.setTargetAtTime(
        Math.max(-12, Math.min(12, playbackSettings.equalizer.treble)),
        now,
        0.01
      )
    }
  }, [playbackSettings])

  // Perform the actual crossfade
  const performCrossfade = useCallback(
    (fadePoints: ReturnType<typeof calculateFadePoints>, context: AudioContext) => {
      if (!nextAudioRef.current || !currentGainNodeRef.current) {
        return
      }

      const now = context.currentTime
      const fadeDuration = crossfadeSettings.duration

      // Create next audio source if not already created
      if (!nextSourceNodeRef.current || !nextGainNodeRef.current) {
        createAudioSource(nextAudioRef.current, true).then(() => {
          if (nextGainNodeRef.current && currentGainNodeRef.current) {
            performCrossfade(fadePoints, context)
          }
        })
        return
      }

      // Start next track at 0 volume (gapless)
      nextAudioRef.current.currentTime = 0
      const nextPlayPromise = nextAudioRef.current.play()
      if (nextPlayPromise) {
        nextPlayPromise.catch((error: any) => {
          if (error.name !== 'AbortError') {
            console.error('Next track play error:', error)
          }
        })
      }

      // Fade out current track
      // Apply normalization gain: volume * normalizationGain
      const normalizationGain = dbToLinear(normalizationGainRef.current)
      const currentVolumeWithNormalization = volume * normalizationGain
      currentGainNodeRef.current.gain.cancelScheduledValues(now)
      currentGainNodeRef.current.gain.setValueAtTime(currentVolumeWithNormalization, now)
      currentGainNodeRef.current.gain.linearRampToValueAtTime(0, now + fadeDuration)

      // Fade in next track
      // Apply normalization gain: volume * normalizationGain
      // Note: Next track's normalization will be recalculated when it becomes current,
      // but use current normalizationGain for consistent crossfade
      const nextVolumeWithNormalization = volume * normalizationGain
      nextGainNodeRef.current.gain.cancelScheduledValues(now)
      nextGainNodeRef.current.gain.setValueAtTime(0, now)
      nextGainNodeRef.current.gain.linearRampToValueAtTime(nextVolumeWithNormalization, now + fadeDuration)

      // Switch to next track after fade completes
      if (crossfadeTimeoutRef.current) {
        clearTimeout(crossfadeTimeoutRef.current)
      }
      crossfadeTimeoutRef.current = setTimeout(() => {
        // Current track should already be faded out
        if (currentAudioRef.current) {
          currentAudioRef.current.pause()
          currentAudioRef.current.currentTime = 0
          // Clean up current source node
          if (currentSourceNodeRef.current) {
            currentSourceNodeRef.current.disconnect()
            currentSourceNodeRef.current = null
          }
          if (currentGainNodeRef.current) {
            currentGainNodeRef.current.disconnect()
            currentGainNodeRef.current = null
          }
        }
        // Next track is now playing at full volume - trigger track switch
        // This will cause the next track to become the current track
        onNext()
        onCrossfadeStateChange(false)
        crossfadeStartedRef.current = false
      }, fadeDuration * 1000)
    },
    [crossfadeSettings.duration, volume, createAudioSource, onNext, onCrossfadeStateChange]
  )

  // Store performCrossfade in ref for use in startCrossfade
  performCrossfadeRef.current = performCrossfade

  // Start crossfade transition
  const startCrossfade = useCallback(
    async (currentTime: number, duration: number) => {
      if (!nextTrack || !nextAudioRef.current) {
        return
      }

      const fadePoints = calculateFadePoints(duration, crossfadeSettings.duration)
      if (!fadePoints.canCrossfade) {
        // Track too short for crossfade, use gapless playback
        return
      }

      const context = await initializeAudioContext()
      if (!context) return

      // Ensure next audio is loaded and ready
      const ensureNextReady = async () => {
        if (!nextAudioRef.current) return

        // Wait for next track to be ready
        if (nextAudioRef.current.readyState < 2) {
          await new Promise<void>((resolve) => {
            const checkReady = () => {
              if (nextAudioRef.current && nextAudioRef.current.readyState >= 2) {
                resolve()
              } else {
                setTimeout(checkReady, 50)
              }
            }
            checkReady()
          })
        }

        if (performCrossfadeRef.current) {
          performCrossfadeRef.current(fadePoints, context)
        }
      }

      ensureNextReady()
    },
    [nextTrack, crossfadeSettings.duration, initializeAudioContext]
  )

  // Store startCrossfade in ref for use in useEffect
  startCrossfadeRef.current = startCrossfade


  // Handle play/pause
  useEffect(() => {
    if (!currentAudioRef.current) return

    const audio = currentAudioRef.current

    if (isPlaying) {
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.catch(async (error: any) => {
          if (error.name !== 'AbortError' && track) {
            // Handle play error with retry
            const errorInfo: ErrorInfo = {
              type: 'unknown',
              message: 'Playback failed. Retrying...',
              severity: 'warning',
              timestamp: Date.now(),
              track,
              retryCount: 0,
            }
            
            if (onError) {
              onError(errorInfo)
            }

            // Retry play after a short delay
            try {
              await errorHandler.retry(
                async () => {
                  const retryPlayPromise = audio.play()
                  if (retryPlayPromise) {
                    await retryPlayPromise
                  }
                },
                track,
                (attempt) => {
                  const status = errorHandler.getRetryStatusMessage(attempt, 3)
                  if (onRetryStatus) {
                    onRetryStatus(status)
                  }
                }
              )
              if (onRetryStatus) {
                onRetryStatus('')
              }
            } catch (retryError) {
              // All retries failed
              if (onRetryStatus) {
                onRetryStatus('')
              }
              if (autoSkipOnError) {
                setTimeout(() => {
                  onNext()
                }, 1000)
              }
            }
          }
        })
      }
    } else {
      audio.pause()
      if (nextAudioRef.current) {
        nextAudioRef.current.pause()
      }
    }
  }, [isPlaying, track, onError, onRetryStatus, autoSkipOnError, onNext])

  // Handle volume changes
  useEffect(() => {
    baseVolumeRef.current = volume
    
    if (currentGainNodeRef.current) {
      // Apply volume with normalization gain
      const normalizationGain = dbToLinear(normalizationGainRef.current)
      const finalVolume = volume * normalizationGain
      
      if (!crossfadeStartedRef.current) {
        const context = audioContextRef.current
        if (context) {
          const now = context.currentTime
          currentGainNodeRef.current.gain.cancelScheduledValues(now)
          currentGainNodeRef.current.gain.setValueAtTime(finalVolume, now)
        }
      }
    }
    if (nextGainNodeRef.current && crossfadeStartedRef.current) {
      // During crossfade, adjust target volume (next track doesn't have normalization yet)
      const context = audioContextRef.current
      if (context) {
        const now = context.currentTime
        const remainingFade = crossfadeSettings.duration - (currentAudioRef.current?.currentTime || 0)
        if (remainingFade > 0) {
          nextGainNodeRef.current.gain.linearRampToValueAtTime(volume, now + remainingFade)
        } else {
          nextGainNodeRef.current.gain.value = volume
        }
      }
    }
  }, [volume, crossfadeSettings.duration])

  // Handle seeking
  useEffect(() => {
    if (!currentAudioRef.current || seekTo === undefined) return

    isManualSkipRef.current = true
    onCrossfadeStateChange(false)
    crossfadeStartedRef.current = false

    // Cancel crossfade if in progress
    if (nextAudioRef.current) {
      nextAudioRef.current.pause()
      nextAudioRef.current.currentTime = 0
      if (nextGainNodeRef.current) {
        nextGainNodeRef.current.gain.value = 0
      }
    }

    // Reset current track volume
    if (currentGainNodeRef.current) {
      currentGainNodeRef.current.gain.value = volume
    }

    currentAudioRef.current.currentTime = seekTo
    isManualSkipRef.current = false
  }, [seekTo, volume, onCrossfadeStateChange])

  // Handle manual skip (next/previous buttons) - cancel crossfade
  useEffect(() => {
    isManualSkipRef.current = true
    onCrossfadeStateChange(false)
    crossfadeStartedRef.current = false

    // Cancel crossfade timeout
    if (crossfadeTimeoutRef.current) {
      clearTimeout(crossfadeTimeoutRef.current)
      crossfadeTimeoutRef.current = null
    }

    // Cancel crossfade if in progress
    if (nextAudioRef.current) {
      nextAudioRef.current.pause()
      nextAudioRef.current.currentTime = 0
      if (nextGainNodeRef.current) {
        nextGainNodeRef.current.gain.value = 0
      }
    }

    // Reset current track volume
    if (currentGainNodeRef.current && audioContextRef.current) {
      const now = audioContextRef.current.currentTime
      currentGainNodeRef.current.gain.cancelScheduledValues(now)
      currentGainNodeRef.current.gain.setValueAtTime(volume, now)
    }

    // Reset flag after a short delay
    setTimeout(() => {
      isManualSkipRef.current = false
    }, 100)
  }, [track, volume, onCrossfadeStateChange])

  // Cleanup on unmount - release all audio buffers and resources
  useEffect(() => {
    return () => {
      // Clean up audio elements
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current.src = ''
        currentAudioRef.current.load()
      }
      if (nextAudioRef.current) {
        nextAudioRef.current.pause()
        nextAudioRef.current.src = ''
        nextAudioRef.current.load()
      }

      // Clean up audio nodes
      if (currentSourceNodeRef.current) {
        try {
          currentSourceNodeRef.current.disconnect()
        } catch (e) {
          // Ignore disconnect errors
        }
      }
      if (nextSourceNodeRef.current) {
        try {
          nextSourceNodeRef.current.disconnect()
        } catch (e) {
          // Ignore disconnect errors
        }
      }
      if (currentGainNodeRef.current) {
        try {
          currentGainNodeRef.current.disconnect()
        } catch (e) {
          // Ignore disconnect errors
        }
      }
      if (nextGainNodeRef.current) {
        try {
          nextGainNodeRef.current.disconnect()
        } catch (e) {
          // Ignore disconnect errors
        }
      }
      if (currentBassFilterRef.current) {
        try {
          currentBassFilterRef.current.disconnect()
        } catch (e) {
          // Ignore disconnect errors
        }
      }
      if (currentMidFilterRef.current) {
        try {
          currentMidFilterRef.current.disconnect()
        } catch (e) {
          // Ignore disconnect errors
        }
      }
      if (currentTrebleFilterRef.current) {
        try {
          currentTrebleFilterRef.current.disconnect()
        } catch (e) {
          // Ignore disconnect errors
        }
      }
      if (analyserNodeRef.current) {
        try {
          analyserNodeRef.current.disconnect()
        } catch (e) {
          // Ignore disconnect errors
        }
      }

      // Close audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error)
      }

      // Clear normalization cache if memory is high
      if (needsMemoryCleanup() && normalizationCacheRef.current.size > 50) {
        normalizationCacheRef.current.clear()
      }
    }
  }, [])

  return (
    <>
      <audio
        ref={currentAudioRef}
        preload="metadata"
        crossOrigin="anonymous"
        style={{ display: 'none' }}
      />
      <audio
        ref={nextAudioRef}
        preload="none"
        crossOrigin="anonymous"
        style={{ display: 'none' }}
      />
    </>
  )
}
