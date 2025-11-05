'use client'

import { useCallback } from 'react'
import type { Track } from '@/lib/types'

interface SearchResultsProps {
  results: Track[]
  onPlay: (track: Track) => void
  onAddToQueue: (track: Track) => void
  isLoading: boolean
}

/**
 * Search results component
 */
export function SearchResults({ results, onPlay, onAddToQueue, isLoading }: SearchResultsProps) {
  const handlePlay = useCallback(
    (track: Track) => {
      onPlay(track)
    },
    [onPlay]
  )

  const handleAddToQueue = useCallback(
    (track: Track) => {
      onAddToQueue(track)
    },
    [onAddToQueue]
  )

  if (isLoading) {
    return (
      <div className="search-results">
        <p className="loading">Searching...</p>
      </div>
    )
  }

  if (results.length === 0) {
    return null
  }

  return (
    <div className="search-results">
      {results.map((track) => {
        const imageUrl = track.album?.images?.[0]?.url || '/images/default.jpg'
        const artistName = track.artists?.[0]?.name || 'Unknown Artist'

        return (
          <div key={track.id} className="result-item">
            <img src={imageUrl} alt={track.name} />
            <div className="song-info">
              <div className="song-title">{track.name}</div>
              <div className="song-artist">
                {artistName}
                <span className={`platform-badge ${track.platform}`}>{track.platform}</span>
              </div>
            </div>
            <div className="song-actions">
              <button
                type="button"
                className="play-now"
                onClick={() => handlePlay(track)}
                aria-label={`Play ${track.name}`}
              >
                Play
              </button>
              <button
                type="button"
                className="add-to-queue"
                onClick={() => handleAddToQueue(track)}
                aria-label={`Add ${track.name} to queue`}
              >
                + Queue
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
