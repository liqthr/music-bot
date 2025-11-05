'use client'

import { useState, useCallback } from 'react'
import type { Track, SearchMode } from '@/lib/types'

interface SearchBarProps {
  onSearch: (query: string, mode: SearchMode) => void
  onModeChange: (mode: SearchMode) => void
  currentMode: SearchMode
  isLoading: boolean
}

/**
 * Search bar component with platform toggle
 */
export function SearchBar({ onSearch, onModeChange, currentMode, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setQuery(value)

      // Clear previous timer
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      // Set new debounce timer
      const timer = setTimeout(() => {
        if (value.trim()) {
          onSearch(value.trim(), currentMode)
        }
      }, 500)

      setDebounceTimer(timer)
    },
    [currentMode, onSearch, debounceTimer]
  )

  const handleModeClick = useCallback(
    (mode: SearchMode) => {
      onModeChange(mode)
      if (query.trim()) {
        onSearch(query.trim(), mode)
      }
    },
    [query, onModeChange, onSearch]
  )

  return (
    <div className="search-section">
      <div className="platform-toggle">
        <button
          type="button"
          className={`platform-btn ${currentMode === 'spotify' ? 'active' : ''}`}
          onClick={() => handleModeClick('spotify')}
          title="Spotify"
          aria-label="Search Spotify"
        >
          <i className="fab fa-spotify"></i>
        </button>
        <button
          type="button"
          className={`platform-btn ${currentMode === 'soundcloud' ? 'active' : ''}`}
          onClick={() => handleModeClick('soundcloud')}
          title="SoundCloud"
          aria-label="Search SoundCloud"
        >
          <i className="fab fa-soundcloud"></i>
        </button>
        <button
          type="button"
          className={`platform-btn ${currentMode === 'youtube' ? 'active' : ''}`}
          onClick={() => handleModeClick('youtube')}
          title="YouTube"
          aria-label="Search YouTube"
        >
          <i className="fab fa-youtube"></i>
        </button>
      </div>
      <div className="search-wrapper">
        <i className="fas fa-search search-icon"></i>
        <input
          type="text"
          id="search"
          className="search-input"
          placeholder="Search tracks..."
          value={query}
          onChange={handleInputChange}
          disabled={isLoading}
        />
      </div>
    </div>
  )
}
