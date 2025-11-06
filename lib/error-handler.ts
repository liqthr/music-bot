import type { Track } from './types'

/**
 * Error severity levels for error messages
 */
export type ErrorSeverity = 'info' | 'warning' | 'error'

/**
 * Error types that can occur during playback
 */
export type ErrorType =
  | 'network'
  | 'not_found'
  | 'forbidden'
  | 'timeout'
  | 'decode'
  | 'unknown'

/**
 * Error information structure
 */
export interface ErrorInfo {
  type: ErrorType
  message: string
  severity: ErrorSeverity
  timestamp: number
  track?: Track
  retryCount?: number
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number
  delays: number[] // Delays in milliseconds for each retry attempt
  autoSkip: boolean // Whether to auto-skip after all retries fail
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  delays: [0, 1000, 2000, 4000], // Immediate, 1s, 2s, 4s
  autoSkip: true,
}

/**
 * Map technical errors to user-friendly messages
 */
function getErrorMessage(error: any, retryCount: number): ErrorInfo {
  const timestamp = Date.now()

  // Check for network errors
  if (
    error instanceof TypeError ||
    error.message?.includes('network') ||
    error.message?.includes('fetch') ||
    error.message?.includes('Failed to fetch')
  ) {
    return {
      type: 'network',
      message: retryCount > 0 ? 'Connection issue. Retrying...' : 'Connection issue',
      severity: 'warning',
      timestamp,
      retryCount,
    }
  }

  // Check for 404 errors
  if (
    error.code === 4 ||
    error.code === 'MEDIA_ERR_SRC_NOT_SUPPORTED' ||
    error.message?.includes('404') ||
    error.message?.includes('not found')
  ) {
    return {
      type: 'not_found',
      message: 'Track not available',
      severity: 'error',
      timestamp,
      retryCount,
    }
  }

  // Check for 403 errors
  if (
    error.code === 3 ||
    error.message?.includes('403') ||
    error.message?.includes('forbidden') ||
    error.message?.includes('region')
  ) {
    return {
      type: 'forbidden',
      message: 'Track not available in your region',
      severity: 'error',
      timestamp,
      retryCount,
    }
  }

  // Check for timeout errors
  if (
    error.message?.includes('timeout') ||
    error.message?.includes('timed out') ||
    error.name === 'TimeoutError'
  ) {
    return {
      type: 'timeout',
      message: retryCount > 0 ? 'Loading took too long. Retrying...' : 'Loading timeout',
      severity: 'warning',
      timestamp,
      retryCount,
    }
  }

  // Check for decode errors
  if (
    error.code === 3 ||
    error.code === 'MEDIA_ERR_DECODE' ||
    error.message?.includes('decode')
  ) {
    return {
      type: 'decode',
      message: 'Unable to decode audio',
      severity: 'error',
      timestamp,
      retryCount,
    }
  }

  // Unknown error
  return {
    type: 'unknown',
    message: retryCount > 0 ? 'Playback error. Retrying...' : 'Playback error occurred',
    severity: 'error',
    timestamp,
    retryCount,
  }
}

/**
   * Log error with context
   */
function logError(
  error: any,
  track: Track | undefined,
  retryCount: number | undefined,
  onErrorCallback?: (error: ErrorInfo) => void
): ErrorInfo {
    const errorInfo = getErrorMessage(error, retryCount || 0)
    if (track) {
      errorInfo.track = track
    }

    console.error('[ErrorHandler]', {
      type: errorInfo.type,
      message: errorInfo.message,
      track: track ? `${track.name} - ${track.artists[0]?.name || 'Unknown'}` : 'N/A',
      platform: track?.platform || 'N/A',
      retryCount: retryCount || 0,
      timestamp: new Date(errorInfo.timestamp).toISOString(),
      originalError: error,
    })

    return errorInfo
  }

/**
 * Create error handler with retry logic and exponential backoff
 */
