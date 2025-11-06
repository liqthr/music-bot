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
 * LRU Cache Manager with TTL support
 */
export class CacheManager<T> {
  private cache: Map<string, CacheEntry<T>>
  private accessOrder: string[] // Track access order for LRU
  private config: Required<CacheConfig>
  private stats: CacheStats
  private currentSize: number = 0

  constructor(config: CacheConfig) {
    this.config = {
      maxEntries: config.maxEntries,
      ttl: config.ttl || Infinity,
      maxSize: config.maxSize || Infinity,
      persistent: config.persistent || false,
      storageKey: config.storageKey || 'cache',
    }
    this.cache = new Map()
    this.accessOrder = []
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      maxSize: config.maxEntries,
    }

    // Load from localStorage if persistent
    if (this.config.persistent) {
      this.loadFromStorage()
    }
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check if expired
    const now = Date.now()
    if (this.config.ttl !== Infinity && now - entry.timestamp > this.config.ttl) {
      this.delete(key)
      this.stats.misses++
      return null
    }

    // Update access time and move to end of access order
    entry.accessTime = now
    this.updateAccessOrder(key)
    this.stats.hits++

    return entry.value
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, size?: number): void {
    const now = Date.now()
    const entrySize = size || this.estimateSize(value)

    // Prevent infinite loop: reject entries larger than maxSize
    if (entrySize > this.config.maxSize) {
      console.warn(`Entry size (${entrySize}) exceeds maxSize (${this.config.maxSize}), rejecting`)
      return
    }

    // Check if we need to evict entries
    let attempts = 0
    const maxAttempts = this.cache.size + 1 // Prevent infinite loop
    while (
      (this.cache.size >= this.config.maxEntries || this.currentSize + entrySize > this.config.maxSize) &&
      this.cache.size > 0 &&
      attempts < maxAttempts
    ) {
      const sizeBeforeEviction = this.currentSize
      this.evictLRU()
      const sizeAfterEviction = this.currentSize
      
      // Break if no progress was made (defensive check)
      if (sizeBeforeEviction === sizeAfterEviction && this.cache.size > 0) {
        console.warn('Eviction loop detected: no progress made, breaking')
        break
      }
      
      attempts++
    }

    // Remove existing entry if present
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key)!
      this.currentSize -= oldEntry.size || 0
      this.removeFromAccessOrder(key)
    }

    // Add new entry
    const entry: CacheEntry<T> = {
      value,
      timestamp: now,
      accessTime: now,
      size: entrySize,
    }

    this.cache.set(key, entry)
    this.accessOrder.push(key)
    this.currentSize += entrySize
    this.stats.size = this.cache.size

    // Save to localStorage if persistent
    if (this.config.persistent) {
      this.saveToStorage()
    }
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    this.currentSize -= entry.size || 0
    this.cache.delete(key)
    this.removeFromAccessOrder(key)
    this.stats.size = this.cache.size

    // Save to localStorage if persistent
    if (this.config.persistent) {
      this.saveToStorage()
    }

    return true
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.accessOrder = []
    this.currentSize = 0
    this.stats.size = 0

    // Clear localStorage if persistent
    if (this.config.persistent && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(this.config.storageKey)
      } catch (error) {
        console.warn('Failed to clear cache from localStorage:', error)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Get cache size in bytes
   */
  getSize(): number {
    return this.currentSize
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): number {
    if (this.config.ttl === Infinity) return 0

    const now = Date.now()
    let cleaned = 0
    const keysToDelete: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttl) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.delete(key)
      cleaned++
    }

    return cleaned
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return

    const lruKey = this.accessOrder[0]
    this.delete(lruKey)
    this.stats.evictions++
  }

  /**
   * Update access order (move key to end)
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
      this.accessOrder.push(key)
    }
  }

  /**
   * Remove key from access order
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
  }

  /**
   * Estimate size of value in bytes
   */
  private estimateSize(value: T): number {
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
   * Save cache to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return

    try {
      const data: Array<[string, CacheEntry<T>]> = []
      for (const [key, entry] of this.cache.entries()) {
        // Only save non-expired entries
        const now = Date.now()
        if (this.config.ttl === Infinity || now - entry.timestamp <= this.config.ttl) {
          data.push([key, entry])
        }
      }

      // Limit size to avoid localStorage quota issues
      const serialized = JSON.stringify(data.slice(0, this.config.maxEntries))
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

      localStorage.setItem(this.config.storageKey, serialized)
    } catch (error) {
      console.warn('Failed to save cache to localStorage:', error)
    }
  }

  /**
   * Load cache from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(this.config.storageKey)
      if (!stored) return

      const parsed: unknown = JSON.parse(stored)
      
      // Validate parsed data structure
      if (!Array.isArray(parsed)) {
        console.warn('Invalid cache data format: expected array')
        return
      }

      const now = Date.now()
      let validEntries = 0
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
        if (this.config.ttl === Infinity || now - cacheEntry.timestamp <= this.config.ttl) {
          this.cache.set(key, cacheEntry)
          this.accessOrder.push(key)
          totalSize += cacheEntry.size || 0
          validEntries++
        }
      }

      this.currentSize = totalSize
      this.stats.size = this.cache.size
    } catch (error) {
      console.warn('Failed to load cache from localStorage:', error)
    }
  }
}

/**
 * Global cache instances
 */
export const searchResultCache = new CacheManager<any[]>({
  maxEntries: 50,
  ttl: 15 * 60 * 1000, // 15 minutes
  persistent: true,
  storageKey: 'music_bot_search_cache',
})

export const trackMetadataCache = new CacheManager<any>({
  maxEntries: 200,
  ttl: 60 * 60 * 1000, // 1 hour
  persistent: true,
  storageKey: 'music_bot_track_cache',
})

export const albumArtCache = new CacheManager<string>({
  maxEntries: 100,
  maxSize: 50 * 1024 * 1024, // 50MB
  persistent: false, // Don't persist images to localStorage
  storageKey: 'music_bot_art_cache',
})


