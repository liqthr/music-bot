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
 * Determine whether a track is playable by the current player.
 *
 * Tracks are considered playable if they provide either a `preview_url` or a `stream_url`.
 * (This includes tracks whose `stream_url` is supplied by the download endpoint, e.g., YouTube.)
 *
 * @param track - The track to evaluate for playability
 * @returns `true` if the track has a `preview_url` or `stream_url`, `false` otherwise.
 */
function isTrackPlayable(track: Track): boolean {
  // All tracks with stream_url or preview_url are playable
  // YouTube tracks now have stream_url from our download endpoint
  return !!(track.preview_url || track.stream_url)
}

/**
 * Render a list of track search results with per-track play and queue actions.
 *
 * @param results - Array of tracks to display.
 * @param onPlay - Callback invoked with a track when the user requests playback; it will only be called for tracks that are playable (have a preview or stream URL).
 * @param onAddToQueue - Callback invoked with a track to add it to the queue.
 * @param isLoading - When true, render a "Searching..." placeholder instead of results.
 * @returns The search results container JSX or `null` when there are no results to render.
 */
export function SearchResults({ results, onPlay, onAddToQueue, isLoading }: SearchResultsProps) {
  const handlePlay = useCallback(
    (track: Track) => {
      if (isTrackPlayable(track)) {
        onPlay(track)
      }
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
        const playable = isTrackPlayable(track)

        return (
          <div key={track.id} className="result-item">
            <img src={imageUrl} alt={track.name} />
            <div className="song-info">
              <div className="song-title">{track.name}</div>
              <div className="song-artist">
                {artistName}
                <span className={`platform-badge ${track.platform}`}>{track.platform}</span>
                {!playable && (
                  <span className="unplayable-badge" title="Preview not available">
                    No Preview
                  </span>
                )}
              </div>
            </div>
            <div className="song-actions">
              <button
                type="button"
                className="play-now"
                onClick={() => handlePlay(track)}
                disabled={!playable}
                aria-label={`Play ${track.name}`}
                title={playable ? `Play ${track.name}` : 'Preview not available'}
              >
                {playable ? 'Play' : 'N/A'}
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