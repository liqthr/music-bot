/**
 * Type-safe localStorage utility module for persistent data management
 * Supports TTL (time-to-live) for cache expiration and size monitoring
 */

/**
 * Internal structure for TTL-enabled storage items
 */
interface TTLItem<T> {
  value: T
  expiresAt: number
}

/**
 * Check if localStorage is available in the current environment
 */
function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false
  
  try {
    const test = '__storage_test__'
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}

/**
 * Get the storage instance, or null if unavailable
 */
function getStorage(): Storage | null {
  return isStorageAvailable() ? localStorage : null
}

/**
 * Calculate the size of a string in bytes (UTF-16 encoding)
 */
function getStringSize(str: string): number {
  return str.length * 2 // UTF-16 uses 2 bytes per character
}

/**
 * Set an item in localStorage with type safety
 * @param key - Storage key
 * @param value - Value to store (will be JSON serialized)
 * @returns true if successful, false if quota exceeded or storage unavailable
 */
export function setItem<T>(key: string, value: T): boolean {
  const storage = getStorage()
  if (!storage) {
    console.warn('localStorage is not available')
    return false
  }

  try {
    const serialized = JSON.stringify(value)
    storage.setItem(key, serialized)
    return true
  } catch (error: any) {
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      console.warn('localStorage quota exceeded when setting item:', key)
      return false
    }
    console.error('Error setting localStorage item:', error)
    return false
  }
}

/**
 * Get an item from localStorage with type safety
 * @param key - Storage key
 * @param defaultValue - Optional default value to return if item doesn't exist
 * @returns The stored value, default value, or null if not found
 */
export function getItem<T>(key: string, defaultValue?: T): T | null {
  const storage = getStorage()
  if (!storage) {
    return defaultValue ?? null
  }

  try {
    const item = storage.getItem(key)
    if (item === null) {
      return defaultValue ?? null
    }
    return JSON.parse(item) as T
  } catch (error) {
    console.error('Error parsing localStorage item:', key, error)
    // Remove corrupted item
    try {
      storage.removeItem(key)
    } catch {
      // Ignore removal errors
    }
    return defaultValue ?? null
  }
}

/**
 * Set an item in localStorage with TTL (time-to-live) expiration
 * @param key - Storage key
 * @param value - Value to store (will be JSON serialized)
 * @param ttlMs - Time to live in milliseconds
 * @returns true if successful, false if quota exceeded or storage unavailable
 */
export function setItemWithTTL<T>(key: string, value: T, ttlMs: number): boolean {
  const storage = getStorage()
  if (!storage) {
    console.warn('localStorage is not available')
    return false
  }

  try {
    const expiresAt = Date.now() + ttlMs
    const ttlItem: TTLItem<T> = {
      value,
      expiresAt,
    }
    const serialized = JSON.stringify(ttlItem)
    storage.setItem(key, serialized)
    return true
  } catch (error: any) {
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      console.warn('localStorage quota exceeded when setting item with TTL:', key)
      return false
    }
    console.error('Error setting localStorage item with TTL:', error)
    return false
  }
}

/**
 * Get an item from localStorage with TTL expiration check
 * @param key - Storage key
 * @returns The stored value if not expired, or null if expired/not found
 */
export function getItemWithTTL<T>(key: string): T | null {
  const storage = getStorage()
  if (!storage) {
    return null
  }

  try {
    const item = storage.getItem(key)
    if (item === null) {
      return null
    }

    const ttlItem = JSON.parse(item) as TTLItem<T>
    
    // Check if expired
    if (Date.now() > ttlItem.expiresAt) {
      // Remove expired item
      try {
        storage.removeItem(key)
      } catch {
        // Ignore removal errors
      }
      return null
    }

    return ttlItem.value
  } catch (error) {
    console.error('Error parsing localStorage item with TTL:', key, error)
    // Remove corrupted item
    try {
      storage.removeItem(key)
    } catch {
      // Ignore removal errors
    }
    return null
  }
}

/**
 * Remove an item from localStorage
 * @param key - Storage key to remove
 */
export function removeItem(key: string): void {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    storage.removeItem(key)
  } catch (error) {
    console.error('Error removing localStorage item:', error)
  }
}

/**
 * Clear all items from localStorage
 */
export function clear(): void {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    storage.clear()
  } catch (error) {
    console.error('Error clearing localStorage:', error)
  }
}

/**
 * Calculate the total size of localStorage in bytes
 * @returns Total size in bytes, or 0 if storage is unavailable
 */
export function getStorageSize(): number {
  const storage = getStorage()
  if (!storage) {
    return 0
  }

  let totalSize = 0

  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key !== null) {
        const value = storage.getItem(key)
        if (value !== null) {
          // Add size of key and value
          totalSize += getStringSize(key) + getStringSize(value)
        }
      }
    }
  } catch (error) {
    console.error('Error calculating localStorage size:', error)
    return 0
  }

  return totalSize
}

