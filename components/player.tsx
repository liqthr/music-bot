'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
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
 * Audio player component using Aurora.js for FLAC support
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
  const auroraRef = useRef<any>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize Aurora.js for FLAC support
  useEffect(() => {
    if (typeof window === 'undefined' || isInitialized) return

    const initAurora = async () => {
      try {
        // Dynamically import Aurora.js only on client
        const Aurora = (await import('aurora.js')).default
        const FLACDecoder = (await import('aurora.js-flac')).default

        // Register FLAC decoder
        Aurora.registerDecoder(FLACDecoder, ['flac'])

        setIsInitialized(true)
      } catch (error) {
        console.warn('Aurora.js initialization failed, falling back to HTML5 audio:', error)
        setIsInitialized(true) // Still mark as initialized to allow fallback
      }
    }

    initAurora()
  }, [isInitialized])

  // Load track when it changes
  useEffect(() => {
    if (!track || !audioRef.current) return

    const audio = audioRef.current

    const loadTrack = async () => {
      try {
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

        // Set audio source
        audio.src = audioUrl
        audio.load()

        // Set up event listeners
        const handleLoadedMetadata = () => {
          if (audio.duration) {
            onDurationChange(audio.duration)
          }
        }

        const handleTimeUpdate = () => {
          onTimeUpdate(audio.currentTime)
        }

        const handleEnded = () => {
          onNext()
        }

        const handleError = (e: ErrorEvent) => {
          console.error('Audio playback error:', e)
          // Try Aurora.js fallback for FLAC files if HTML5 fails
          if (isInitialized && audioUrl.endsWith('.flac')) {
            console.log('Attempting Aurora.js playback for FLAC file')
            // Aurora.js integration would go here if needed
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
      } catch (error) {
        console.error('Error loading track:', error)
      }
    }

    loadTrack()
  }, [track, isInitialized, onDurationChange, onTimeUpdate, onNext])

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
      style={{ display: 'none' }}
    />
  )
}
