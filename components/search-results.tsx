'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Track } from '@/lib/types'
import { enrichSoundCloudTrackQuality } from '@/lib/search'

interface SearchResultsProps {
  results: Track[]
  onPlay: (track: Track) => void
  onAddToQueue: (track: Track) => void
  isLoading: boolean
}

/**
 * Check if a track can be played with the current player implementation
 */
function isTrackPlayable(track: Track): boolean {
  // All tracks with stream_url or preview_url are playable
  // YouTube tracks now have stream_url from our download endpoint
  return !!(track.preview_url || track.stream_url)
}

/**
 * Search results component
 */
export function SearchResults({ results, onPlay, onAddToQueue, isLoading }: SearchResultsProps) {
  const [enrichedTracks, setEnrichedTracks] = useState<Track[]>(results)

  // Enrich SoundCloud tracks with quality info when results change
  useEffect(() => {
    setEnrichedTracks(results)

    // Enrich SoundCloud tracks with quality info asynchronously
    const soundCloudTracks = results.filter((track) => track.platform === 'soundcloud' && !track.quality)
    
    if (soundCloudTracks.length > 0) {
      // Create a cancellation token for this enrichment run
      let isCancelled = false
      
      // Enrich tracks in parallel (limit to first 5 for performance)
      const tracksToEnrich = soundCloudTracks.slice(0, 5)
      Promise.all(tracksToEnrich.map((track) => enrichSoundCloudTrackQuality(track)))
        .then((enriched) => {
          // Only apply updates if this run hasn't been cancelled
          if (!isCancelled) {
            setEnrichedTracks((prev) => {
              const updated = [...prev]
              enriched.forEach((enrichedTrack) => {
                const index = updated.findIndex((t) => t.id === enrichedTrack.id)
                if (index !== -1 && enrichedTrack.quality) {
                  updated[index] = enrichedTrack
                }
              })
              return updated
            })
          }
        })
        .catch(() => {
          // Ignore errors - quality info is optional
        })
      
      // Cleanup function: cancel this run
      return () => {
        isCancelled = true
      }
    }
  }, [results])

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

  const getQualityBadge = (track: Track) => {
    if (track.platform !== 'soundcloud' || !track.quality) {
      return null
    }

    const qualityLabels: Record<string, string> = {
      hq: 'HQ',
      standard: 'Standard',
      preview: 'Preview',
      low: 'Low',
    }

    const qualityClass = track.quality === 'hq' ? 'quality-badge hq' : 'quality-badge standard'
    const tooltip = track.bitrate ? `${qualityLabels[track.quality] || track.quality} • ${track.bitrate}kbps` : qualityLabels[track.quality] || track.quality

    return (
      <span className={qualityClass} title={tooltip}>
        {qualityLabels[track.quality] || track.quality}
      </span>
    )
  }

  return (
    <div className="search-results">
      {enrichedTracks.map((track) => {
        const imageUrl = track.album?.images?.[0]?.url || '/images/default.jpg'
        const artistName = track.artists?.[0]?.name || 'Unknown Artist'
        const playable = isTrackPlayable(track)
        const qualityBadge = getQualityBadge(track)

        return (
          <div key={track.id} className="result-item">
            <img src={imageUrl} alt={track.name} />
            <div className="song-info">
              <div className="song-title">{track.name}</div>
              <div className="song-artist">
                {artistName}
                <span className={`platform-badge ${track.platform}`}>{track.platform}</span>
                {qualityBadge}
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
