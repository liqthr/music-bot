'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ErrorInfo, ErrorSeverity } from '@/lib/error-handler'

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

export const ErrorToast = ({ errors, onDismiss }: ErrorToastProps) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [seenTimestamps, setSeenTimestamps] = useState<Set<number>>(new Set())
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const handleDismiss = useCallback(
    (id: string) => {
      setToasts((prev) =>
        prev.map((toast) =>
          toast.id === id ? { ...toast, visible: false, timerId: undefined } : toast,
        ),
      )

      // Remove after exit animation
      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id))
        onDismiss(id)
      }, 200)
    },
    [onDismiss],
  )

  // Add new errors as toasts (deduplicated by timestamp)
  useEffect(() => {
    if (!errors.length) return

    setSeenTimestamps((prev) => {
      const next = new Set(prev)
      const newToasts: ToastItem[] = []

      for (const error of errors) {
        if (next.has(error.timestamp)) continue
        next.add(error.timestamp)
        newToasts.push({
          id: `toast-${error.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
          error,
          visible: true,
        })
      }

      if (newToasts.length) {
        setToasts((prevToasts) => [...prevToasts, ...newToasts])
      }

      return next
    })
  }, [errors])

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const createdIds: string[] = []

    setToasts((prev) => {
      let changed = false

      const next = prev.map((toast) => {
        if (!toast.visible || toast.timerId) return toast

        const timer = setTimeout(() => handleDismiss(toast.id), 5000)
        timersRef.current[toast.id] = timer
        createdIds.push(toast.id)
        changed = true

        return { ...toast, timerId: timer }
      })

      return changed ? next : prev
    })

    return () => {
      if (!createdIds.length) return

      createdIds.forEach((id) => {
        const timer = timersRef.current[id]
        if (timer) {
          clearTimeout(timer)
          delete timersRef.current[id]
        }
      })

      setToasts((prev) =>
        prev.map((toast) =>
          createdIds.includes(toast.id) ? { ...toast, timerId: undefined } : toast,
        ),
      )
    }
  }, [handleDismiss])

  const getSeverityClass = (severity: ErrorSeverity): string => {
    switch (severity) {
      case 'error':
        return 'border-red-500/80 bg-red-950/80 text-red-50'
      case 'warning':
        return 'border-amber-500/80 bg-amber-950/80 text-amber-50'
      case 'info':
      default:
        return 'border-sky-500/80 bg-sky-950/80 text-sky-50'
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

  if (!toasts.length) {
    return null
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex max-w-md flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex transform items-start gap-3 rounded-lg border px-3 py-2 text-sm shadow-lg ring-1 ring-black/10 transition-all ${
            toast.visible ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
          } ${getSeverityClass(toast.error.severity)}`}
        >
          <div className="mt-1 text-base">
            <i className={`fas ${getSeverityIcon(toast.error.severity)}`} aria-hidden="true" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="font-medium leading-snug">{toast.error.message}</div>
            {toast.error.track && (
              <div className="text-xs opacity-80">
                {toast.error.track.name} –{' '}
                {toast.error.track.artists?.[0]?.name ?? 'Unknown artist'}
              </div>
            )}
            {typeof toast.error.retryCount === 'number' && toast.error.retryCount > 0 && (
              <div className="text-[11px] italic opacity-80">
                Retry attempt {toast.error.retryCount}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleDismiss(toast.id)}
            aria-label="Dismiss notification"
            className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs opacity-80 transition hover:bg-white/10 hover:opacity-100"
          >
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}

