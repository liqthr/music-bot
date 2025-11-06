/**
 * Memory Monitor
 * Tracks memory usage and triggers cleanup when needed
 */

/**
 * Memory usage information
 */
export interface MemoryInfo {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
  available: boolean
}

/**
 * Memory thresholds
 */
const MEMORY_WARNING_THRESHOLD = 150 * 1024 * 1024 // 150MB
const MEMORY_CLEANUP_THRESHOLD = 180 * 1024 * 1024 // 180MB
const MEMORY_CRITICAL_THRESHOLD = 200 * 1024 * 1024 // 200MB

/**
 * Get current memory usage
 */
export function getMemoryInfo(): MemoryInfo {
  if (typeof window === 'undefined' || !(performance as any).memory) {
    return {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
      available: false,
    }
  }

  const memory = (performance as any).memory
  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
    available: true,
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Check if memory usage is above threshold
 */
export function isMemoryHigh(): boolean {
  const info = getMemoryInfo()
  if (!info.available) return false
  return info.usedJSHeapSize > MEMORY_WARNING_THRESHOLD
}

/**
 * Check if memory cleanup is needed
 */
export function needsMemoryCleanup(): boolean {
  const info = getMemoryInfo()
  if (!info.available) return false
  return info.usedJSHeapSize > MEMORY_CLEANUP_THRESHOLD
}

/**
 * Check if memory is critical
 */
export function isMemoryCritical(): boolean {
  const info = getMemoryInfo()
  if (!info.available) return false
  return info.usedJSHeapSize > MEMORY_CRITICAL_THRESHOLD
}

/**
 * Create memory monitor instance
 */
export function createMemoryMonitor() {
  let intervalId: NodeJS.Timeout | null = null
  let onWarning: ((info: MemoryInfo) => void) | undefined
  let onCleanup: ((info: MemoryInfo) => void) | undefined
  let onCritical: ((info: MemoryInfo) => void) | undefined
  let lastWarningTime = 0
  let lastCleanupTime = 0
  const WARNING_COOLDOWN = 60000 // 1 minute
  const CLEANUP_COOLDOWN = 30000 // 30 seconds

  /**
   * Check memory usage and trigger callbacks
   */
  function checkMemory(): void {
    const info = getMemoryInfo()
    if (!info.available) return

    const now = Date.now()

    // Check critical threshold
    if (info.usedJSHeapSize > MEMORY_CRITICAL_THRESHOLD) {
      if (onCritical) {
        onCritical(info)
      }
      console.warn(`[Memory Monitor] Critical memory usage: ${formatBytes(info.usedJSHeapSize)}`)
      return
    }

    // Check cleanup threshold
    if (info.usedJSHeapSize > MEMORY_CLEANUP_THRESHOLD) {
      if (now - lastCleanupTime > CLEANUP_COOLDOWN) {
        if (onCleanup) {
          onCleanup(info)
        }
        lastCleanupTime = now
        console.warn(`[Memory Monitor] High memory usage, cleanup triggered: ${formatBytes(info.usedJSHeapSize)}`)
      }
      return
    }

    // Check warning threshold
    if (info.usedJSHeapSize > MEMORY_WARNING_THRESHOLD) {
      if (now - lastWarningTime > WARNING_COOLDOWN) {
        if (onWarning) {
          onWarning(info)
        }
        lastWarningTime = now
        console.warn(`[Memory Monitor] Memory usage warning: ${formatBytes(info.usedJSHeapSize)}`)
      }
    }
  }

  return {
    /**
     * Start memory monitoring
     */
    start(interval: number = 10000): void {
      if (intervalId) return

      intervalId = setInterval(() => {
        checkMemory()
      }, interval)
    },

    /**
     * Stop memory monitoring
     */
    stop(): void {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    },

    /**
     * Set warning callback
     */
    onWarningCallback(callback: (info: MemoryInfo) => void): void {
      onWarning = callback
    },

    /**
     * Set cleanup callback
     */
    onCleanupCallback(callback: (info: MemoryInfo) => void): void {
      onCleanup = callback
    },

    /**
     * Set critical callback
     */
    onCriticalCallback(callback: (info: MemoryInfo) => void): void {
      onCritical = callback
    },

  /**
   * Get current memory info
   */
  getInfo(): MemoryInfo {
    return getMemoryInfo()
    },

  /**
   * Force garbage collection (if available)
   */
  forceGC(): void {
    if (typeof window !== 'undefined' && (window as any).gc) {
      try {
          ;(window as any).gc()
        console.log('[Memory Monitor] Garbage collection triggered')
      } catch (error) {
        console.warn('[Memory Monitor] Failed to trigger GC:', error)
      }
    }
    },
  }
}

/**
 * Global memory monitor instance
 */
export const memoryMonitor = createMemoryMonitor()
