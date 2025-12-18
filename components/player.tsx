'use client'

import { useEffect, useRef } from 'react'
import type {
  Track,
  CrossfadeSettings,
  NormalizationSettings,
  PlaybackSettings,
} from '@/lib/types'
import type { ErrorInfo } from '@/lib/error-handler'

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

// Resolve the most appropriate audio URL for a track
const resolveAudioUrl = (track: Track | null): string | null => {
  if (!track) return null
  // The search layer already sets `stream_url` for YouTube and SoundCloud when available,
  // and `preview_url` for Spotify previews.
  return track.stream_url || track.preview_url || null
}

export const Player = ({
  track,
  nextTrack, // currently unused but kept for API compatibility
  isPlaying,
  onTogglePlay, // not used internally; controlled from parent
  onNext,
  onPrevious, // reserved for future enhancements
  onTimeUpdate,
  onDurationChange,
  volume,
  onVolumeChange, // reserved for future enhancements
  seekTo,
  crossfadeSettings,
  onCrossfadeStateChange,
  normalizationSettings,
  onNormalizationStateChange,
  playbackSettings,
  onError,
  onRetryStatus,
  autoSkipOnError = true,
}: PlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Load track when it changes
  useEffect(() => {
    const audio = audioRef.current
    const url = resolveAudioUrl(track)

    onCrossfadeStateChange(false)
    onNormalizationStateChange(false)

    if (!audio || !track || !url) {
      if (audio) {
        audio.pause()
        audio.src = ''
      }
      return
    }

    audio.src = url
    audio.load()

    const handleLoadedMetadata = () => {
      if (!isNaN(audio.duration)) {
        onDurationChange(audio.duration)
      }
    }

    const handleTimeUpdate = () => {
      if (!isNaN(audio.currentTime)) {
        onTimeUpdate(audio.currentTime)
      }
    }

    const handleEnded = () => {
      onNext()
    }

    const handleError = () => {
      const mediaError = audio.error
      const errorCodes: Record<number, string> = {
        1: 'MEDIA_ERR_ABORTED',
        2: 'MEDIA_ERR_NETWORK', 
        3: 'MEDIA_ERR_DECODE',
        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
      }
      const errorType = mediaError?.code ? errorCodes[mediaError.code] : 'unknown'
      const message = mediaError?.message || `Playback error: ${errorType}`
      if (onError && track) {
        const errorInfo: ErrorInfo = {
          type: errorType as ErrorInfo['type'],
          message,
          severity: 'error',
          timestamp: Date.now(),
          track,
        }
        onError(errorInfo)
      }
      if (autoSkipOnError) {
        if (onRetryStatus) {
          onRetryStatus('')
        }
        onNext()
      }
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [
    track,
    onDurationChange,
    onTimeUpdate,
    onNext,
    autoSkipOnError,
    onError,
    onRetryStatus,
    onCrossfadeStateChange,
    onNormalizationStateChange,
  ])

  // Play / pause when `isPlaying` changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      const playPromise = audio.play()
      if (playPromise) {
        playPromise.catch(() => {
          // Autoplay restrictions or similar; parent already controls UI state
        })
      }
    } else {
      audio.pause()
    }
  }, [isPlaying])

  // Apply volume
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = Math.max(0, Math.min(1, volume))
  }, [volume])

  // Handle seek
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || seekTo === undefined) return
    if (!isNaN(seekTo)) {
      audio.currentTime = seekTo
    }
  }, [seekTo])

  // Basic playback-rate support (speed & pitch combined)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const pitchRatio = Math.pow(2, playbackSettings.pitch / 12)
    audio.playbackRate = playbackSettings.speed * pitchRatio
  }, [playbackSettings])

  return (
    <audio
      ref={audioRef}
      preload="metadata"
      crossOrigin="anonymous"
      className="hidden"
    />
  )
}


