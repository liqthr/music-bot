'use client'

import { useEffect, useRef } from 'react'
import type { Track } from '@/lib/types'

interface PlayerProps {
  track: Track | null
  isPlaying: boolean
  onTogglePlay: () => void
  onNext: () => void
  onPrevious: () => void
  onTimeUpdate: (time: number) => void
  onDurationChange: (duration: number) => void
  volume: number
  onVolumeChange: (volume: number) => void
  seekTo?: number
  onError?: (err: Error | Event) => void
}

/**
 * Renders a hidden HTML5 audio element that plays the provided track and forwards playback events.
 */
export function Player({
  track,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrevious,
  onTimeUpdate,
  onDurationChange,
  volume,
  onVolumeChange,
  seekTo,
  onError,
}: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep latest callbacks without re-subscribing audio events.
  const onDurationChangeRef = useRef(onDurationChange)
  const onTimeUpdateRef = useRef(onTimeUpdate)
  const onNextRef = useRef(onNext)
  const onErrorRef = useRef(onError)

  const clearRetryTimer = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }

  useEffect(() => {
    onDurationChangeRef.current = onDurationChange
    onTimeUpdateRef.current = onTimeUpdate
    onNextRef.current = onNext
    onErrorRef.current = onError
  }, [onDurationChange, onTimeUpdate, onNext, onError])

  // Reset retry state whenever the track changes (including to null).
  useEffect(() => {
    retryCountRef.current = 0
    clearRetryTimer()
  }, [track])

  // Load track when it changes
  useEffect(() => {
    if (!track || !audioRef.current) return

    const audio = audioRef.current

    let audioUrl = track.stream_url || track.preview_url

    if (track.platform === 'youtube' && track.videoId) {
      audioUrl = `/api/audio/download?videoId=${track.videoId}&format=flac`
    }

    if (track.platform === 'soundcloud' && track.permalink_url && !audioUrl) {
      audioUrl = `/api/soundcloud/stream?url=${encodeURIComponent(track.permalink_url)}`
    }

    if (!audioUrl) {
      console.warn('No audio URL available for track:', track.name)
      return
    }

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        onDurationChangeRef.current?.(audio.duration)
      }
    }

    const handleTimeUpdate = () => {
      if (!isNaN(audio.currentTime)) {
        onTimeUpdateRef.current?.(audio.currentTime)
      }
    }

    const handleEnded = () => {
      onNextRef.current?.()
    }

    let isCancelled = false

    const handleError = (e: Event) => {
      const errorTarget = e.target as HTMLAudioElement | null
      const mediaError = errorTarget?.error

      let message = 'Audio playback error.'
      if (mediaError) {
        switch (mediaError.code) {
          case mediaError.MEDIA_ERR_ABORTED:
            message = 'Playback aborted.'
            break
          case mediaError.MEDIA_ERR_NETWORK:
            message = 'Network error while downloading audio.'
            break
          case mediaError.MEDIA_ERR_DECODE:
            message = 'Audio decoding error.'
            break
          case mediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            message = 'Audio source not supported or not found.'
            break
          default:
            message = `Audio error code ${mediaError.code}.`
            break
        }
      }

      console.error('[Player] Audio playback error:', message, mediaError, e)
      onErrorRef.current?.(e instanceof Error ? e : new Error(message))

      const maxRetries = 3
      const attempt = retryCountRef.current + 1

      if (attempt <= maxRetries) {
        retryCountRef.current = attempt
        const delay = Math.min(500 * 2 ** (attempt - 1), 4000)

        clearRetryTimer()
        retryTimerRef.current = setTimeout(() => {
          if (isCancelled || !audioRef.current) return

          audioRef.current.load()
          const playPromise = audioRef.current.play()
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                retryCountRef.current = 0
              })
              .catch((err: any) => {
                if (err?.name !== 'AbortError') {
                  console.error('Retry playback error:', err)
                }
              })
          }
        }, delay)

        return
      }

      onNextRef.current?.()
    }

    const handleCanPlay = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        onDurationChangeRef.current?.(audio.duration)
      }
      retryCountRef.current = 0
    }

    audio.src = audioUrl
    audio.load()

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      isCancelled = true
      clearRetryTimer()
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.pause()
      audio.src = ''
    }
  }, [track])

  useEffect(() => {
    if (!audioRef.current) return

    const audio = audioRef.current

    if (isPlaying) {
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            retryCountRef.current = 0
          })
          .catch((error: any) => {
            if (error.name !== 'AbortError') {
              console.error('Playback error:', error)
            }
          })
      }
    } else {
      audio.pause()
    }
  }, [isPlaying, track])

  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = Math.max(0, Math.min(1, volume))
  }, [volume])

  useEffect(() => {
    if (!audioRef.current || seekTo === undefined) return
    audioRef.current.currentTime = seekTo
  }, [seekTo])

  return (
    <audio
      ref={audioRef}
      preload="metadata"
      crossOrigin="anonymous"
      style={{ display: 'none' }}
    />
  )
}