'use client'

import { useEffect, useRef, useState } from 'react'
import type { Track } from '@/lib/types'

interface MiniPlayerProps {
  track: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  onTogglePlay: () => void
  onNext: () => void
  onPrevious: () => void
  onExpand: () => void
  onSeek?: (time: number) => void
}

/**
 * Mini player component - compact player bar fixed at bottom
 */
export function MiniPlayer({
  track,
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  onNext,
  onPrevious,
  onExpand,
  onSeek,
}: MiniPlayerProps) {
  const [isPiPSupported, setIsPiPSupported] = useState(false)
  const [isInPiP, setIsInPiP] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  
  const albumArt = track?.album?.images?.[0]?.url || '/placeholder-album.png'

  // Check PiP support
  useEffect(() => {
    if (typeof document !== 'undefined') {
      setIsPiPSupported(
        'pictureInPictureEnabled' in document &&
        document.pictureInPictureEnabled &&
        'requestPictureInPicture' in HTMLVideoElement.prototype
      )
    }
  }, [])

  // Handle Picture-in-Picture
  const handleTogglePiP = async () => {
    if (!isPiPSupported || !track) return

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
        return
      }

      // For audio-only tracks, create a video element with album art
      // Create a canvas with album art to use as video source
      const canvas = document.createElement('canvas')
      canvas.width = 320
      canvas.height = 180
      const ctx = canvas.getContext('2d')
      
      if (!ctx) return

      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      img.onload = async () => {
        // Draw album art on canvas
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // Center and scale image
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
        const x = (canvas.width - img.width * scale) / 2
        const y = (canvas.height - img.height * scale) / 2
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
        
        // Create video element and stream from canvas
        const video = document.createElement('video')
        video.style.width = '320px'
        video.style.height = '180px'
        video.muted = true
        video.playsInline = true
        video.autoplay = true
        video.loop = true
        
        // Convert canvas to video stream
        const stream = canvas.captureStream(30)
        video.srcObject = stream
        
        // Wait for video to be ready
        await video.play()
        
        // Request Picture-in-Picture
        await video.requestPictureInPicture()
        videoRef.current = video
        
        // Clean up when PiP ends
        video.addEventListener('leavepictureinpicture', () => {
          if (video.srcObject) {
            const stream = video.srcObject as MediaStream
            stream.getTracks().forEach((track) => track.stop())
            video.srcObject = null
          }
          video.remove()
          videoRef.current = null
        })
      }
      
      img.onerror = () => {
        console.error('Failed to load album art for PiP')
      }
      
      img.src = albumArt
    } catch (error) {
      console.error('Picture-in-Picture error:', error)
    }
  }

  // Cleanup PiP on unmount
  useEffect(() => {
    return () => {
      // Exit Picture-in-Picture if active
      if (typeof document !== 'undefined' && document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {
          // Ignore errors during cleanup
        })
      }
      
      // Stop MediaStream tracks and clean up video element
      if (videoRef.current) {
        if (videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream
          stream.getTracks().forEach((track) => track.stop())
          videoRef.current.srcObject = null
        }
        // Remove video element from DOM if present
        if (videoRef.current.parentNode) {
          videoRef.current.parentNode.removeChild(videoRef.current)
        }
        videoRef.current = null
      }
    }
  }, [])

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  // Format time
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds === Infinity) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs < 10 ? '0' + secs : secs}`
  }

  // Handle progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    const seekTime = percentage * duration

    onSeek(seekTime)
  }

  if (!track) {
    return null
  }

  const trackName = track.name
  const artistName = track.artists?.[0]?.name || 'Unknown Artist'

  return (
    <>
      {/* Progress bar at top */}
      <div
        className="mini-player-progress-bar"
        onClick={handleProgressClick}
        style={{ cursor: onSeek ? 'pointer' : 'default' }}
      >
        <div
          className="mini-player-progress-fill"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {/* Mini player container */}
      <div className="mini-player" ref={containerRef} onClick={onExpand}>
        <div className="mini-player-content">
          {/* Album art - clickable to expand */}
          <div className="mini-player-art" onClick={onExpand}>
            <img src={albumArt} alt={trackName} />
          </div>

          {/* Track info - clickable to expand */}
          <div className="mini-player-info" onClick={onExpand}>
            <div className="mini-player-track-name">{trackName}</div>
            <div className="mini-player-artist-name">{artistName}</div>
          </div>

          {/* Controls */}
          <div className="mini-player-controls" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="mini-player-btn"
              onClick={onPrevious}
              aria-label="Previous track"
            >
              <i className="fas fa-backward"></i>
            </button>
            <button
              type="button"
              className="mini-player-btn mini-player-play-btn"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
            </button>
            <button
              type="button"
              className="mini-player-btn"
              onClick={onNext}
              aria-label="Next track"
            >
              <i className="fas fa-forward"></i>
            </button>
            {isPiPSupported && (
              <button
                type="button"
                className={`mini-player-btn ${isInPiP ? 'active' : ''}`}
                onClick={handleTogglePiP}
                aria-label={isInPiP ? 'Exit Picture-in-Picture' : 'Enter Picture-in-Picture'}
                title={isInPiP ? 'Exit Picture-in-Picture' : 'Enter Picture-in-Picture'}
              >
                <i className="fas fa-compress-arrows-alt"></i>
              </button>
            )}
          </div>

          {/* Time display */}
          <div className="mini-player-time">
            <span>{formatTime(currentTime)}</span>
            {duration > 0 && <span> / {formatTime(duration)}</span>}
          </div>
        </div>
      </div>
    </>
  )
}