export function createErrorHandler(config?: Partial<RetryConfig>) {
  const retryConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  let onErrorCallback: ((error: ErrorInfo) => void) | undefined
  let onRetryCallback: ((attempt: number, maxAttempts: number) => void) | undefined
  let onRetryCompleteCallback: ((success: boolean) => void) | undefined

  return {
    /**
     * Set callback for error notifications
     */
    setOnError(callback: (error: ErrorInfo) => void) {
      onErrorCallback = callback
    },

    /**
     * Set callback for retry status updates
     */
    setOnRetry(callback: (attempt: number, maxAttempts: number) => void) {
      onRetryCallback = callback
    },

    /**
     * Set callback for retry completion
     */
    setOnRetryComplete(callback: (success: boolean) => void) {
      onRetryCompleteCallback = callback
    },

  /**
   * Retry a function with exponential backoff
   */
  async retry<T>(
    fn: () => Promise<T>,
    track?: Track,
    onRetry?: (attempt: number) => void
  ): Promise<T> {
    let lastError: any = null
      const maxAttempts = retryConfig.maxAttempts

    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
      try {
        // Log error if this is a retry attempt
        if (attempt > 0) {
            const errorInfo = logError(lastError, track, attempt, onErrorCallback)
            if (onErrorCallback) {
              onErrorCallback(errorInfo)
          }
            if (onRetryCallback) {
              onRetryCallback(attempt, maxAttempts)
          }
          if (onRetry) {
            onRetry(attempt)
          }
        }

        // Execute the function
        const result = await fn()
        
        // Success - log if it was a retry
        if (attempt > 0) {
          console.log(`[ErrorHandler] Retry successful after ${attempt} attempt(s)`)
            if (onRetryCompleteCallback) {
              onRetryCompleteCallback(true)
          }
        }

        return result
      } catch (error: any) {
        lastError = error

          // Don't retry on certain errors (404, 403) - non-retryable on any attempt
        const errorInfo = getErrorMessage(error, attempt)
          if (errorInfo.type === 'not_found' || errorInfo.type === 'forbidden') {
          // Log and notify immediately for non-retryable errors
            const loggedError = logError(error, track, attempt, onErrorCallback)
            if (onErrorCallback) {
              onErrorCallback(loggedError)
          }
            if (onRetryCompleteCallback) {
              onRetryCompleteCallback(false)
          }
          throw error
        }

        // If this was the last attempt, fail
        if (attempt >= maxAttempts) {
            const loggedError = logError(error, track, attempt, onErrorCallback)
            if (onErrorCallback) {
              onErrorCallback(loggedError)
          }
            if (onRetryCompleteCallback) {
              onRetryCompleteCallback(false)
          }
          throw error
        }

        // Calculate delay for next retry
          // Handle empty delays array first
          if (retryConfig.delays.length === 0) {
            console.warn('Retry delays array is empty, using default 1000ms delay')
            await new Promise((resolve) => setTimeout(resolve, 1000))
            continue
          }
          
          // Use safe index to prevent out-of-bounds access
          const delayIndex = Math.max(0, Math.min(attempt + 1, retryConfig.delays.length - 1))
          const delay = retryConfig.delays[delayIndex]
        
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError
    },

  /**
   * Handle audio element error
   */
  handleAudioError(
    error: Event,
    audioElement: HTMLAudioElement,
    track?: Track
  ): ErrorInfo {
    const mediaError = (error.target as HTMLAudioElement)?.error
    let errorDetails: any = {}

    if (mediaError) {
      errorDetails = {
        code: mediaError.code,
        message: mediaError.message || `Media error code: ${mediaError.code}`,
      }
    } else {
      errorDetails = {
        message: 'Unknown audio error',
      }
    }

      const errorInfo = logError(errorDetails, track, 0, onErrorCallback)
    
      if (onErrorCallback) {
        onErrorCallback(errorInfo)
    }

    return errorInfo
    },

  /**
   * Get retry status message
   */
  getRetryStatusMessage(attempt: number, maxAttempts: number): string {
    if (attempt === 0) return ''
    return `Retrying... ${attempt}/${maxAttempts}`
    },

  /**
   * Check if error is retryable
   */
  isRetryable(error: any): boolean {
    const errorInfo = getErrorMessage(error, 0)
    return errorInfo.type !== 'not_found' && errorInfo.type !== 'forbidden'
    },

  /**
   * Update retry configuration
   */
  updateConfig(config: Partial<RetryConfig>) {
      Object.assign(retryConfig, config)
    },
  }
}

/**
 * Default error handler instance
 */
export const errorHandler = createErrorHandler()
