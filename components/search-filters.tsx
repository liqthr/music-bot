'use client'

import { useState, useEffect, useRef } from 'react'
import type { SearchFilters, DurationPreset } from '@/lib/types'
import { GENRES, countActiveFilters, getDefaultFilters } from '@/lib/search-filter-utils'
import { getItem, setItem } from '@/lib/storage'

interface SearchFiltersProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
  isOpen: boolean
  onToggle: () => void
}

/**
 * Search filters component with genre, year, duration, and platform filters
 */
export function SearchFiltersComponent({ filters, onFiltersChange, isOpen, onToggle }: SearchFiltersProps) {
  const [localFilters, setLocalFilters] = useState<SearchFilters>(filters)
  const [showGenreDropdown, setShowGenreDropdown] = useState(false)
  const filtersRef = useRef<HTMLDivElement>(null)
  const genreDropdownRef = useRef<HTMLDivElement>(null)

  // Update local filters when props change
  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (genreDropdownRef.current && !genreDropdownRef.current.contains(event.target as Node)) {
        setShowGenreDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle genre toggle
  const handleGenreToggle = (genre: string) => {
    const currentGenres = localFilters.genres || []
    const newGenres = currentGenres.includes(genre)
      ? currentGenres.filter((g) => g !== genre)
      : [...currentGenres, genre]

    const newFilters = { ...localFilters, genres: newGenres }
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  // Handle year range change
  const handleYearChange = (field: 'from' | 'to', value: string) => {
    const year = value ? parseInt(value, 10) : undefined
    if (year && (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1)) {
      return // Invalid year
    }

    const yearRange = { ...localFilters.yearRange, [field]: year }
    const newFilters = { ...localFilters, yearRange }
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  // Handle duration preset change
  const handleDurationPresetChange = (preset: DurationPreset | null) => {
    const newFilters = {
      ...localFilters,
      duration: {
        ...localFilters.duration,
        preset: preset || undefined,
        custom: preset === 'custom' ? localFilters.duration?.custom : undefined,
      },
    }
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  // Handle custom duration range change
  const handleDurationRangeChange = (field: 'min' | 'max', value: string) => {
    const seconds = value ? parseInt(value, 10) : undefined
    if (seconds && (isNaN(seconds) || seconds < 0)) {
      return // Invalid duration
    }

    const custom = { ...localFilters.duration?.custom, [field]: seconds }
    const newFilters = {
      ...localFilters,
      duration: {
        ...localFilters.duration,
        preset: 'custom',
        custom,
      },
    }
    // Ensure preset is 'custom' as type DurationPreset (not string)
    const typedFilters = {
      ...newFilters,
      duration: {
        ...newFilters.duration,
        // preset should explicitly be "custom" as DurationPreset
        preset: 'custom' as const,
      },
    }
    setLocalFilters(typedFilters)
    onFiltersChange(typedFilters)
  }

  // Handle platform toggle
  const handlePlatformToggle = (platform: 'spotify' | 'soundcloud' | 'youtube') => {
    const currentPlatforms = localFilters.platforms || []
    const newPlatforms = currentPlatforms.includes(platform)
      ? currentPlatforms.filter((p) => p !== platform)
      : [...currentPlatforms, platform]

    const newFilters = { ...localFilters, platforms: newPlatforms }
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  // Handle "All Platforms" toggle
  const handleAllPlatformsToggle = () => {
    const allPlatforms: ('spotify' | 'soundcloud' | 'youtube')[] = ['spotify', 'soundcloud', 'youtube']
    const currentPlatforms = localFilters.platforms || []
    const isAllSelected = allPlatforms.every((p) => currentPlatforms.includes(p))

    const newFilters = {
      ...localFilters,
      platforms: isAllSelected ? [] : allPlatforms,
    }
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  // Handle clear filters
  const handleClearFilters = () => {
    const defaultFilters = getDefaultFilters()
    setLocalFilters(defaultFilters)
    onFiltersChange(defaultFilters)
  }

  const activeFilterCount = countActiveFilters(localFilters)
  const selectedGenres = localFilters.genres || []
  const selectedPlatforms = localFilters.platforms || []
  const allPlatformsSelected = selectedPlatforms.length === 3

  // Convert seconds to MM:SS for display
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return ''
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' + secs : secs}`
  }

  // Parse MM:SS to seconds
  const parseDuration = (value: string): number | undefined => {
    const parts = value.split(':')
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10)
      const secs = parseInt(parts[1], 10)
      if (!isNaN(mins) && !isNaN(secs)) {
        return mins * 60 + secs
      }
    }
    return undefined
  }

  return (
    <div className="search-filters-container" ref={filtersRef}>
      <button
        type="button"
        className="search-filters-toggle"
        onClick={onToggle}
        aria-label="Toggle search filters"
        aria-expanded={isOpen}
      >
        <i className="fas fa-filter"></i>
        <span>Filters</span>
        {activeFilterCount > 0 && (
          <span className="filter-count-badge">{activeFilterCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="search-filters-panel">
          <div className="search-filters-header">
            <h3>Search Filters</h3>
            {activeFilterCount > 0 && (
              <button
                type="button"
                className="clear-filters-btn"
                onClick={handleClearFilters}
                aria-label="Clear all filters"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="search-filters-content">
            {/* Genre Filter */}
            <div className="filter-section">
              <label className="filter-label">Genre</label>
              <div className="genre-filter-wrapper" ref={genreDropdownRef}>
                <button
                  type="button"
                  className="genre-dropdown-toggle"
                  onClick={() => setShowGenreDropdown(!showGenreDropdown)}
                  aria-label="Select genres"
                >
                  <span>
                    {selectedGenres.length === 0
                      ? 'All Genres'
                      : selectedGenres.length === 1
                      ? selectedGenres[0]
                      : `${selectedGenres.length} selected`}
                  </span>
                  <i className={`fas fa-chevron-${showGenreDropdown ? 'up' : 'down'}`}></i>
                </button>
                {showGenreDropdown && (
                  <div className="genre-dropdown">
                    {GENRES.map((genre) => (
                      <label key={genre} className="genre-option">
                        <input
                          type="checkbox"
                          checked={selectedGenres.includes(genre)}
                          onChange={() => handleGenreToggle(genre)}
                        />
                        <span>{genre}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Year Range Filter */}
            <div className="filter-section">
              <label className="filter-label">Year Range</label>
              <div className="year-range-inputs">
                <input
                  type="number"
                  className="year-input"
                  placeholder="From"
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  value={localFilters.yearRange?.from || ''}
                  onChange={(e) => handleYearChange('from', e.target.value)}
                />
                <span className="year-separator">-</span>
                <input
                  type="number"
                  className="year-input"
                  placeholder="To"
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  value={localFilters.yearRange?.to || ''}
                  onChange={(e) => handleYearChange('to', e.target.value)}
                />
              </div>
            </div>

            {/* Duration Filter */}
            <div className="filter-section">
              <label className="filter-label">Duration</label>
              <div className="duration-presets">
                <button
                  type="button"
                  className={`duration-preset-btn ${localFilters.duration?.preset === 'short' ? 'active' : ''}`}
                  onClick={() => handleDurationPresetChange('short')}
                >
                  Short (&lt;3min)
                </button>
                <button
                  type="button"
                  className={`duration-preset-btn ${localFilters.duration?.preset === 'medium' ? 'active' : ''}`}
                  onClick={() => handleDurationPresetChange('medium')}
                >
                  Medium (3-6min)
                </button>
                <button
                  type="button"
                  className={`duration-preset-btn ${localFilters.duration?.preset === 'long' ? 'active' : ''}`}
                  onClick={() => handleDurationPresetChange('long')}
                >
                  Long (&gt;6min)
                </button>
                <button
                  type="button"
                  className={`duration-preset-btn ${localFilters.duration?.preset === 'custom' ? 'active' : ''}`}
                  onClick={() => handleDurationPresetChange('custom')}
                >
                  Custom
                </button>
              </div>
              {localFilters.duration?.preset === 'custom' && (
                <div className="duration-custom-range">
                  <input
                    type="text"
                    className="duration-input"
                    placeholder="Min (MM:SS)"
                    value={formatDuration(localFilters.duration?.custom?.min)}
                    onChange={(e) => {
                      const seconds = parseDuration(e.target.value)
                      handleDurationRangeChange('min', seconds?.toString() || '')
                    }}
                  />
                  <span className="duration-separator">-</span>
                  <input
                    type="text"
                    className="duration-input"
                    placeholder="Max (MM:SS)"
                    value={formatDuration(localFilters.duration?.custom?.max)}
                    onChange={(e) => {
                      const seconds = parseDuration(e.target.value)
                      handleDurationRangeChange('max', seconds?.toString() || '')
                    }}
                  />
                </div>
              )}
            </div>

            {/* Platform Filter */}
            <div className="filter-section">
              <label className="filter-label">Platform</label>
              <div className="platform-filters">
                <label className="platform-filter-option">
                  <input
                    type="checkbox"
                    checked={allPlatformsSelected}
                    onChange={handleAllPlatformsToggle}
                  />
                  <span>All Platforms</span>
                </label>
                <label className="platform-filter-option">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes('spotify')}
                    onChange={() => handlePlatformToggle('spotify')}
                  />
                  <span>Spotify</span>
                </label>
                <label className="platform-filter-option">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes('soundcloud')}
                    onChange={() => handlePlatformToggle('soundcloud')}
                  />
                  <span>SoundCloud</span>
                </label>
                <label className="platform-filter-option">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes('youtube')}
                    onChange={() => handlePlatformToggle('youtube')}
                  />
                  <span>YouTube</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchFiltersComponent
