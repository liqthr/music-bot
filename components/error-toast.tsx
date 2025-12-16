'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ErrorInfo, ErrorSeverity } from '@/lib/error-handler'

interface ToastItem {
  id: string
  error: ErrorInfo
  visible: boolean
  timerId?: ReturnType<typeof setTimeout>
}

interface ErrorToastProps {
  errors: ErrorInfo[]
  onDismiss: (id: string) => void
}

export function ErrorToast({ errors, onDismiss }: ErrorToastProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [seenTimestamps, setSeenTimestamps] = useState<Set<number>>(new Set())

  const handleDismiss = useCallback(
    (id: string) => {
      setToasts((prev) =>
        prev.map((toast) =>
          toast.id === id ? { ...toast, visible: false } : toast
        )
      )

      // Remove after animation
      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id))
        onDismiss(id)
      }, 300)
    },
    [onDismiss]
  )

  // Add new errors as toasts, de-duplicated by timestamp
  useEffect(() => {
    if (!errors.length) return

    setSeenTimestamps((prevSeen) => {
      const nextSeen = new Set(prevSeen)
      const newToasts: ToastItem[] = []

      for (const error of errors) {
        if (nextSeen.has(error.timestamp)) continue
        nextSeen.add(error.timestamp)
        newToasts.push({
          id: `toast-${error.timestamp}-${Math.random().toString(36).slice(2, 9)}`,
          error,
          visible: true,
        })
      }

      if (newToasts.length) {
        setToasts((prev) => [...prev, ...newToasts])
      }

      return nextSeen
    })
  }, [errors])

  // Auto-dismiss after 5s
  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>()

    toasts.forEach((toast) => {
      if (toast.visible && !toast.timerId) {
        const timer = setTimeout(() => {
          handleDismiss(toast.id)
        }, 5000)
        timers.set(toast.id, timer)
      }
    })

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

  const getSeverityClass = (severity: ErrorSeverity): string => {
    switch (severity) {
      case 'error':
        return 'error-toast-error'
      case 'warning':
        return 'error-toast-warning'
      case 'info':
      default:
        return 'error-toast-info'
    }
  }

  const getSeverityIcon = (severity: ErrorSeverity): string => {
    switch (severity) {
      case 'error':
        return 'fa-exclamation-circle'
      case 'warning':
        return 'fa-exclamation-triangle'
      case 'info':
      default:
        return 'fa-info-circle'
    }
  }

  if (!toasts.length) return null

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
                  {toast.error.track.name} -{' '}
                  {toast.error.track.artists?.[0]?.name || 'Unknown'}
                </div>
              )}
              {toast.error.retryCount !== undefined &&
                toast.error.retryCount > 0 && (
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

        .error-toast-dismiss:hover {
          color: var(--text, #ffffff);
        }

        .error-toast-dismiss:focus {
          outline: 2px solid var(--accent, #3498db);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  )
}

export default ErrorToast
