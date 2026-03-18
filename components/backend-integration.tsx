'use client'

import { useState, useCallback, useEffect } from 'react'

interface Session {
  sessionId: string
  createdAt: string
  lastActive: string
  files: Record<string, FileInfo>
}

interface FileInfo {
  filePath: string
  extension: string
}

interface DownloadResponse {
  success: boolean
  trackId: string
  extension: string
  fileName: string
  streamUrl: string
  message: string
}

/**
 * Backend integration for music downloading and streaming
 */
export function useBackendIntegration() {
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [isBackendConnected, setIsBackendConnected] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({})

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

  // Check backend health
  const checkBackendHealth = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/health`)
      if (response.ok) {
        setIsBackendConnected(true)
        return true
      }
    } catch (error) {
      console.error('Backend health check failed:', error)
      setIsBackendConnected(false)
      return false
    }
  }, [])

  // Create new session
  const createSession = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        const sessionData = await response.json()
        setCurrentSession(sessionData)
        console.log('✅ Session created:', sessionData.sessionId)
        return sessionData.sessionId
      }
    } catch (error) {
      console.error('Failed to create session:', error)
      return null
    }
  }, [])

  // Download track
  const downloadTrack = useCallback(async (url: string, source: string = 'youtube') => {
    if (!currentSession) {
      console.error('No active session')
      return null
    }

    try {
      console.log(`🎵 Starting download: ${source} -> ${url}`)
      
      const response = await fetch(`${BACKEND_URL}/download/${currentSession.sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, source, format: 'mp3' })
      })

      if (response.ok) {
        const downloadData: DownloadResponse = await response.json()
        console.log('✅ Download started:', downloadData)
        
        // Simulate progress updates (in real implementation, use WebSockets)
        const progressInterval = setInterval(() => {
          setDownloadProgress(prev => ({
            ...prev,
            [downloadData.trackId]: Math.min((prev[downloadData.trackId] || 0) + 10, 100)
          }))
        }, 500)

        // Stop progress after completion
        setTimeout(() => {
          clearInterval(progressInterval)
          setDownloadProgress(prev => ({
            ...prev,
            [downloadData.trackId]: 100
          }))
        }, 5000)

        return downloadData
      }
    } catch (error) {
      console.error('Download failed:', error)
      return null
    }
  }, [currentSession])

  // Get stream URL for track
  const getStreamUrl = useCallback((trackId: string) => {
    if (!currentSession) return null
    return `${BACKEND_URL}/stream/${currentSession.sessionId}/${trackId}`
  }, [currentSession])

  // Send heartbeat to keep session alive
  const sendHeartbeat = useCallback(async () => {
    if (!currentSession) return

    try {
      await fetch(`${BACKEND_URL}/session/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSession.sessionId })
      })
    } catch (error) {
      console.error('Heartbeat failed:', error)
    }
  }, [currentSession])

  // Initialize session on mount
  useEffect(() => {
    checkBackendHealth()
    createSession()
    
    // Send heartbeat every 5 minutes
    const heartbeatInterval = setInterval(sendHeartbeat, 5 * 60 * 1000)
    
    return () => clearInterval(heartbeatInterval)
  }, [checkBackendHealth, createSession, sendHeartbeat])

  return {
    currentSession,
    isBackendConnected,
    downloadProgress,
    createSession,
    downloadTrack,
    getStreamUrl,
    sendHeartbeat
  }
}
