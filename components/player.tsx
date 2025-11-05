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
}

/**
 * Audio player component using native HTML5 audio
 * Modern browsers support FLAC natively, so no external library is needed
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
}: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Load track when it changes
  useEffect(() => {
    if (!track || !audioRef.current) return

    const audio = audioRef.current

    // Determine audio source
    let audioUrl = track.stream_url || track.preview_url

    if (!audioUrl) {
      console.warn('No audio URL available for track:', track.name)
      return
    }

    // For SoundCloud, resolve stream URL if needed
    if (track.platform === 'soundcloud' && track.permalink_url && !audioUrl.includes('/api/soundcloud/stream')) {
      audioUrl = `/api/soundcloud/stream?url=${encodeURIComponent(track.permalink_url)}`
    }

    // Set up event listeners
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
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

    const handleError = (e: Event) => {
      console.error('Audio playback error:', e)
      // Modern browsers support FLAC natively, so this should work
      // If it fails, the error will be logged for debugging
    }

    const handleCanPlay = () => {
      // Ensure duration is set when audio can play
      if (audio.duration && !isNaN(audio.duration)) {
        onDurationChange(audio.duration)
      }
    }

    // Set audio source
    audio.src = audioUrl
    audio.load()

    // Add event listeners
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    // Cleanup function
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.pause()
      audio.src = ''
    }
  }, [track, onDurationChange, onTimeUpdate, onNext])

  // Handle play/pause
  useEffect(() => {
    if (!audioRef.current) return

    const audio = audioRef.current

    if (isPlaying) {
      audio.play().catch((error) => {
        console.error('Playback error:', error)
      })
    } else {
      audio.pause()
    }
  }, [isPlaying])

  // Handle volume changes
  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = volume
  }, [volume])

  // Handle seeking
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
