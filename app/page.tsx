'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { SearchBar } from '@/components/search-bar'
import { SearchResults } from '@/components/search-results'
import { Player } from '@/components/player'
import { searchByMode } from '@/lib/search'
import type { Track, SearchMode } from '@/lib/types'

/**
 * Format time in MM:SS format
 */
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds === Infinity) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins < 10 ? '0' + mins : mins}:${secs < 10 ? '0' + secs : secs}`
}

/**
 * Main music player page
 */
export default function MusicPlayerPage() {
  const [currentMode, setCurrentMode] = useState<SearchMode>('spotify')
  const [searchResults, setSearchResults] = useState<Track[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [queue, setQueue] = useState<Track[]>([])
  const [seekTo, setSeekTo] = useState<number | undefined>(undefined)
  const searchControllerRef = useRef<AbortController | null>(null)

  // Handle search
  const handleSearch = useCallback(
    async (query: string, mode: SearchMode) => {
      // Abort previous search
      if (searchControllerRef.current) {
        searchControllerRef.current.abort()
      }

      setIsSearching(true)
      searchControllerRef.current = new AbortController()

      try {
        const results = await searchByMode(mode, query, {
          signal: searchControllerRef.current.signal,
        })
        setSearchResults(results)
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Search error:', error)
        }
      } finally {
        setIsSearching(false)
      }
    },
    []
  )

  // Handle mode change
  const handleModeChange = useCallback((mode: SearchMode) => {
    setCurrentMode(mode)
    setSearchResults([])
  }, [])

  // Handle play track
  const handlePlay = useCallback((track: Track) => {
    setCurrentTrack(track)
    setIsPlaying(true)
  }, [])

  // Handle add to queue
  const handleAddToQueue = useCallback((track: Track) => {
    setQueue((prev) => [...prev, track])
  }, [])

  // Handle play/pause toggle
  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev)
  }, [])

  // Handle next track
  const handleNext = useCallback(() => {
    if (queue.length > 0) {
      const nextTrack = queue[0]
      setQueue((prev) => prev.slice(1))
      setCurrentTrack(nextTrack)
      setIsPlaying(true)
    } else if (searchResults.length > 0) {
      const currentIndex = searchResults.findIndex((t) => t.id === currentTrack?.id)
      const nextIndex = currentIndex < searchResults.length - 1 ? currentIndex + 1 : 0
      setCurrentTrack(searchResults[nextIndex])
      setIsPlaying(true)
    }
  }, [queue, searchResults, currentTrack])

  // Handle previous track
  const handlePrevious = useCallback(() => {
    if (searchResults.length > 0) {
      const currentIndex = searchResults.findIndex((t) => t.id === currentTrack?.id)
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : searchResults.length - 1
      setCurrentTrack(searchResults[prevIndex])
      setIsPlaying(true)
    }
  }, [searchResults, currentTrack])

  // Handle progress bar click
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!duration) return

      const progressBar = e.currentTarget
      const clickX = e.clientX - progressBar.getBoundingClientRect().left
      const width = progressBar.clientWidth
      const percentage = clickX / width
      const newTime = percentage * duration

      setCurrentTime(newTime)
      setSeekTo(newTime)
    },
    [duration]
  )

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        handleTogglePlay()
      } else if (e.code === 'ArrowRight') {
        handleNext()
      } else if (e.code === 'ArrowLeft') {
        handlePrevious()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleTogglePlay, handleNext, handlePrevious])

  const coverImage = currentTrack?.album?.images?.[0]?.url || '/images/default.jpg'
  const trackName = currentTrack?.name || 'Choose a Track'
  const artistName = currentTrack?.artists?.[0]?.name || 'Search to get started'

  return (
    <>
      <div className="bg-atmosphere"></div>
      <div className="grain"></div>

      <header className="header">
        <div className="header-content">
          <div className="logo">AURALIS</div>
          <div className="search-wrapper-container">
            <SearchBar
              onSearch={handleSearch}
              onModeChange={handleModeChange}
              currentMode={currentMode}
              isLoading={isSearching}
            />
            <SearchResults results={searchResults} onPlay={handlePlay} onAddToQueue={handleAddToQueue} isLoading={isSearching} />
          </div>
        </div>
      </header>

      <main className="main-container">
        <div className="player-card">
          <div className="album-art-wrapper">
            <img src={coverImage} alt="Album Art" id="cover" className={`album-art ${isPlaying ? 'active' : ''}`} />
          </div>

          <div className="track-info">
            <h1 className="track-title">{trackName}</h1>
            <p className="track-artist">
              {artistName}
              {currentTrack && (
                <span className={`platform-indicator ${currentTrack.platform}`}>
                  {currentTrack.platform === 'soundcloud' ? 'SoundCloud' : currentTrack.platform === 'youtube' ? 'YouTube' : 'Spotify'}
                </span>
              )}
            </p>
          </div>

          <div className="progress-section">
            <div className="progress-bar" onClick={handleProgressClick}>
              <div
                className="progress-fill"
                style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
              ></div>
            </div>
            <div className="time-display">
              <span className="current-time">{formatTime(currentTime)}</span>
              <span className="total-time">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="controls">
            <button type="button" className="control-btn prev-btn" onClick={handlePrevious} aria-label="Previous track">
              <i className="fas fa-backward"></i>
            </button>
            <button type="button" className="control-btn play-btn" onClick={handleTogglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
              <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
            </button>
            <button type="button" className="control-btn next-btn" onClick={handleNext} aria-label="Next track">
              <i className="fas fa-forward"></i>
            </button>
          </div>

          <div className="volume-section">
            <i className={`fas ${volume === 0 ? 'fa-volume-mute' : volume < 0.5 ? 'fa-volume-down' : 'fa-volume-up'} volume-icon`}></i>
            <input
              type="range"
              id="volume-slider"
              className="volume-slider"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              aria-label="Volume"
            />
          </div>
        </div>

        <div className="queue-section">
          <h2 className="queue-header">Up Next</h2>
          <div className="queue-list">
            {queue.length === 0 ? (
              <div className="empty-queue">Queue is empty</div>
            ) : (
              queue.map((track, index) => {
                const imageUrl = track.album?.images?.[0]?.url || '/images/default.jpg'
                const artistName = track.artists?.[0]?.name || 'Unknown Artist'

                return (
                  <div key={track.id} className="queue-item">
                    <img src={imageUrl} alt={track.name} />
                    <div className="queue-item-info">
                      <div className="queue-item-title">{track.name}</div>
                      <div className="queue-item-artist">{artistName}</div>
                    </div>
                    <button
                      type="button"
                      className="remove-queue-item"
                      onClick={() => setQueue((prev) => prev.filter((_, i) => i !== index))}
                      aria-label={`Remove ${track.name} from queue`}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </main>

      <Player
        track={currentTrack}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onTimeUpdate={setCurrentTime}
        onDurationChange={setDuration}
        volume={volume}
        onVolumeChange={setVolume}
        seekTo={seekTo}
      />
    </>
  )
}
