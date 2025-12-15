'use client'

import { useState, useEffect, useCallback } from 'react'
// TODO: Update this import path when '@/lib/error-handler' module is present.
type ErrorInfo = {
  message: string
  timestamp: number
  severity?: string
  track?: {
    name: string
    artists: Array<{ name: string }>
  }
  retryCount?: number
}

/**
 * Toast notification item
 */
interface ToastItem {
  id: string
  error: ErrorInfo
  visible: boolean
  timerId?: number | NodeJS.Timeout
}

interface ErrorToastProps {
  errors: ErrorInfo[]
  onDismiss: (id: string) => void
}

/**
 * Error toast component for displaying error notifications
 */
export function ErrorToast({ errors, onDismiss }: ErrorToastProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // Add new errors to toast queue
  const [shownTimestamps, setShownTimestamps] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (errors.length === 0) return

    const unseenErrors = errors.filter(e => !shownTimestamps.has(e.timestamp))
    if (unseenErrors.length === 0) return

    const newToasts: ToastItem[] = unseenErrors.map((error) => ({
      id: `toast-${error.timestamp}-${Math.random().toString(36).substring(2, 9)}`,
      error,
      visible: true,
    }))

    setToasts((prev) => [...prev, ...newToasts])
    setShownTimestamps(prev => {
      const next = new Set(prev)
      unseenErrors.forEach(e => next.add(e.timestamp))
      return next
    })
  }, [errors])

  // Auto-dismiss toasts after 5 seconds
  useEffect(() => {
    const timers: Map<string, number | NodeJS.Timeout> = new Map()

    toasts.forEach((toast) => {
      if (toast.visible && !toast.timerId) {
        const timer = setTimeout(() => {
          handleDismiss(toast.id)
        }, 5000)
        timers.set(toast.id, timer)
      }
    })

    // Update toasts with timer IDs
    if (timers.size > 0) {
      setToasts((prev) =>
        prev.map((toast) => {
          const timerId = timers.get(toast.id)
          return timerId ? { ...toast, timerId } : toast
        })
      )
    }

    return () => {
      timers.forEach((timer) => clearTimeout(timer))
    }
  }, [toasts, handleDismiss])

  const handleDismiss = useCallback(
    (id: string) => {
      setToasts((prev) => {
        const updated = prev.map((toast) => {
          if (toast.id === id) {
            // Clear timer if exists
            if (toast.timerId) {
              clearTimeout(toast.timerId)
            }
            return { ...toast, visible: false, timerId: undefined }
          }
          return toast
        })
        return updated
      })

      // Remove from state after animation
      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id))
        onDismiss(id)
      }, 300)
    },
    [onDismiss]
  )
  const getSeverityClass = (severity?: string): string => {
    switch (severity) {
      case 'error':
        return 'error-toast-error'
      case 'warning':
        return 'error-toast-warning'
      case 'info':
        return 'error-toast-info'
      default:
        return 'error-toast-info'
    }
  }

  const getSeverityIcon = (severity?: string): string => {
    switch (severity) {
      case 'error':
        return 'fa-exclamation-circle'
      case 'warning':
        return 'fa-exclamation-triangle'
      case 'info':
        return 'fa-info-circle'

      default:
        return 'fa-info-circle'
    }
  }

  // Fix: Use the toasts state variable which is presumably defined via useState in this component.
  // Only reference the variable that is *definitely* defined.

  if (!Array.isArray(toasts) || toasts.length === 0) {
    return null
  }

  return (
    <div className="error-toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`error-toast ${getSeverityClass(toast.error.severity)} ${
            toast.visible ? 'visible' : 'dismissing'
          }`}
        >
          <div className="error-toast-content">
            <div className="error-toast-icon">
              <i className={`fas ${getSeverityIcon(toast.error.severity)}`}></i>
            </div>
            <div className="error-toast-message">
              <div className="error-toast-title">{toast.error.message}</div>
              {toast.error.track && (
                <div className="error-toast-track">
                  {toast.error.track.name} - {Array.isArray(toast.error.track.artists) && toast.error.track.artists.length > 0 ? toast.error.track.artists[0].name : 'Unknown'}
                </div>
              )}
              {toast.error.retryCount !== undefined && toast.error.retryCount > 0 && (
                <div className="error-toast-retry">
                  Retry attempt {toast.error.retryCount}
                </div>
              )}
            </div>
            <button
              type="button"
              className="error-toast-dismiss"
              onClick={() => handleDismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      ))}
      <style jsx>{`
        .error-toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-width: 400px;
          pointer-events: none;
        }

        .error-toast {
          background: var(--bg-secondary, #2a2a2a);
          border-radius: 8px;
          padding: 12px 16px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: flex-start;
          gap: 12px;
          pointer-events: auto;
          opacity: 0;
          transform: translateX(100%);
          transition: opacity 0.3s ease, transform 0.3s ease;
          border-left: 4px solid;
        }

        .error-toast.visible {
          opacity: 1;
          transform: translateX(0);
        }

        .error-toast.dismissing {
          opacity: 0;
          transform: translateX(100%);
        }

        .error-toast-error {
          border-left-color: #e74c3c;
        }

        .error-toast-warning {
          border-left-color: #f39c12;
        }

        .error-toast-info {
          border-left-color: #3498db;
        }

        .error-toast-content {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          flex: 1;
        }

        .error-toast-icon {
          font-size: 20px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .error-toast-error .error-toast-icon {
          color: #e74c3c;
        }

        .error-toast-warning .error-toast-icon {
          color: #f39c12;
        }

        .error-toast-info .error-toast-icon {
          color: #3498db;
        }

        .error-toast-message {
          flex: 1;
          min-width: 0;
        }

        .error-toast-title {
          font-weight: 600;
          color: var(--text, #ffffff);
          margin-bottom: 4px;
          font-size: 14px;
        }

        .error-toast-track {
          font-size: 12px;
          color: var(--text-dim, #999);
          margin-top: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .error-toast-retry {
          font-size: 11px;
          color: var(--text-dim, #999);
          margin-top: 2px;
          font-style: italic;
        }

        .error-toast-dismiss {
          background: none;
          border: none;
          color: var(--text-dim, #999);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: color 0.2s ease;
        }

export default ErrorToast;
        .error-toast-dismiss:focus {
          outline: 2px solid var(--accent, #3498db);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}

export default ErrorToast;
  );
}

export default ErrorToast;
// (No code necessary; duplicate exports and stray braces/parens removed.)
