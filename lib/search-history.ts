import { setItem, getItem, removeItem } from './storage'
import type { SearchHistoryItem, SavedSearch, SearchMode, SearchFilters } from './types'

const HISTORY_STORAGE_KEY = 'music_bot_search_history'
const SAVED_SEARCHES_STORAGE_KEY = 'music_bot_saved_searches'
const MAX_HISTORY_ITEMS = 20

/**
 * Add a search query to history
 * Automatically limits to last 20 items (FIFO eviction)
 * @param query - Search query string
 * @param mode - Search mode/platform
 * @param filters - Optional search filters
 */
export function addToHistory(query: string, mode: SearchMode, filters?: SearchFilters): void {
  if (!query.trim()) return

  const history = getRecentSearches()
  
  // Remove duplicate if exists (same query, mode, and filters)
  const filteredHistory = history.filter(
    (item) =>
      !(
        item.query.toLowerCase() === query.toLowerCase().trim() &&
        item.mode === mode &&
        JSON.stringify(item.filters || {}) === JSON.stringify(filters || {})
      )
  )

  // Add new item at the beginning
  const newItem: SearchHistoryItem = {
    query: query.trim(),
    mode,
    filters,
    timestamp: Date.now(),
  }

  const updatedHistory = [newItem, ...filteredHistory]

  // Limit to MAX_HISTORY_ITEMS (FIFO eviction)
  const limitedHistory = updatedHistory.slice(0, MAX_HISTORY_ITEMS)

  setItem<SearchHistoryItem[]>(HISTORY_STORAGE_KEY, limitedHistory)
}

/**
 * Get recent search history (last 20 items)
 * @returns Array of search history items, most recent first
 */
export function getRecentSearches(): SearchHistoryItem[] {
  return getItem<SearchHistoryItem[]>(HISTORY_STORAGE_KEY, []) || []
}

/**
 * Clear all search history
 */
export function clearHistory(): void {
  removeItem(HISTORY_STORAGE_KEY)
}

/**
 * Save a search with a custom name
 * @param name - Custom name for the saved search
 * @param query - Search query string
 * @param mode - Search mode/platform
 * @param filters - Optional search filters
 * @returns The saved search object, or null if save failed
 */
export function saveSearch(
  name: string,
  query: string,
  mode: SearchMode,
  filters?: SearchFilters
): SavedSearch | null {
  if (!name.trim() || !query.trim()) return null

  const savedSearches = getSavedSearches()

  // Check for duplicate name
  if (savedSearches.some((s) => s.name.toLowerCase() === name.toLowerCase().trim())) {
    return null
  }

  const newSavedSearch: SavedSearch = {
    id: `saved_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    name: name.trim(),
    query: query.trim(),
    mode,
    filters,
    createdAt: Date.now(),
  }

  const updatedSearches = [...savedSearches, newSavedSearch]
  const success = setItem<SavedSearch[]>(SAVED_SEARCHES_STORAGE_KEY, updatedSearches)

  return success ? newSavedSearch : null
}

/**
 * Get all saved searches
 * @returns Array of saved searches
 */
export function getSavedSearches(): SavedSearch[] {
  return getItem<SavedSearch[]>(SAVED_SEARCHES_STORAGE_KEY, []) || []
}

/**
 * Delete a saved search by ID
 * @param id - ID of the saved search to delete
 * @returns true if deleted successfully, false otherwise
 */
export function deleteSavedSearch(id: string): boolean {
  const savedSearches = getSavedSearches()
  const filtered = savedSearches.filter((s) => s.id !== id)

  if (filtered.length === savedSearches.length) {
    return false // Item not found
  }

  setItem<SavedSearch[]>(SAVED_SEARCHES_STORAGE_KEY, filtered)
  return true
}

