'use client'

import { useEffect, useRef, useState } from 'react'
import type { ParsedLyrics, LyricsLine } from '@/lib/lyrics-api'

interface LyricsPanelProps {
  isOpen: boolean
  onClose: () => void
  lyrics: ParsedLyrics | null
  currentTime: number
  onSeek?: (time: number) => void
  isLoading?: boolean
  trackName?: string
  artistName?: string
  geniusUrl?: string
}

/**
 * Lyrics panel component with synchronized scrolling
 */
export function LyricsPanel({
  isOpen,
  onClose,
  lyrics,
  currentTime,
  onSeek,
  isLoading = false,
  trackName,
  artistName,
  geniusUrl,
}: LyricsPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const currentLineRef = useRef<HTMLDivElement | null>(null)
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1)

  // Find current line based on playback time
  useEffect(() => {
    if (!lyrics || !lyrics.isTimestamped || lyrics.lines.length === 0) {
      setCurrentLineIndex(-1)
      return
    }

    // Find the line that should be playing at currentTime
    let lineIndex = -1
    for (let i = 0; i < lyrics.lines.length; i++) {
      const line = lyrics.lines[i]
      if (line.timestamp !== undefined && line.timestamp <= currentTime) {
        lineIndex = i
      } else {
        break
      }
    }

    setCurrentLineIndex(lineIndex)
  }, [currentTime, lyrics])

  // Auto-scroll to current line
  useEffect(() => {
    if (currentLineRef.current && isOpen) {
      // Scroll to current line with smooth behavior
      currentLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [currentLineIndex, isOpen])

  // Handle line click for seeking (timestamped lyrics only)
  const handleLineClick = (line: LyricsLine) => {
    if (lyrics?.isTimestamped && line.timestamp !== undefined && onSeek) {
      onSeek(line.timestamp)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <>
      {/* Overlay */}
      <div className="lyrics-overlay" onClick={onClose}></div>

      {/* Lyrics Panel */}
      <div className={`lyrics-panel ${isOpen ? 'open' : ''}`}>
        <div className="lyrics-panel-header">
          <h3 className="lyrics-panel-title">Lyrics</h3>
          <button
            type="button"
            className="lyrics-panel-close"
            onClick={onClose}
            aria-label="Close lyrics panel"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="lyrics-panel-content" ref={containerRef}>
          {isLoading && (
            <div className="lyrics-loading">
              <i className="fas fa-spinner fa-spin"></i>
              <p>Loading lyrics...</p>
            </div>
          )}

          {!isLoading && !lyrics && (
            <div className="lyrics-not-found">
              <i className="fas fa-music"></i>
              <p>Lyrics not available</p>
              {geniusUrl && (
                <a
                  href={geniusUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lyrics-genius-link"
                >
                  Search on Genius
                  <i className="fas fa-external-link-alt"></i>
                </a>
              )}
            </div>
          )}

          {!isLoading && lyrics && (
            <div className="lyrics-lines">
              {lyrics.lines.length === 0 ? (
                <div className="lyrics-not-found">
                  <p>No lyrics available</p>
                </div>
              ) : (
                lyrics.lines.map((line, index) => {
                  const isCurrentLine = index === currentLineIndex && lyrics.isTimestamped
                  const isClickable = lyrics.isTimestamped && line.timestamp !== undefined

                  return (
                    <div
                      key={index}
                      ref={isCurrentLine ? currentLineRef : null}
                      className={`lyrics-line ${isCurrentLine ? 'current' : ''} ${isClickable ? 'clickable' : ''}`}
                      onClick={() => handleLineClick(line)}
                      style={{
                        cursor: isClickable ? 'pointer' : 'default',
                      }}
                    >
                      {line.text || '\u00A0'} {/* Non-breaking space if empty */}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

