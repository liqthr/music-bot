/**
 * Cache Manager
 * Implements LRU (Least Recently Used) cache with TTL (Time To Live) support
 */

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  value: T
  timestamp: number
  accessTime: number
  size?: number // Size in bytes (for memory tracking)
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number
  misses: number
  evictions: number
  size: number
  maxSize: number
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxEntries: number
  ttl?: number // Time to live in milliseconds
  maxSize?: number // Maximum size in bytes
  persistent?: boolean // Whether to persist to localStorage
  storageKey?: string // localStorage key for persistence
}

/**
 * Create LRU Cache Manager with TTL support
 */
export function createCacheManager<T>(config: CacheConfig) {
  const finalConfig: Required<CacheConfig> = {
    maxEntries: config.maxEntries,
    ttl: config.ttl || Infinity,
    maxSize: config.maxSize || Infinity,
    persistent: config.persistent || false,
    storageKey: config.storageKey || 'cache',
  }

  const cache = new Map<string, CacheEntry<T>>()
  const accessOrder: string[] = []
  let currentSize = 0
  const stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    maxSize: config.maxEntries,
  }

  /**
   * Estimate size of value in bytes
   */
  function estimateSize(value: T): number {
    if (typeof value === 'string') {
      return new Blob([value]).size
    }
    if (typeof value === 'object' && value !== null) {
      try {
        return new Blob([JSON.stringify(value)]).size
      } catch {
        return 1024 // Default estimate
      }
    }
    return 1024 // Default estimate
  }

  /**
   * Update access order (move key to end)
   */
  function updateAccessOrder(key: string): void {
    const index = accessOrder.indexOf(key)
    if (index > -1) {
      accessOrder.splice(index, 1)
      accessOrder.push(key)
    }
  }

  /**
   * Remove key from access order
   */
  function removeFromAccessOrder(key: string): void {
    const index = accessOrder.indexOf(key)
    if (index > -1) {
      accessOrder.splice(index, 1)
    }
  }

  /**
   * Evict least recently used entry
   */
  function evictLRU(): void {
    if (accessOrder.length === 0) return

    const lruKey = accessOrder[0]
    deleteEntry(lruKey)
    stats.evictions++
  }

  /**
   * Delete entry from cache (internal)
   */
  function deleteEntry(key: string): boolean {
    const entry = cache.get(key)
    if (!entry) return false

    currentSize -= entry.size || 0
    cache.delete(key)
    removeFromAccessOrder(key)
    stats.size = cache.size

    // Save to localStorage if persistent
    if (finalConfig.persistent) {
      saveToStorage()
    }

    return true
  }

  /**
   * Save cache to localStorage
   */
  function saveToStorage(): void {
    if (typeof window === 'undefined') return

    try {
      const data: Array<[string, CacheEntry<T>]> = []
      for (const [key, entry] of cache.entries()) {
        // Only save non-expired entries
        const now = Date.now()
        if (finalConfig.ttl === Infinity || now - entry.timestamp <= finalConfig.ttl) {
          data.push([key, entry])
        }
      }

      // Limit size to avoid localStorage quota issues
      const serialized = JSON.stringify(data.slice(0, finalConfig.maxEntries))
      // Measure actual byte length, not UTF-16 code units
      let byteLength: number
      if (typeof TextEncoder !== 'undefined') {
        byteLength = new TextEncoder().encode(serialized).length
      } else if (typeof Buffer !== 'undefined') {
        byteLength = Buffer.byteLength(serialized, 'utf8')
      } else {
        // Fallback: estimate using UTF-16 length (less accurate but works)
        byteLength = serialized.length * 2
      }
      if (byteLength > 5 * 1024 * 1024) {
        // 5MB limit for localStorage
        console.warn('Cache too large for localStorage, skipping save')
        return
      }

      localStorage.setItem(finalConfig.storageKey, serialized)
    } catch (error) {
      console.warn('Failed to save cache to localStorage:', error)
    }
  }

  /**
   * Load cache from localStorage
   */
  function loadFromStorage(): void {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(finalConfig.storageKey)
      if (!stored) return

      const parsed: unknown = JSON.parse(stored)
      
      // Validate parsed data structure
      if (!Array.isArray(parsed)) {
        console.warn('Invalid cache data format: expected array')
        return
      }

      const now = Date.now()
      let totalSize = 0

      for (const item of parsed) {
        // Validate each entry is a tuple [string, CacheEntry<T>]
        if (!Array.isArray(item) || item.length !== 2) {
          continue // Skip malformed entries
        }

        const [key, entry] = item

        // Validate key is a string
        if (typeof key !== 'string') {
          continue
        }

        // Validate entry is an object with required fields
        if (
          typeof entry !== 'object' ||
          entry === null ||
          typeof (entry as any).timestamp !== 'number' ||
          typeof (entry as any).size !== 'number'
        ) {
          continue // Skip invalid entries
        }

        const cacheEntry = entry as CacheEntry<T>

        // Only load non-expired entries
        if (finalConfig.ttl === Infinity || now - cacheEntry.timestamp <= finalConfig.ttl) {
          cache.set(key, cacheEntry)
          accessOrder.push(key)
          totalSize += cacheEntry.size || 0
        }
      }

      currentSize = totalSize
      stats.size = cache.size
    } catch (error) {
      console.warn('Failed to load cache from localStorage:', error)
    }
  }

  // Load from localStorage if persistent
  if (finalConfig.persistent) {
    loadFromStorage()
  }

  return {
    /**
     * Get value from cache
     */
    get(key: string): T | null {
      const entry = cache.get(key)

      if (!entry) {
        stats.misses++
        return null
      }

      // Check if expired
      const now = Date.now()
      if (finalConfig.ttl !== Infinity && now - entry.timestamp > finalConfig.ttl) {
        this.delete(key)
        stats.misses++
        return null
      }

      // Update access time and move to end of access order
      entry.accessTime = now
      updateAccessOrder(key)
      stats.hits++

      return entry.value
    },

    /**
     * Set value in cache
     */
    set(key: string, value: T, size?: number): void {
      const now = Date.now()
      const entrySize = size || estimateSize(value)

      // Prevent infinite loop: reject entries larger than maxSize
      if (entrySize > finalConfig.maxSize) {
        console.warn(`Entry size (${entrySize}) exceeds maxSize (${finalConfig.maxSize}), rejecting`)
        return
      }

      // Check if we need to evict entries
      let attempts = 0
      const maxAttempts = cache.size + 1 // Prevent infinite loop
      while (
        (cache.size >= finalConfig.maxEntries || currentSize + entrySize > finalConfig.maxSize) &&
        cache.size > 0 &&
        attempts < maxAttempts
      ) {
        const sizeBeforeEviction = currentSize
        evictLRU()
        const sizeAfterEviction = currentSize
        
        // Break if no progress was made (defensive check)
        if (sizeBeforeEviction === sizeAfterEviction && cache.size > 0) {
          console.warn('Eviction loop detected: no progress made, breaking')
          break
        }
        
        attempts++
      }

      // Remove existing entry if present
      if (cache.has(key)) {
        const oldEntry = cache.get(key)!
        currentSize -= oldEntry.size || 0
        removeFromAccessOrder(key)
      }

      // Add new entry
      const entry: CacheEntry<T> = {
        value,
        timestamp: now,
        accessTime: now,
        size: entrySize,
      }

      cache.set(key, entry)
      accessOrder.push(key)
      currentSize += entrySize
      stats.size = cache.size

      // Save to localStorage if persistent
      if (finalConfig.persistent) {
        saveToStorage()
      }
    },

    /**
     * Delete entry from cache
     */
    delete(key: string): boolean {
      return deleteEntry(key)
    },

    /**
     * Clear all cache entries
     */
    clear(): void {
      cache.clear()
      accessOrder.length = 0
      currentSize = 0
      stats.size = 0

      // Clear localStorage if persistent
      if (finalConfig.persistent && typeof window !== 'undefined') {
        try {
          localStorage.removeItem(finalConfig.storageKey)
        } catch (error) {
          console.warn('Failed to clear cache from localStorage:', error)
        }
      }
    },

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
      return { ...stats }
    },

    /**
     * Get cache size in bytes
     */
    getSize(): number {
      return currentSize
    },

    /**
     * Clean expired entries
     */
    cleanExpired(): number {
      if (finalConfig.ttl === Infinity) return 0

      const now = Date.now()
      let cleaned = 0
      const keysToDelete: string[] = []

      for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp > finalConfig.ttl) {
          keysToDelete.push(key)
        }
      }

      for (const key of keysToDelete) {
        deleteEntry(key)
        cleaned++
      }

      return cleaned
    },
  }
}

/**
 * Global cache instances
 */
export const searchResultCache = createCacheManager<any[]>({
  maxEntries: 50,
  ttl: 15 * 60 * 1000, // 15 minutes
  persistent: true,
  storageKey: 'music_bot_search_cache',
})

export const trackMetadataCache = createCacheManager<any>({
  maxEntries: 200,
  ttl: 60 * 60 * 1000, // 1 hour
  persistent: true,
  storageKey: 'music_bot_track_cache',
})

export const albumArtCache = createCacheManager<string>({
  maxEntries: 100,
  maxSize: 50 * 1024 * 1024, // 50MB
  persistent: false, // Don't persist images to localStorage
  storageKey: 'music_bot_art_cache',
})
