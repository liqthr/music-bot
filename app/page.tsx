'use client'

import { useState, useCallback } from 'react'
import { SearchBar } from '@/components/search-bar'
import { SearchResults } from '@/components/search-results'
import { Player } from '@/components/player'
import { TidalAuthPanel } from '@/components/tidal-auth-panel'
import { searchByMode } from '@/lib/search'
import type { Track, SearchMode } from '@/lib/types'

/**
 * Simple music player page - reverts to clean UI
 */
export default function SimpleMusicPlayerPage() {
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
  const [showTidalAuth, setShowTidalAuth] = useState(false)

  // Handle search
  const handleSearch = useCallback(async (query: string, mode: SearchMode) => {
    if (!query.trim()) return

    setIsSearching(true)
    try {
      const results = await searchByMode(mode, query)
      setSearchResults(results)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Handle mode change
  const handleModeChange = useCallback((mode: SearchMode) => {
    setCurrentMode(mode)
    setSearchResults([])
  }, [])

  // Handle play track with enhanced streaming
  const handlePlay = useCallback(async (track: Track) => {
    setCurrentTrack(track)
    
    // Get enhanced stream URL using SpotiFLAC-style resolution
    try {
      const response = await fetch(`/api/resolve-stream?id=${track.id}`)
      if (response.ok) {
        const streamData = await response.json()
        console.log('Stream resolved:', streamData)
        // The player component will use this enhanced stream
      }
    } catch (error) {
      console.error('Stream resolution failed:', error)
    }
    
    setIsPlaying(true)
  }, [])

  // Handle play/pause toggle
  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev)
  }, [])

  // Handle add to queue
  const handleAddToQueue = useCallback((track: Track) => {
    setQueue((prev) => [...prev, track])
  }, [])

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
  const handleVolumeChange = useCallback((volume: number) => {
    setVolume(volume)
  }, [])

  const coverImage = currentTrack?.album?.images?.[0]?.url || '/images/default.jpg'
  const trackName = currentTrack?.name || 'Choose a Track'
  const artistName = currentTrack?.artists?.[0]?.name || 'Search to get started'

  return (
    <>
      {/* Background */}
      <div className="bg-atmosphere"></div>
      <div className="grain"></div>

      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">AURALIS</div>
          <button
            className="tidal-auth-btn"
            onClick={() => setShowTidalAuth(!showTidalAuth)}
          >
            🌊 Tidal Auth
          </button>
          <div className="search-wrapper-container">
            <SearchBar
              onSearch={handleSearch}
              onModeChange={handleModeChange}
              currentMode={currentMode}
              isLoading={isSearching}
            />
          </div>
        </div>
        
        {showTidalAuth && (
          <div className="auth-dropdown">
            <TidalAuthPanel />
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="main">
        <div className="content">
          {/* Player Section */}
          <section className="player-section">
            <div className="track-info">
              <div className="track-cover">
                <img src={coverImage} alt={trackName} />
              </div>
              <div className="track-details">
                <h1 className="track-name">{trackName}</h1>
                <p className="artist-name">{artistName}</p>
              </div>
            </div>

            <Player
              track={currentTrack}
              nextTrack={null}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onNext={() => {}}
              onPrevious={() => {}}
              onTimeUpdate={setCurrentTime}
              onDurationChange={setDuration}
              volume={volume}
              onVolumeChange={handleVolumeChange}
              seekTo={seekTo}
              crossfadeSettings={{ enabled: false, duration: 3 }}
              onCrossfadeStateChange={() => {}}
              normalizationSettings={{ enabled: false, targetLUFS: -14, preventClipping: true }}
              onNormalizationStateChange={() => {}}
              playbackSettings={{ speed: 1.0, pitch: 0, equalizer: { bass: 0, mid: 0, treble: 0 }, eqPreset: 'flat' }}
            />
          </section>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <section className="search-results-section">
              <h2 className="section-title">Search Results</h2>
              <SearchResults
                results={searchResults}
                onPlay={handlePlay}
                onAddToQueue={handleAddToQueue}
                isLoading={isSearching}
                currentTrackId={currentTrack?.id}
              />
            </section>
          )}

          {/* Queue Section */}
          {queue.length > 0 && (
            <section className="queue-section">
              <h2 className="section-title">Up Next</h2>
              <div className="queue-list">
                {queue.map((track, index) => (
                  <div key={track.id} className="queue-item">
                    <div className="queue-track-info">
                      <img 
                        src={track.album?.images?.[0]?.url || '/images/default.jpg'} 
                        alt={track.name}
                        className="queue-track-cover"
                      />
                      <div className="queue-track-details">
                        <h4 className="queue-track-name">{track.name}</h4>
                        <p className="queue-artist-name">{track.artists[0]?.name}</p>
                      </div>
                    </div>
                    <button
                      className="play-queue-btn"
                      onClick={() => {
                        setCurrentTrack(track)
                        setIsPlaying(true)
                        setQueue((prev) => prev.filter((_, i) => i !== index))
                      }}
                    >
                      Play
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Empty State */}
          {searchResults.length === 0 && !currentTrack && (
            <section className="empty-state">
              <h1>Choose a Track</h1>
              <p>Search to get started</p>
            </section>
          )}
        </div>
      </main>

      <style jsx>{`
        .main {
          min-height: 100vh;
          padding: 2rem;
          position: relative;
          z-index: 1;
        }

        .content {
          max-width: 1200px;
          margin: 0 auto;
        }

        .player-section {
          text-align: center;
          margin-bottom: 3rem;
        }

        .track-info {
          margin-bottom: 2rem;
        }

        .track-cover {
          width: 200px;
          height: 200px;
          margin: 0 auto 1.5rem;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .track-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .track-details {
          color: white;
        }

        .track-name {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .artist-name {
          font-size: 1.2rem;
          opacity: 0.8;
          margin: 0;
        }

        .search-results-section,
        .queue-section {
          margin-bottom: 2rem;
        }

        .section-title {
          color: white;
          font-size: 1.5rem;
          margin-bottom: 1rem;
          text-align: center;
        }

        .queue-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .queue-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          backdrop-filter: blur(10px);
        }

        .queue-track-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .queue-track-cover {
          width: 50px;
          height: 50px;
          border-radius: 6px;
          object-fit: cover;
        }

        .queue-track-details {
          color: white;
        }

        .queue-track-name {
          font-size: 1rem;
          margin: 0 0 0.25rem 0;
        }

        .queue-artist-name {
          font-size: 0.9rem;
          opacity: 0.7;
          margin: 0;
        }

        .play-queue-btn {
          padding: 0.5rem 1rem;
          background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
          border: none;
          border-radius: 6px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .play-queue-btn:hover {
          transform: scale(1.05);
        }

        .empty-state {
          text-align: center;
          color: white;
          margin-top: 4rem;
        }

        .empty-state h1 {
          font-size: 2rem;
          margin-bottom: 1rem;
          background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .empty-state p {
          font-size: 1.2rem;
          opacity: 0.7;
          margin: 0;
        }

        .tidal-auth-btn {
          padding: 0.5rem 1rem;
          background: linear-gradient(45deg, #00b4db, #0083b0);
          border: none;
          border-radius: 6px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
          margin: 0 1rem;
        }

        .tidal-auth-btn:hover {
          transform: scale(1.05);
        }

        .auth-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          z-index: 1000;
          margin-top: 1rem;
          max-width: 500px;
        }

        .header-content {
          position: relative;
        }

        @media (max-width: 768px) {
          .main {
            padding: 1rem;
          }

          .track-cover {
            width: 150px;
            height: 150px;
          }

          .track-name {
            font-size: 1.5rem;
          }

          .queue-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .play-queue-btn {
            align-self: stretch;
          }
        }
      `}</style>
    </>
  )
}
