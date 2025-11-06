import { setItem, getItem, removeItem } from './storage'
import type { SavedQueue, Track, RepeatMode } from './types'

const SAVED_QUEUES_STORAGE_KEY = 'music_bot_saved_queues'
const AUTOSAVE_QUEUE_KEY = 'music_bot_autosave_queue'
const MAX_SAVED_QUEUES = 20

/**
 * Save a queue with a custom name
 * @param name - Custom name for the saved queue
 * @param tracks - Array of tracks to save
 * @param repeatMode - Current repeat mode
 * @returns The saved queue object, or null if save failed
 */
export function saveQueue(name: string, tracks: Track[], repeatMode: RepeatMode): SavedQueue | null {
  if (!name.trim() || tracks.length === 0) return null

  const savedQueues = getSavedQueues()

  // Check for duplicate name
  const existingIndex = savedQueues.findIndex((q) => q.name.toLowerCase() === name.toLowerCase().trim())
  
  const now = Date.now()
  const savedQueue: SavedQueue = {
    id: existingIndex !== -1 ? savedQueues[existingIndex].id : `queue_${now}_${Math.random().toString(36).substring(2, 9)}`,
    name: name.trim(),
    tracks: [...tracks], // Create a copy
    repeatMode,
    createdAt: existingIndex !== -1 ? savedQueues[existingIndex].createdAt : now,
    updatedAt: now,
  }

  // Remove existing if updating
  if (existingIndex !== -1) {
    savedQueues.splice(existingIndex, 1)
  }

  // Add new/updated queue at the beginning (most recent first)
  const updatedQueues = [savedQueue, ...savedQueues]

  // Limit to MAX_SAVED_QUEUES (FIFO eviction - remove oldest)
  const limitedQueues = updatedQueues.slice(0, MAX_SAVED_QUEUES)

  const success = setItem<SavedQueue[]>(SAVED_QUEUES_STORAGE_KEY, limitedQueues)

  return success ? savedQueue : null
}

/**
 * Auto-save current queue (used on page close/refresh)
 * @param tracks - Array of tracks to save
 * @param repeatMode - Current repeat mode
 */
export function autoSaveQueue(tracks: Track[], repeatMode: RepeatMode): void {
  if (tracks.length === 0) {
    // Remove autosave if queue is empty
    removeItem(AUTOSAVE_QUEUE_KEY)
    return
  }

  const autosave: SavedQueue = {
    id: '_autosave',
    name: '_autosave',
    tracks: [...tracks],
    repeatMode,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  setItem<SavedQueue>(AUTOSAVE_QUEUE_KEY, autosave)
}

/**
 * Get auto-saved queue if it exists
 * @returns Auto-saved queue or null
 */
export function getAutoSavedQueue(): SavedQueue | null {
  return getItem<SavedQueue>(AUTOSAVE_QUEUE_KEY, null)
}

/**
 * Clear auto-saved queue
 */
export function clearAutoSave(): void {
  removeItem(AUTOSAVE_QUEUE_KEY)
}

/**
 * Get all saved queues (excluding autosave)
 * @returns Array of saved queues, most recent first
 */
export function getSavedQueues(): SavedQueue[] {
  const queues = getItem<SavedQueue[]>(SAVED_QUEUES_STORAGE_KEY, [])
  // Filter out autosave from regular saved queues and sort by updatedAt (most recent first)
  return queues
    .filter((q) => q.id !== '_autosave')
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/**
 * Load a saved queue by ID
 * @param id - ID of the saved queue to load
 * @returns The saved queue, or null if not found
 */
export function loadQueue(id: string): SavedQueue | null {
  if (id === '_autosave') {
    return getAutoSavedQueue()
  }

  const savedQueues = getSavedQueues()
  return savedQueues.find((q) => q.id === id) || null
}

/**
 * Delete a saved queue by ID
 * @param id - ID of the saved queue to delete
 * @returns true if deleted successfully, false otherwise
 */
export function deleteQueue(id: string): boolean {
  if (id === '_autosave') {
    clearAutoSave()
    return true
  }

  const savedQueues = getSavedQueues()
  const filtered = savedQueues.filter((q) => q.id !== id)

  if (filtered.length === savedQueues.length) {
    return false // Item not found
  }

  setItem<SavedQueue[]>(SAVED_QUEUES_STORAGE_KEY, filtered)
  return true
}

