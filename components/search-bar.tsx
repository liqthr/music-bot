'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { SearchMode } from '@/lib/types'
import {
  addToHistory,
  getRecentSearches,
  clearHistory,
  saveSearch,
  getSavedSearches,
  deleteSavedSearch,
} from '@/lib/search-history'
import type { SearchHistoryItem, SavedSearch, SearchFilters } from '@/lib/types'
import { getQueryErrors } from '@/lib/search-query-parser'

interface SearchBarProps {
  onSearch: (query: string, mode: SearchMode) => void
  onModeChange: (mode: SearchMode) => void
  currentMode: SearchMode
  isLoading: boolean
  onFiltersRestore?: (filters: SearchHistoryItem['filters']) => void
  currentFilters?: SearchFilters
}

/**
 * Search bar component with platform toggle and search history
 */
export function SearchBar({ onSearch, onModeChange, currentMode, isLoading, onFiltersRestore, currentFilters }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<SearchHistoryItem[]>([])
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showOperatorHelp, setShowOperatorHelp] = useState(false)
  const [queryErrors, setQueryErrors] = useState<string[]>([])
  const searchWrapperRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const helpRef = useRef<HTMLDivElement>(null)

  // Load history and saved searches on mount
  useEffect(() => {
    setHistory(getRecentSearches())
    setSavedSearches(getSavedSearches())
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchWrapperRef.current &&
        !searchWrapperRef.current.contains(event.target as Node) &&
        modalRef.current &&
        !modalRef.current.contains(event.target as Node) &&
        helpRef.current &&
        !helpRef.current.contains(event.target as Node)
      ) {
        setShowHistory(false)
        setShowSaveModal(false)
        setShowClearConfirm(false)
        setShowOperatorHelp(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setQuery(value)

      // Clear previous timer
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      // Validate query and show errors
      const errors = getQueryErrors(value)
      setQueryErrors(errors)

      // Set new debounce timer
      const timer = setTimeout(() => {
        if (value.trim() && errors.length === 0) {
          onSearch(value.trim(), currentMode)
          // History is now handled by parent component with filters
          setHistory(getRecentSearches())
        }
      }, 500)

      setDebounceTimer(timer)
    },
    [currentMode, onSearch, debounceTimer]
  )

  const handleInputFocus = useCallback(() => {
    setShowHistory(true)
    setHistory(getRecentSearches())
    setSavedSearches(getSavedSearches())
  }, [])

  const handleHistoryItemClick = useCallback(
    (item: SearchHistoryItem) => {
      setQuery(item.query)
      onModeChange(item.mode)
      // Restore filters if they exist
      if (item.filters && onFiltersRestore) {
        onFiltersRestore(item.filters)
      }
      onSearch(item.query, item.mode)
      setShowHistory(false)
      // Update history (addToHistory will handle deduplication)
      addToHistory(item.query, item.mode, item.filters)
      setHistory(getRecentSearches())
    },
    [onSearch, onModeChange, onFiltersRestore]
  )

  const handleSavedSearchClick = useCallback(
    (saved: SavedSearch) => {
      setQuery(saved.query)
      onModeChange(saved.mode)
      // Restore filters if they exist
      if (saved.filters && onFiltersRestore) {
        onFiltersRestore(saved.filters)
      }
      onSearch(saved.query, saved.mode)
      setShowHistory(false)
      // Add to history
      addToHistory(saved.query, saved.mode, saved.filters)
      setHistory(getRecentSearches())
    },
    [onSearch, onModeChange, onFiltersRestore]
  )

  const handleSaveSearch = useCallback(() => {
    if (!query.trim()) return
    setShowSaveModal(true)
    setSaveName('')
  }, [query])

  const handleSaveConfirm = useCallback(() => {
    if (!saveName.trim() || !query.trim()) return

    const saved = saveSearch(saveName, query, currentMode, currentFilters)
    if (saved) {
      setSavedSearches(getSavedSearches())
      setShowSaveModal(false)
      setSaveName('')
    } else {
      alert('Failed to save search. Name may already exist.')
    }
  }, [saveName, query, currentMode, currentFilters])

  const handleDeleteSavedSearch = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      if (deleteSavedSearch(id)) {
        setSavedSearches(getSavedSearches())
      }
    },
    []
  )

  const handleClearHistory = useCallback(() => {
    clearHistory()
    setHistory([])
    setShowClearConfirm(false)
    setShowHistory(false)
  }, [])

  const handleModeClick = useCallback(
    (mode: SearchMode) => {
      onModeChange(mode)
      if (query.trim()) {
        onSearch(query.trim(), mode)
      }
    },
    [query, onModeChange, onSearch]
  )

  const hasHistory = history.length > 0 || savedSearches.length > 0

  return (
    <>
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
        <div className="search-wrapper" ref={searchWrapperRef}>
          <i className="fas fa-search search-icon"></i>
          <input
            type="text"
            id="search"
            className={`search-input ${query.trim() ? 'has-save-btn' : ''} ${queryErrors.length > 0 ? 'has-error' : ''}`}
            placeholder="Search tracks... (use ? for help)"
            value={query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            disabled={isLoading}
          />
          <button
            type="button"
            className="operator-help-btn"
            onClick={() => setShowOperatorHelp(!showOperatorHelp)}
            title="Search operators help"
            aria-label="Show search operators help"
          >
            <i className="fas fa-question-circle"></i>
          </button>
          {query.trim() && (
            <button
              type="button"
              className="save-search-btn"
              onClick={handleSaveSearch}
              title="Save this search"
              aria-label="Save search"
            >
              <i className="fas fa-bookmark"></i>
            </button>
          )}
          {queryErrors.length > 0 && (
            <div className="query-errors">
              {queryErrors.map((error, index) => (
                <div key={index} className="query-error">
                  <i className="fas fa-exclamation-circle"></i>
                  {error}
                </div>
              ))}
            </div>
          )}
          {showHistory && hasHistory && (
            <div className="history-dropdown">
              {savedSearches.length > 0 && (
                <div className="history-section">
                  <div className="history-section-header">
                    <i className="fas fa-star"></i>
                    <span>Saved Searches</span>
                  </div>
                  {savedSearches.map((saved) => (
                    <div
                      key={saved.id}
                      className="history-item saved-item"
                      onClick={() => handleSavedSearchClick(saved)}
                    >
                      <div className="history-item-content">
                        <div className="history-item-name">{saved.name}</div>
                        <div className="history-item-query">
                          {saved.query} • {saved.mode}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="history-item-delete"
                        onClick={(e) => handleDeleteSavedSearch(e, saved.id)}
                        aria-label={`Delete ${saved.name}`}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {history.length > 0 && (
                <div className="history-section">
                  <div className="history-section-header">
                    <i className="fas fa-clock"></i>
                    <span>Recent Searches</span>
                    {history.length > 0 && (
                      <button
                        type="button"
                        className="clear-history-btn"
                        onClick={() => setShowClearConfirm(true)}
                        aria-label="Clear history"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {history.map((item, index) => (
                    <div
                      key={`${item.query}-${item.mode}-${item.timestamp}-${index}`}
                      className="history-item"
                      onClick={() => handleHistoryItemClick(item)}
                    >
                      <div className="history-item-content">
                        <div className="history-item-query">{item.query}</div>
                        <div className="history-item-meta">
                          {item.mode} • {new Date(item.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Save Search Modal */}
      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal-content" ref={modalRef} onClick={(e) => e.stopPropagation()}>
            <h3>Save Search</h3>
            <input
              type="text"
              className="modal-input"
              placeholder="Enter a name for this search..."
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveConfirm()
                } else if (e.key === 'Escape') {
                  setShowSaveModal(false)
                }
              }}
              autoFocus
            />
            <div className="modal-actions">
              <button type="button" className="modal-btn cancel" onClick={() => setShowSaveModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn confirm"
                onClick={handleSaveConfirm}
                disabled={!saveName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear History Confirmation */}
      {showClearConfirm && (
        <div className="modal-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="modal-content" ref={modalRef} onClick={(e) => e.stopPropagation()}>
            <h3>Clear History?</h3>
            <p>This will remove all recent searches. This action cannot be undone.</p>
            <div className="modal-actions">
              <button type="button" className="modal-btn cancel" onClick={() => setShowClearConfirm(false)}>
                Cancel
              </button>
              <button type="button" className="modal-btn confirm danger" onClick={handleClearHistory}>
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Operator Help Tooltip */}
      {showOperatorHelp && (
        <div className="operator-help-tooltip" ref={helpRef}>
          <div className="operator-help-header">
            <h4>Search Operators</h4>
            <button
              type="button"
              className="operator-help-close"
              onClick={() => setShowOperatorHelp(false)}
              aria-label="Close help"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="operator-help-content">
            <div className="operator-help-section">
              <h5>Boolean Operators</h5>
              <ul>
                <li><code>AND</code> - Both terms must match (default)</li>
                <li><code>OR</code> - Either term can match</li>
                <li><code>NOT</code> - Exclude matching results</li>
              </ul>
              <p className="operator-example">Example: <code>rock AND 1970s</code></p>
            </div>

            <div className="operator-help-section">
              <h5>Quoted Phrases</h5>
              <p>Use quotes for exact phrase matching</p>
              <p className="operator-example">Example: <code>"Bohemian Rhapsody"</code></p>
            </div>

            <div className="operator-help-section">
              <h5>Field-Specific Search</h5>
              <ul>
                <li><code>artist:Queen</code> - Search by artist</li>
                <li><code>album:"A Night at the Opera"</code> - Search by album</li>
                <li><code>year:1975</code> - Search by year</li>
                <li><code>year:&gt;1970</code> - Year greater than 1970</li>
                <li><code>duration:180</code> - Duration in seconds</li>
                <li><code>duration:&gt;300</code> - Duration greater than 5 minutes</li>
              </ul>
              <p className="operator-example">Example: <code>artist:"Queen" year:1975</code></p>
            </div>

            <div className="operator-help-section">
              <h5>Grouping</h5>
              <p>Use parentheses to group terms</p>
              <p className="operator-example">Example: <code>(jazz OR blues) AND instrumental</code></p>
            </div>

            <div className="operator-help-section">
              <h5>Complex Examples</h5>
              <ul>
                <li><code>artist:"The Beatles" AND year:&gt;1965</code></li>
                <li><code>(rock OR metal) NOT country</code></li>
                <li><code>"Stairway to Heaven" OR "Bohemian Rhapsody"</code></li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
