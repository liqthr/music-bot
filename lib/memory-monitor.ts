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
 * Memory monitor class
 */
export class MemoryMonitor {
  private intervalId: NodeJS.Timeout | null = null
  private onWarning?: (info: MemoryInfo) => void
  private onCleanup?: (info: MemoryInfo) => void
  private onCritical?: (info: MemoryInfo) => void
  private lastWarningTime: number = 0
  private lastCleanupTime: number = 0
  private readonly WARNING_COOLDOWN = 60000 // 1 minute
  private readonly CLEANUP_COOLDOWN = 30000 // 30 seconds

  constructor() {
    // Start monitoring if available
    if (getMemoryInfo().available) {
      this.start()
    }
  }

  /**
   * Start memory monitoring
   */
  start(interval: number = 10000): void {
    if (this.intervalId) return

    this.intervalId = setInterval(() => {
      this.checkMemory()
    }, interval)
  }

  /**
   * Stop memory monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Set warning callback
   */
  onWarningCallback(callback: (info: MemoryInfo) => void): void {
    this.onWarning = callback
  }

  /**
   * Set cleanup callback
   */
  onCleanupCallback(callback: (info: MemoryInfo) => void): void {
    this.onCleanup = callback
  }

  /**
   * Set critical callback
   */
  onCriticalCallback(callback: (info: MemoryInfo) => void): void {
    this.onCritical = callback
  }

  /**
   * Check memory usage and trigger callbacks
   */
  private checkMemory(): void {
    const info = getMemoryInfo()
    if (!info.available) return

    const now = Date.now()

    // Check critical threshold
    if (info.usedJSHeapSize > MEMORY_CRITICAL_THRESHOLD) {
      if (this.onCritical) {
        this.onCritical(info)
      }
      console.warn(`[Memory Monitor] Critical memory usage: ${formatBytes(info.usedJSHeapSize)}`)
      return
    }

    // Check cleanup threshold
    if (info.usedJSHeapSize > MEMORY_CLEANUP_THRESHOLD) {
      if (now - this.lastCleanupTime > this.CLEANUP_COOLDOWN) {
        if (this.onCleanup) {
          this.onCleanup(info)
        }
        this.lastCleanupTime = now
        console.warn(`[Memory Monitor] High memory usage, cleanup triggered: ${formatBytes(info.usedJSHeapSize)}`)
      }
      return
    }

    // Check warning threshold
    if (info.usedJSHeapSize > MEMORY_WARNING_THRESHOLD) {
      if (now - this.lastWarningTime > this.WARNING_COOLDOWN) {
        if (this.onWarning) {
          this.onWarning(info)
        }
        this.lastWarningTime = now
        console.warn(`[Memory Monitor] Memory usage warning: ${formatBytes(info.usedJSHeapSize)}`)
      }
    }
  }

  /**
   * Get current memory info
   */
  getInfo(): MemoryInfo {
    return getMemoryInfo()
  }

  /**
   * Force garbage collection (if available)
   */
  forceGC(): void {
    if (typeof window !== 'undefined' && (window as any).gc) {
      try {
        (window as any).gc()
        console.log('[Memory Monitor] Garbage collection triggered')
      } catch (error) {
        console.warn('[Memory Monitor] Failed to trigger GC:', error)
      }
    }
  }
}

/**
 * Global memory monitor instance
 */
export const memoryMonitor = new MemoryMonitor()


