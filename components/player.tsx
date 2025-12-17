'use client'

import { useEffect, useRef } from 'react'
import type {
  Track,
  CrossfadeSettings,
  NormalizationSettings,
  PlaybackSettings,
} from '@/lib/types'
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

function getAudioUrl(track: Track): string | null {
  let audioUrl = track.stream_url || track.preview_url

  if (track.platform === 'youtube' && track.videoId) {
    audioUrl = `/api/audio/download?videoId=${track.videoId}&format=mp3`
  }

  if (
    track.platform === 'soundcloud' &&
    track.permalink_url &&
    !audioUrl?.includes('/api/soundcloud/stream')
  ) {
    audioUrl = `/api/soundcloud/stream?url=${encodeURIComponent(track.permalink_url)}`
  }

  return audioUrl || null
}

export function Player({
  track,
  nextTrack, // kept for API compatibility
  isPlaying,
  onTogglePlay, // unused – playback is controlled via props
  onNext,
  onPrevious, // unused here
  onTimeUpdate,
  onDurationChange,
  volume,
  onVolumeChange, // unused – volume is driven by prop
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
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Load new track when it changes
  useEffect(() => {
    const audio = audioRef.current
    onCrossfadeStateChange(false)
    onNormalizationStateChange(false)
    onRetryStatus?.('')

    if (!audio || !track) {
      if (audio) {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      }
      return
    }

    const url = getAudioUrl(track)
    if (!url) {
      console.warn('No audio URL for track:', track.name)
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

    const handleErrorEvent = (e: Event) => {
      const info = errorHandler.handleAudioError(e, audio, track)
      onError?.(info)

      if (!errorHandler.isRetryable(info)) {
        if (autoSkipOnError) {
          setTimeout(onNext, 1000)
        }
        return
      }

      // Simple single retry
      onRetryStatus?.('Retrying playback…')
      audio.load()
      audio
        .play()
        .then(() => {
          onRetryStatus?.('')
        })
        .catch(() => {
          onRetryStatus?.('')
          if (autoSkipOnError) {
            setTimeout(onNext, 1000)
          }
        })
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleErrorEvent)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleErrorEvent)
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

  // Control play / pause
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      const p = audio.play()
      if (p) {
        p.catch(() => {
          // Autoplay might fail; do not spam errors
        })
      }
    } else {
      audio.pause()
    }
  }, [isPlaying])

  // Control volume
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = Math.max(0, Math.min(1, volume))
  }, [volume])

  // Seek when requested
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || seekTo == null) return
    audio.currentTime = seekTo
  }, [seekTo])

  // Apply simple playback speed / pitch control
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
      style={{ display: 'none' }}
    />
  )
}
