'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { SearchBar } from '@/components/search-bar'
import { SearchResults } from '@/components/search-results'
import { SearchFiltersComponent as SearchFilters } from '@/components/search-filters'
import { Player } from '@/components/player'
import { MiniPlayer } from '@/components/mini-player'
import dynamic from 'next/dynamic'

// Lazy load non-critical components
const LyricsPanel = dynamic(() => import('@/components/lyrics-panel').then((mod) => ({ default: mod.LyricsPanel })), {
  ssr: false,
  loading: () => <div className="lyrics-loading">Loading lyrics...</div>,
})

const ThemeSelector = dynamic(
  () => import('@/components/theme-selector').then((mod) => ({ default: mod.ThemeSelector })),
  {
    ssr: false,
    loading: () => null,
  }
)
import { searchByMode, findTrackOnAlternativePlatforms } from '@/lib/search'
import { shuffleQueue } from '@/lib/queue-utils'
import {
  saveQueue,
  loadQueue,
  getSavedQueues,
  deleteQueue,
  autoSaveQueue,
  getAutoSavedQueue,
  clearAutoSave,
} from '@/lib/queue-persistence'
import type {
  Track,
  SearchMode,
  RepeatMode,
  SavedQueue,
  CrossfadeSettings,
  NormalizationSettings,
  PlaybackSettings,
  EQPreset,
  SearchFilters as SearchFiltersType,
} from '@/lib/types'
import { EQ_PRESETS } from '@/lib/types'
import { getItem, setItem } from '@/lib/storage'
import { fetchLyrics, getGeniusSearchUrl, type ParsedLyrics } from '@/lib/lyrics-api'
import {
  loadThemeSettings,
  saveThemeSettings,
  applyTheme,
  detectSystemPreference,
  getEffectiveMode,
} from '@/lib/theme-manager'
import type { ThemeSettings } from '@/lib/types'
import { applyFilters, getDefaultFilters } from '@/lib/search-filter-utils'
import { addToHistory } from '@/lib/search-history'
import { memoryMonitor, needsMemoryCleanup, formatBytes } from '@/lib/memory-monitor'
import { searchResultCache, trackMetadataCache, albumArtCache } from '@/lib/cache-manager'
import { ErrorToast } from '@/components/error-toast'
import type { ErrorInfo } from '@/lib/error-handler'

/**
 * Format time in MM:SS format
 */
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds === Infinity) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins < 10 ? '0' + mins : mins}:${secs < 10 ? '0' + secs : secs}`
}

/**
 * Main music player page
 */
export default function MusicPlayerPage() {
  const [currentMode, setCurrentMode] = useState<SearchMode>('spotify')
  const [searchResults, setSearchResults] = useState<Track[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [queue, setQueue] = useState<Track[]>([])
  const [seekTo, setSeekTo] = useState<number | undefined>(undefined)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off')
  const [originalQueue, setOriginalQueue] = useState<Track[]>([])
  const [isShuffled, setIsShuffled] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [savedQueues, setSavedQueues] = useState<SavedQueue[]>([])
  const [showSavedQueues, setShowSavedQueues] = useState(false)
  const [crossfadeSettings, setCrossfadeSettings] = useState<CrossfadeSettings>({
    enabled: false,
    duration: 3,
  })
  const [normalizationSettings, setNormalizationSettings] = useState<NormalizationSettings>({
    enabled: false,
    targetLUFS: -14,
    preventClipping: true,
  })
  const [nextTrack, setNextTrack] = useState<Track | null>(null)
  const [isCrossfading, setIsCrossfading] = useState(false)
  const [isNormalizing, setIsNormalizing] = useState(false)
  const [playbackSettings, setPlaybackSettings] = useState<PlaybackSettings>(() => {
    // Load from localStorage or use defaults
    const saved = getItem<PlaybackSettings>('playbackSettings', {
      speed: 1.0,
      pitch: 0,
      equalizer: { bass: 0, mid: 0, treble: 0 },
      eqPreset: 'flat',
    })
    return saved || {
      speed: 1.0,
      pitch: 0,
      equalizer: { bass: 0, mid: 0, treble: 0 },
      eqPreset: 'flat',
    }
  })
  const [showAdvancedControls, setShowAdvancedControls] = useState(false)
  const [showLyrics, setShowLyrics] = useState(false)
  const [lyrics, setLyrics] = useState<ParsedLyrics | null>(null)
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false)
  const [miniPlayerMode, setMiniPlayerMode] = useState(false)
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(() => loadThemeSettings())
  const [showThemeSelector, setShowThemeSelector] = useState(false)
  const [searchFilters, setSearchFilters] = useState<SearchFiltersType>(() => {
    const saved = getItem<SearchFiltersType>('searchFilters')
    return saved || getDefaultFilters()
  })
  const [showFilters, setShowFilters] = useState(false)
  const [filteredResults, setFilteredResults] = useState<Track[]>([])
  const [errors, setErrors] = useState<ErrorInfo[]>([])
  const [retryStatus, setRetryStatus] = useState<string>('')
  const [autoSkipOnError, setAutoSkipOnError] = useState<boolean>(() => {
    const saved = getItem<boolean>('autoSkipOnError')
    return saved !== null ? saved : true
  })
  const searchControllerRef = useRef<AbortController | null>(null)
  const queueSectionRef = useRef<HTMLDivElement>(null)
  const audioBufferCleanupRef = useRef<NodeJS.Timeout | null>(null)
  const lastTrackChangeTimeRef = useRef<number>(Date.now())
  const platformFallbackAttemptedRef = useRef<Set<string>>(new Set()) // Track IDs that have had fallback attempted

  // Save playback settings to localStorage
  useEffect(() => {
    setItem('playbackSettings', playbackSettings)
  }, [playbackSettings])

  // Apply theme on mount and when settings change
  useEffect(() => {
    applyTheme(themeSettings)
    saveThemeSettings(themeSettings)
  }, [themeSettings])

  // Listen for system preference changes
  useEffect(() => {
    if (themeSettings.mode !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      // Re-apply theme when system preference changes
      applyTheme(themeSettings)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [themeSettings])

  // Handle theme settings change
  const handleThemeSettingsChange = (newSettings: ThemeSettings) => {
    setThemeSettings(newSettings)
  }

  // Handle search
  const handleSearch = useCallback(
    async (query: string, mode: SearchMode) => {
      // Abort previous search
      if (searchControllerRef.current) {
        searchControllerRef.current.abort()
      }

      setIsSearching(true)
      searchControllerRef.current = new AbortController()

      try {
        const results = await searchByMode(mode, query, {
          signal: searchControllerRef.current.signal,
          filters: searchFilters as SearchFiltersType,
        })
        setSearchResults(results)
        // Apply filters to new results
        const filtered = applyFilters(results, searchFilters)
        setFilteredResults(filtered)
        // Add to history with current filters
        addToHistory(query, mode, searchFilters as SearchFiltersType)
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Search error:', error)
        }
      } finally {
        setIsSearching(false)
      }
    },
    [searchFilters]
  )

  // Apply filters when filters or search results change
  useEffect(() => {
    if (searchResults.length > 0) {
      const filtered = applyFilters(searchResults, searchFilters)
      setFilteredResults(filtered)
    } else {
      setFilteredResults([])
    }
  }, [searchResults, searchFilters])

  // Save filters to localStorage when they change
  useEffect(() => {
    setItem('searchFilters', searchFilters)
  }, [searchFilters])

  // Initialize memory monitoring and cache cleanup
  useEffect(() => {
    // Set up memory cleanup callbacks
    memoryMonitor.onCleanupCallback(() => {
      // Clean expired cache entries
      searchResultCache.cleanExpired()
      trackMetadataCache.cleanExpired()

      // Clear old album art if memory is high
      if (needsMemoryCleanup()) {
        const artSize = albumArtCache.getSize()
        if (artSize > 30 * 1024 * 1024) {
          // Clear album art cache if over 30MB
          albumArtCache.clear()
        }
      }

      // Log cache statistics in dev mode
      if (process.env.NODE_ENV === 'development') {
        const searchStats = searchResultCache.getStats()
        const trackStats = trackMetadataCache.getStats()
        const memoryInfo = memoryMonitor.getInfo()
        console.log('[Cache Stats]', {
          search: {
            ...searchStats,
            hitRate: searchStats.hits + searchStats.misses > 0
              ? ((searchStats.hits / (searchStats.hits + searchStats.misses)) * 100).toFixed(2) + '%'
              : '0%',
          },
          track: trackStats,
          albumArt: {
            size: formatBytes(albumArtCache.getSize()),
            entries: albumArtCache.getStats().size,
          },
          memory: memoryInfo.available
            ? {
                used: formatBytes(memoryInfo.usedJSHeapSize),
                total: formatBytes(memoryInfo.totalJSHeapSize),
                limit: formatBytes(memoryInfo.jsHeapSizeLimit),
              }
            : 'Not available',
        })
      }
    })

    // Start memory monitoring
    memoryMonitor.start()

    // Clean expired cache entries periodically
    const cleanupInterval = setInterval(() => {
      searchResultCache.cleanExpired()
      trackMetadataCache.cleanExpired()

      // Clean audio buffers if inactive for 5 minutes
      const timeSinceLastTrackChange = Date.now() - lastTrackChangeTimeRef.current
      if (timeSinceLastTrackChange > 5 * 60 * 1000 && needsMemoryCleanup()) {
        // Clear old album art cache
        const artSize = albumArtCache.getSize()
        if (artSize > 30 * 1024 * 1024) {
          albumArtCache.clear()
        }
      }
    }, 5 * 60 * 1000) // Every 5 minutes

    // Cleanup on unmount
    return () => {
      memoryMonitor.stop()
      clearInterval(cleanupInterval)
      if (audioBufferCleanupRef.current) {
        clearTimeout(audioBufferCleanupRef.current)
      }
    }
  }, [])

  // Handle filter change
  const handleFiltersChange = useCallback((filters: SearchFiltersType) => {
    setSearchFilters(filters)
  }, [])

  // Handle mode change
  const handleModeChange = useCallback((mode: SearchMode) => {
    setCurrentMode(mode)
    setSearchResults([])
  }, [])

  // Handle error from player
  const handlePlayerError = useCallback(async (error: ErrorInfo) => {
    setErrors((prev) => [...prev, error])

    // If all retries failed and platform fallback hasn't been attempted, try alternative platforms
    if (
      error.retryCount !== undefined &&
      error.retryCount >= 3 &&
      error.track &&
      !platformFallbackAttemptedRef.current.has(error.track.id)
    ) {
      platformFallbackAttemptedRef.current.add(error.track.id)

      try {
        const alternativeTrack = await findTrackOnAlternativePlatforms(
          error.track,
          error.track.platform
        )

        if (alternativeTrack) {
          // Found alternative - switch to it
          setCurrentTrack(alternativeTrack)
          setIsPlaying(true)
          
          // Add success notification
          const fallbackError: ErrorInfo = {
            type: 'network',
            message: `Switched to ${alternativeTrack.platform === 'soundcloud' ? 'SoundCloud' : alternativeTrack.platform === 'youtube' ? 'YouTube' : 'Spotify'} version`,
            severity: 'info',
            timestamp: Date.now(),
            track: alternativeTrack,
          }
          setErrors((prev) => [...prev, fallbackError])
        } else if (autoSkipOnError) {
          // No alternative found - skip if auto-skip is enabled
          const skipError: ErrorInfo = {
            type: 'unknown',
            message: 'Skipped unplayable track',
            severity: 'info',
            timestamp: Date.now(),
            track: error.track,
          }
          setErrors((prev) => [...prev, skipError])
        }
      } catch (fallbackError) {
        console.error('Platform fallback error:', fallbackError)
      }
    } else if (
      error.retryCount === undefined &&
      error.track &&
      !platformFallbackAttemptedRef.current.has(error.track.id) &&
      (error.type === 'not_found' || error.type === 'forbidden')
    ) {
      // Non-retryable error - try platform fallback immediately
      platformFallbackAttemptedRef.current.add(error.track.id)

      try {
        const alternativeTrack = await findTrackOnAlternativePlatforms(
          error.track,
          error.track.platform
        )

        if (alternativeTrack) {
          setCurrentTrack(alternativeTrack)
          setIsPlaying(true)
          
          const fallbackError: ErrorInfo = {
            type: 'network',
            message: `Switched to ${alternativeTrack.platform === 'soundcloud' ? 'SoundCloud' : alternativeTrack.platform === 'youtube' ? 'YouTube' : 'Spotify'} version`,
            severity: 'info',
            timestamp: Date.now(),
            track: alternativeTrack,
          }
          setErrors((prev) => [...prev, fallbackError])
        }
      } catch (fallbackError) {
        console.error('Platform fallback error:', fallbackError)
      }
    }
  }, [autoSkipOnError])

  // Handle retry status updates
  const handleRetryStatus = useCallback((status: string) => {
    setRetryStatus(status)
  }, [])

  // Handle error dismissal
  const handleErrorDismiss = useCallback((id: string) => {
    // Extract timestamp from id and remove matching errors
    setErrors((prev) => {
      // The id format is: toast-{timestamp}-{random}
      // We'll match by timestamp part
      const timestampMatch = id.match(/toast-(\d+)-/)
      if (timestampMatch) {
        const timestamp = parseInt(timestampMatch[1])
        return prev.filter((e) => e.timestamp !== timestamp)
      }
      return prev
    })
  }, [])

  // Reset platform fallback tracking when track changes
  useEffect(() => {
    if (currentTrack) {
      platformFallbackAttemptedRef.current.delete(currentTrack.id)
    }
  }, [currentTrack?.id])

  // Save auto-skip setting
  useEffect(() => {
    setItem('autoSkipOnError', autoSkipOnError)
  }, [autoSkipOnError])

  // Handle play track
  const handlePlay = useCallback((track: Track) => {
    // Clear audio buffer cleanup timer
    if (audioBufferCleanupRef.current) {
      clearTimeout(audioBufferCleanupRef.current)
      audioBufferCleanupRef.current = null
    }

    // Update last track change time
    lastTrackChangeTimeRef.current = Date.now()

    // Cache track metadata
    trackMetadataCache.set(track.id, track)

    // Cache album art URL if available
    if (track.album?.images?.[0]?.url) {
      const imageUrl = track.album.images[0].url
      // Estimate image size (typically 50-200KB for album art)
      albumArtCache.set(`art:${track.id}`, imageUrl, 100 * 1024)
    }

    setCurrentTrack(track)
    setIsPlaying(true)

    // Schedule audio buffer cleanup after 5 minutes of inactivity
    audioBufferCleanupRef.current = setTimeout(() => {
      // Force cleanup of old audio buffers
      if (needsMemoryCleanup()) {
        // Clear old album art cache
        const artSize = albumArtCache.getSize()
        if (artSize > 30 * 1024 * 1024) {
          // Clear half of album art cache if over 30MB
          albumArtCache.clear()
        }
      }
    }, 5 * 60 * 1000) // 5 minutes
  }, [])

  // Handle add to queue
  const handleAddToQueue = useCallback((track: Track) => {
    setQueue((prev) => [...prev, track])
  }, [])

  // Handle play/pause toggle
  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev)
  }, [])

  // Get next track for preloading
  const getNextTrackForPreload = useCallback((): Track | null => {
    // Repeat one mode: return current track
    if (repeatMode === 'one' && currentTrack) {
      return currentTrack
    }

    if (queue.length > 0) {
      return queue[0]
    } else if (repeatMode === 'all') {
      // Repeat all mode: loop search results
      if (searchResults.length > 0) {
        const currentIndex = searchResults.findIndex((t) => t.id === currentTrack?.id)
        const nextIndex = (currentIndex + 1) % searchResults.length
        return searchResults[nextIndex]
      } else if (originalQueue.length > 0) {
        return originalQueue[0]
      }
    } else if (searchResults.length > 0) {
      const currentIndex = searchResults.findIndex((t) => t.id === currentTrack?.id)
      const nextIndex = currentIndex < searchResults.length - 1 ? currentIndex + 1 : 0
      return searchResults[nextIndex]
    }

    return null
  }, [queue, searchResults, currentTrack, repeatMode, originalQueue])

  // Update next track when queue or current track changes
  useEffect(() => {
    const next = getNextTrackForPreload()
    setNextTrack(next)
  }, [getNextTrackForPreload])

  // Handle mini player toggle
  const handleToggleMiniPlayer = useCallback(() => {
    setMiniPlayerMode((prev) => !prev)
  }, [])

  // Handle expand from mini player
  const handleExpandFromMini = useCallback(() => {
    setMiniPlayerMode(false)
  }, [])

  // Handle seek from mini player
  const handleMiniPlayerSeek = useCallback((time: number) => {
    setSeekTo(time)
  }, [])

  // Keyboard shortcut handler (Ctrl/Cmd + M)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault()
        handleToggleMiniPlayer()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleToggleMiniPlayer])

  // Handle next track with repeat mode support
  const handleNext = useCallback(() => {
    // Repeat one mode: replay current track
    if (repeatMode === 'one' && currentTrack) {
      setCurrentTime(0)
      setSeekTo(0)
      setIsPlaying(true)
      setIsCrossfading(false)
      return
    }

    if (queue.length > 0) {
      const nextTrack = queue[0]

      // Clear audio buffer cleanup timer
      if (audioBufferCleanupRef.current) {
        clearTimeout(audioBufferCleanupRef.current)
        audioBufferCleanupRef.current = null
      }

      // Update last track change time
      lastTrackChangeTimeRef.current = Date.now()

      // Cache track metadata
      trackMetadataCache.set(nextTrack.id, nextTrack)

      setQueue((prev) => {
        const newQueue = prev.slice(1)
        // If repeat all and queue becomes empty, restore from original or recreate loop
        if (repeatMode === 'all' && newQueue.length === 0 && originalQueue.length > 0) {
          // Restore original queue for looping
          return [...originalQueue]
        }
        return newQueue
      })
      setCurrentTrack(nextTrack)
      setIsPlaying(true)
      setIsCrossfading(false)
    } else if (repeatMode === 'all') {
      // Repeat all mode: loop filtered results
      if (filteredResults.length > 0) {
        const currentIndex = filteredResults.findIndex((t) => t.id === currentTrack?.id)
        const nextIndex = (currentIndex + 1) % filteredResults.length
        const nextTrack = filteredResults[nextIndex]

        // Clear audio buffer cleanup timer
        if (audioBufferCleanupRef.current) {
          clearTimeout(audioBufferCleanupRef.current)
          audioBufferCleanupRef.current = null
        }

        // Update last track change time
        lastTrackChangeTimeRef.current = Date.now()

        // Cache track metadata
        trackMetadataCache.set(nextTrack.id, nextTrack)

        setCurrentTrack(nextTrack)
        setIsPlaying(true)
        setIsCrossfading(false)
      } else if (originalQueue.length > 0) {
        // Loop original queue if available
        const nextTrack = originalQueue[0]

        // Clear audio buffer cleanup timer
        if (audioBufferCleanupRef.current) {
          clearTimeout(audioBufferCleanupRef.current)
          audioBufferCleanupRef.current = null
        }

        // Update last track change time
        lastTrackChangeTimeRef.current = Date.now()

        // Cache track metadata
        trackMetadataCache.set(nextTrack.id, nextTrack)

        setQueue([...originalQueue.slice(1)])
        setCurrentTrack(nextTrack)
        setIsPlaying(true)
        setIsCrossfading(false)
      }
    } else if (filteredResults.length > 0) {
      const currentIndex = filteredResults.findIndex((t) => t.id === currentTrack?.id)
      const nextIndex = currentIndex < filteredResults.length - 1 ? currentIndex + 1 : 0
      const nextTrack = filteredResults[nextIndex]

      // Clear audio buffer cleanup timer
      if (audioBufferCleanupRef.current) {
        clearTimeout(audioBufferCleanupRef.current)
        audioBufferCleanupRef.current = null
      }

      // Update last track change time
      lastTrackChangeTimeRef.current = Date.now()

      // Cache track metadata
      trackMetadataCache.set(nextTrack.id, nextTrack)

      setCurrentTrack(nextTrack)
      setIsPlaying(true)
      setIsCrossfading(false)
    }
  }, [queue, filteredResults, currentTrack, repeatMode, originalQueue])

  // Handle previous track
  const handlePrevious = useCallback(() => {
    if (filteredResults.length > 0) {
      const currentIndex = filteredResults.findIndex((t) => t.id === currentTrack?.id)
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredResults.length - 1
      const prevTrack = filteredResults[prevIndex]

      // Clear audio buffer cleanup timer
      if (audioBufferCleanupRef.current) {
        clearTimeout(audioBufferCleanupRef.current)
        audioBufferCleanupRef.current = null
      }

      // Update last track change time
      lastTrackChangeTimeRef.current = Date.now()

      // Cache track metadata
      trackMetadataCache.set(prevTrack.id, prevTrack)

      setCurrentTrack(prevTrack)
      setIsPlaying(true)
    }
  }, [filteredResults, currentTrack])

  // Handle progress bar click
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!duration) return

      const progressBar = e.currentTarget
      const clickX = e.clientX - progressBar.getBoundingClientRect().left
      const width = progressBar.clientWidth
      const percentage = clickX / width
      const newTime = percentage * duration

      setCurrentTime(newTime)
      setSeekTo(newTime)
    },
    [duration]
  )

  // Handle lyrics toggle
  const handleToggleLyrics = useCallback(async () => {
    if (showLyrics) {
      setShowLyrics(false)
      return
    }

    if (!currentTrack) return

    setShowLyrics(true)
    setIsLoadingLyrics(true)

    try {
      const fetchedLyrics = await fetchLyrics(
        currentTrack.name,
        currentTrack.artists[0]?.name || 'Unknown'
      )
      setLyrics(fetchedLyrics)
    } catch (error) {
      console.error('Failed to fetch lyrics:', error)
      setLyrics(null)
    } finally {
      setIsLoadingLyrics(false)
    }
  }, [showLyrics, currentTrack])

  // Handle lyrics seek
  const handleLyricsSeek = useCallback((time: number) => {
    setCurrentTime(time)
    setSeekTo(time)
  }, [])

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
  }, [])

  // Handle shuffle toggle
  const handleShuffle = useCallback(() => {
    if (isShuffled) {
      // Unshuffle: restore original order
      if (originalQueue.length > 0) {
        setQueue(originalQueue)
        setOriginalQueue([])
        setIsShuffled(false)
      }
    } else {
      // Shuffle: save original and shuffle
      if (queue.length > 0) {
        setOriginalQueue([...queue])
        const shuffled = shuffleQueue(queue)
        setQueue(shuffled)
        setIsShuffled(true)
      }
    }
  }, [queue, isShuffled, originalQueue])

  // Handle repeat mode toggle
  const handleRepeatToggle = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all'
      if (prev === 'all') return 'one'
      return 'off'
    })
  }, [])

  // Handle clear queue
  const handleClearQueue = useCallback(() => {
    if (queue.length === 0) return
    
    if (window.confirm('Are you sure you want to clear the queue?')) {
      setQueue([])
      setOriginalQueue([])
      setIsShuffled(false)
    }
  }, [queue.length])

  // Drag and drop handlers
  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
      e.preventDefault()
      
      if (draggedIndex === null || draggedIndex === dropIndex) {
        setDraggedIndex(null)
        return
      }

      setQueue((prev) => {
        const newQueue = [...prev]
        const [draggedItem] = newQueue.splice(draggedIndex, 1)
        newQueue.splice(dropIndex, 0, draggedItem)
        return newQueue
      })

      // Update original queue if shuffled
      if (isShuffled && originalQueue.length > 0) {
        setOriginalQueue((prev) => {
          const newOriginal = [...prev]
          const [draggedItem] = newOriginal.splice(draggedIndex, 1)
          newOriginal.splice(dropIndex, 0, draggedItem)
          return newOriginal
        })
      }

      setDraggedIndex(null)
    },
    [draggedIndex, isShuffled, originalQueue.length]
  )

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null)
  }, [])

  // Load saved queues on mount
  useEffect(() => {
    setSavedQueues(getSavedQueues())

    // Check for auto-saved queue and prompt to restore
    const autosave = getAutoSavedQueue()
    if (autosave && autosave.tracks.length > 0) {
      const shouldRestore = window.confirm(
        `Restore previous queue with ${autosave.tracks.length} track${autosave.tracks.length > 1 ? 's' : ''}?`
      )
      if (shouldRestore) {
        setQueue(autosave.tracks)
        setRepeatMode(autosave.repeatMode)
        clearAutoSave()
      } else {
        clearAutoSave()
      }
    }
  }, [])

  // Auto-save queue on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (queue.length > 0) {
        autoSaveQueue(queue, repeatMode)
      } else {
        clearAutoSave()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [queue, repeatMode])

  // Close saved queues dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (queueSectionRef.current && !queueSectionRef.current.contains(event.target as Node)) {
        setShowSavedQueues(false)
      }
    }

    if (showSavedQueues) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSavedQueues])

  // Handle save queue
  const handleSaveQueue = useCallback(() => {
    if (queue.length === 0) {
      alert('Queue is empty. Add tracks to save.')
      return
    }

    const name = window.prompt('Enter a name for this queue:')
    if (!name || !name.trim()) return

    const saved = saveQueue(name.trim(), queue, repeatMode)
    if (saved) {
      setSavedQueues(getSavedQueues())
      alert(`Queue "${name.trim()}" saved successfully!`)
    } else {
      alert('Failed to save queue.')
    }
  }, [queue, repeatMode])

  // Handle load queue
  const handleLoadQueue = useCallback(
    (savedQueue: SavedQueue) => {
      // Check if current queue has unsaved changes
      if (queue.length > 0) {
        const shouldProceed = window.confirm(
          'Loading a saved queue will replace your current queue. Continue?'
        )
        if (!shouldProceed) return
      }

      setQueue(savedQueue.tracks)
      setRepeatMode(savedQueue.repeatMode)
      setOriginalQueue([])
      setIsShuffled(false)
      setShowSavedQueues(false)

      // Clear autosave when loading a saved queue
      clearAutoSave()
    },
    [queue.length]
  )

  // Handle delete queue
  const handleDeleteQueue = useCallback(
    (e: React.MouseEvent, id: string, name: string) => {
      e.stopPropagation()
      if (window.confirm(`Delete queue "${name}"?`)) {
        if (deleteQueue(id)) {
          setSavedQueues(getSavedQueues())
        }
      }
    },
    []
  )

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        handleTogglePlay()
      } else if (e.code === 'ArrowRight') {
        handleNext()
      } else if (e.code === 'ArrowLeft') {
        handlePrevious()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleTogglePlay, handleNext, handlePrevious])

  const coverImage = currentTrack?.album?.images?.[0]?.url || '/images/default.jpg'
  const trackName = currentTrack?.name || 'Choose a Track'
  const artistName = currentTrack?.artists?.[0]?.name || 'Search to get started'

  return (
    <>
      <div className="bg-atmosphere"></div>
      <div className="grain"></div>

      <header className="header">
        <div className="header-content">
          <div className="logo">AURALIS</div>
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={() => setShowThemeSelector(true)}
            aria-label="Open theme settings"
            title="Theme Settings"
          >
            <i className="fas fa-palette"></i>
          </button>
          <div className="search-wrapper-container">
            <SearchBar
              onSearch={handleSearch}
              onModeChange={handleModeChange}
              currentMode={currentMode}
              isLoading={isSearching}
              onFiltersRestore={(filters) => {
                if (filters) {
                  setSearchFilters(filters)
                }
              }}
              currentFilters={searchFilters}
            />
            <SearchFilters
              filters={searchFilters}
              onFiltersChange={handleFiltersChange}
              isOpen={showFilters}
              onToggle={() => setShowFilters(!showFilters)}
            />
            <SearchResults
              results={filteredResults}
              onPlay={handlePlay}
              onAddToQueue={handleAddToQueue}
              isLoading={isSearching}
              currentTrackId={currentTrack?.id}
            />
          </div>
        </div>
      </header>

      <main className={`main-container ${miniPlayerMode ? 'mini-mode' : ''}`}>
        {!miniPlayerMode && (
          <div className="player-card">
          <div className="album-art-wrapper">
            <img src={coverImage} alt="Album Art" id="cover" className={`album-art ${isPlaying ? 'active' : ''}`} />
          </div>

          <div className="track-info">
            <h1 className="track-title">{trackName}</h1>
            <p className="track-artist">
              {artistName}
              {currentTrack && (
                <span className={`platform-indicator ${currentTrack.platform}`}>
                  {currentTrack.platform === 'soundcloud' ? 'SoundCloud' : currentTrack.platform === 'youtube' ? 'YouTube' : 'Spotify'}
                </span>
              )}
            </p>
            {retryStatus && (
              <div className="retry-status-indicator">
                <i className="fas fa-sync-alt fa-spin"></i>
                <span>{retryStatus}</span>
              </div>
            )}
          </div>

          <div className="progress-section">
            <div className="progress-bar" onClick={handleProgressClick}>
              <div
                className="progress-fill"
                style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
              ></div>
            </div>
            <div className="time-display">
              <span className="current-time">{formatTime(currentTime)}</span>
              <span className="total-time">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="controls">
            <button type="button" className="control-btn prev-btn" onClick={handlePrevious} aria-label="Previous track">
              <i className="fas fa-backward"></i>
            </button>
            <button type="button" className="control-btn play-btn" onClick={handleTogglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
              <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
            </button>
            <button type="button" className="control-btn next-btn" onClick={handleNext} aria-label="Next track">
              <i className="fas fa-forward"></i>
            </button>
            <button
              type="button"
              className={`control-btn lyrics-btn ${showLyrics ? 'active' : ''}`}
              onClick={handleToggleLyrics}
              aria-label={showLyrics ? 'Hide lyrics' : 'Show lyrics'}
              title={showLyrics ? 'Hide lyrics' : 'Show lyrics'}
            >
              <i className="fas fa-microphone"></i>
            </button>
            <button
              type="button"
              className={`control-btn mini-player-toggle-btn ${miniPlayerMode ? 'active' : ''}`}
              onClick={handleToggleMiniPlayer}
              aria-label={miniPlayerMode ? 'Show full player' : 'Show mini player'}
              title={miniPlayerMode ? 'Show full player' : 'Show mini player (Ctrl+M)'}
            >
              <i className="fas fa-window-minimize"></i>
            </button>
          </div>

          <div className="volume-section">
            <i className={`fas ${volume === 0 ? 'fa-volume-mute' : volume < 0.5 ? 'fa-volume-down' : 'fa-volume-up'} volume-icon`}></i>
            <input
              type="range"
              id="volume-slider"
              className="volume-slider"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              aria-label="Volume"
            />
          </div>

          <div className="crossfade-section">
            <div className="crossfade-header">
              <button
                type="button"
                className={`crossfade-toggle ${crossfadeSettings.enabled ? 'active' : ''}`}
                onClick={() =>
                  setCrossfadeSettings((prev) => ({
                    ...prev,
                    enabled: !prev.enabled,
                  }))
                }
                aria-label={crossfadeSettings.enabled ? 'Disable crossfade' : 'Enable crossfade'}
                title={crossfadeSettings.enabled ? 'Disable crossfade' : 'Enable crossfade'}
              >
                <i className="fas fa-exchange-alt"></i>
                {isCrossfading && <span className="crossfade-indicator"></span>}
              </button>
              <label htmlFor="crossfade-duration" className="crossfade-label">
                Crossfade: {crossfadeSettings.duration}s
              </label>
            </div>
            <input
              type="range"
              id="crossfade-duration"
              className="crossfade-slider"
              min="0"
              max="12"
              step="0.5"
              value={crossfadeSettings.duration}
              onChange={(e) =>
                setCrossfadeSettings((prev) => ({
                  ...prev,
                  duration: parseFloat(e.target.value),
                }))
              }
              disabled={!crossfadeSettings.enabled}
              aria-label="Crossfade duration"
            />
          </div>

          <div className="normalization-section">
            <div className="normalization-header">
              <button
                type="button"
                className={`normalization-toggle ${normalizationSettings.enabled ? 'active' : ''}`}
                onClick={() =>
                  setNormalizationSettings((prev) => ({
                    ...prev,
                    enabled: !prev.enabled,
                  }))
                }
                aria-label={normalizationSettings.enabled ? 'Disable normalization' : 'Enable normalization'}
                title={normalizationSettings.enabled ? 'Disable normalization' : 'Enable normalization'}
              >
                <i className="fas fa-volume-up"></i>
                {isNormalizing && <span className="normalization-indicator"></span>}
              </button>
              <label htmlFor="normalization-toggle" className="normalization-label">
                Volume Normalization
              </label>
            </div>
            <div className="normalization-options">
              <label className="normalization-checkbox-label">
                <input
                  type="checkbox"
                  checked={normalizationSettings.preventClipping}
                  onChange={(e) =>
                    setNormalizationSettings((prev) => ({
                      ...prev,
                      preventClipping: e.target.checked,
                    }))
                  }
                  disabled={!normalizationSettings.enabled}
                />
                <span>Prevent Clipping</span>
              </label>
            </div>
          </div>

          <div className="advanced-controls-section">
            <button
              type="button"
              className="advanced-controls-toggle"
              onClick={() => setShowAdvancedControls(!showAdvancedControls)}
              aria-label={showAdvancedControls ? 'Hide advanced controls' : 'Show advanced controls'}
            >
              <i className={`fas ${showAdvancedControls ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
              <span>Advanced Controls</span>
            </button>

            {showAdvancedControls && (
              <div className="advanced-controls-content">
                {/* Playback Speed */}
                <div className="control-group">
                  <div className="control-header">
                    <label htmlFor="playback-speed" className="control-label">
                      Playback Speed: {playbackSettings.speed.toFixed(2)}x
                    </label>
                    <button
                      type="button"
                      className="control-reset-btn"
                      onClick={() =>
                        setPlaybackSettings((prev) => ({ ...prev, speed: 1.0 }))
                      }
                      aria-label="Reset playback speed"
                    >
                      Reset
                    </button>
                  </div>
                  <input
                    type="range"
                    id="playback-speed"
                    className="control-slider"
                    min="0.5"
                    max="2.0"
                    step="0.25"
                    value={playbackSettings.speed}
                    onChange={(e) =>
                      setPlaybackSettings((prev) => ({
                        ...prev,
                        speed: parseFloat(e.target.value),
                      }))
                    }
                    aria-label="Playback speed"
                  />
                </div>

                {/* Pitch Adjustment */}
                <div className="control-group">
                  <div className="control-header">
                    <label htmlFor="pitch-adjustment" className="control-label">
                      Pitch: {playbackSettings.pitch > 0 ? '+' : ''}
                      {playbackSettings.pitch.toFixed(0)} semitones
                    </label>
                    <button
                      type="button"
                      className="control-reset-btn"
                      onClick={() =>
                        setPlaybackSettings((prev) => ({ ...prev, pitch: 0 }))
                      }
                      aria-label="Reset pitch"
                    >
                      Reset
                    </button>
                  </div>
                  <input
                    type="range"
                    id="pitch-adjustment"
                    className="control-slider"
                    min="-12"
                    max="12"
                    step="1"
                    value={playbackSettings.pitch}
                    onChange={(e) =>
                      setPlaybackSettings((prev) => ({
                        ...prev,
                        pitch: parseInt(e.target.value),
                      }))
                    }
                    aria-label="Pitch adjustment"
                  />
                </div>

                {/* Equalizer */}
                <div className="control-group">
                  <div className="control-header">
                    <label htmlFor="eq-preset" className="control-label">
                      Equalizer Preset
                    </label>
                    <button
                      type="button"
                      className="control-reset-btn"
                      onClick={() =>
                        setPlaybackSettings((prev) => ({
                          ...prev,
                          equalizer: { bass: 0, mid: 0, treble: 0 },
                          eqPreset: 'flat',
                        }))
                      }
                      aria-label="Reset equalizer"
                    >
                      Reset
                    </button>
                  </div>
                  <select
                    id="eq-preset"
                    className="control-select"
                    value={playbackSettings.eqPreset}
                    onChange={(e) => {
                      const preset = e.target.value as EQPreset
                      setPlaybackSettings((prev) => ({
                        ...prev,
                        equalizer: EQ_PRESETS[preset],
                        eqPreset: preset,
                      }))
                    }}
                    aria-label="Equalizer preset"
                  >
                    <option value="flat">Flat</option>
                    <option value="bass-boost">Bass Boost</option>
                    <option value="treble-boost">Treble Boost</option>
                    <option value="vocal">Vocal</option>
                    <option value="rock">Rock</option>
                  </select>
                </div>

                {/* Bass */}
                <div className="control-group">
                  <div className="control-header">
                    <label htmlFor="eq-bass" className="control-label">
                      Bass: {playbackSettings.equalizer.bass > 0 ? '+' : ''}
                      {playbackSettings.equalizer.bass.toFixed(0)} dB
                    </label>
                  </div>
                  <input
                    type="range"
                    id="eq-bass"
                    className="control-slider"
                    min="-12"
                    max="12"
                    step="1"
                    value={playbackSettings.equalizer.bass}
                    onChange={(e) =>
                      setPlaybackSettings((prev) => ({
                        ...prev,
                        equalizer: {
                          ...prev.equalizer,
                          bass: parseInt(e.target.value),
                        },
                        eqPreset: 'flat', // Reset preset when manually adjusting
                      }))
                    }
                    aria-label="Bass equalizer"
                  />
                </div>

                {/* Mid */}
                <div className="control-group">
                  <div className="control-header">
                    <label htmlFor="eq-mid" className="control-label">
                      Mid: {playbackSettings.equalizer.mid > 0 ? '+' : ''}
                      {playbackSettings.equalizer.mid.toFixed(0)} dB
                    </label>
                  </div>
                  <input
                    type="range"
                    id="eq-mid"
                    className="control-slider"
                    min="-12"
                    max="12"
                    step="1"
                    value={playbackSettings.equalizer.mid}
                    onChange={(e) =>
                      setPlaybackSettings((prev) => ({
                        ...prev,
                        equalizer: {
                          ...prev.equalizer,
                          mid: parseInt(e.target.value),
                        },
                        eqPreset: 'flat', // Reset preset when manually adjusting
                      }))
                    }
                    aria-label="Mid equalizer"
                  />
                </div>

                {/* Treble */}
                <div className="control-group">
                  <div className="control-header">
                    <label htmlFor="eq-treble" className="control-label">
                      Treble: {playbackSettings.equalizer.treble > 0 ? '+' : ''}
                      {playbackSettings.equalizer.treble.toFixed(0)} dB
                    </label>
                  </div>
                  <input
                    type="range"
                    id="eq-treble"
                    className="control-slider"
                    min="-12"
                    max="12"
                    step="1"
                    value={playbackSettings.equalizer.treble}
                    onChange={(e) =>
                      setPlaybackSettings((prev) => ({
                        ...prev,
                        equalizer: {
                          ...prev.equalizer,
                          treble: parseInt(e.target.value),
                        },
                        eqPreset: 'flat', // Reset preset when manually adjusting
                      }))
                    }
                    aria-label="Treble equalizer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {!miniPlayerMode && (
          <div className="queue-section" ref={queueSectionRef}>
          <div className="queue-header-container">
            <h2 className="queue-header">Up Next</h2>
            <div className="queue-controls">
              <button
                type="button"
                className="queue-control-btn save-btn"
                onClick={handleSaveQueue}
                aria-label="Save queue"
                title="Save queue"
                disabled={queue.length === 0}
              >
                <i className="fas fa-save"></i>
              </button>
              <div className="saved-queues-dropdown">
                <button
                  type="button"
                  className="queue-control-btn load-btn"
                  onClick={() => setShowSavedQueues(!showSavedQueues)}
                  aria-label="Load saved queue"
                  title="Load saved queue"
                  disabled={savedQueues.length === 0}
                >
                  <i className="fas fa-folder-open"></i>
                </button>
                {showSavedQueues && savedQueues.length > 0 && (
                  <div className="saved-queues-list">
                    {savedQueues.map((savedQueue) => (
                      <div
                        key={savedQueue.id}
                        className="saved-queue-item"
                        onClick={() => handleLoadQueue(savedQueue)}
                      >
                        <div className="saved-queue-info">
                          <div className="saved-queue-name">{savedQueue.name}</div>
                          <div className="saved-queue-meta">
                            {savedQueue.tracks.length} track{savedQueue.tracks.length !== 1 ? 's' : ''} •{' '}
                            {savedQueue.repeatMode !== 'off' ? `Repeat: ${savedQueue.repeatMode}` : 'No repeat'}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="saved-queue-delete"
                          onClick={(e) => handleDeleteQueue(e, savedQueue.id, savedQueue.name)}
                          aria-label={`Delete ${savedQueue.name}`}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                className={`queue-control-btn ${isShuffled ? 'active' : ''}`}
                onClick={handleShuffle}
                aria-label={isShuffled ? 'Unshuffle queue' : 'Shuffle queue'}
                title={isShuffled ? 'Unshuffle queue' : 'Shuffle queue'}
                disabled={queue.length === 0}
              >
                <i className="fas fa-random"></i>
              </button>
              <button
                type="button"
                className={`queue-control-btn ${repeatMode !== 'off' ? 'active' : ''}`}
                onClick={handleRepeatToggle}
                aria-label={`Repeat mode: ${repeatMode}`}
                title={`Repeat: ${repeatMode === 'off' ? 'Off' : repeatMode === 'all' ? 'All' : 'One'}`}
              >
                <i className="fas fa-redo"></i>
                {repeatMode === 'one' && <span className="repeat-indicator">1</span>}
              </button>
              <button
                type="button"
                className="queue-control-btn clear-btn"
                onClick={handleClearQueue}
                aria-label="Clear queue"
                title="Clear queue"
                disabled={queue.length === 0}
              >
                <i className="fas fa-trash"></i>
              </button>
            </div>
          </div>
          <div className="queue-list">
            {queue.length === 0 ? (
              <div className="empty-queue">Queue is empty</div>
            ) : (
              queue.map((track, index) => {
                const imageUrl = track.album?.images?.[0]?.url || '/images/default.jpg'
                const artistName = track.artists?.[0]?.name || 'Unknown Artist'
                const isDragging = draggedIndex === index

                return (
                  <div
                    key={`${track.id}-${index}`}
                    className={`queue-item ${isDragging ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="queue-item-drag-handle">
                      <i className="fas fa-grip-vertical"></i>
                    </div>
                    <img src={imageUrl} alt={track.name} />
                    <div className="queue-item-info">
                      <div className="queue-item-title">{track.name}</div>
                      <div className="queue-item-artist">{artistName}</div>
                    </div>
                    <button
                      type="button"
                      className="remove-queue-item"
                      onClick={() => {
                        setQueue((prev) => {
                          const removed = prev[index]
                          const newQueue = prev.filter((_, i) => i !== index)
                          // Also remove from original queue if shuffled, matching by track id
                          if (isShuffled && removed) {
                            setOriginalQueue((prevOriginal) => prevOriginal.filter((item) => item.id !== removed.id))
                          }
                          return newQueue
                        })
                      }}
                      aria-label={`Remove ${track.name} from queue`}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
        )}
      </main>

      <Player
        track={currentTrack}
        nextTrack={nextTrack}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onTimeUpdate={setCurrentTime}
        onDurationChange={setDuration}
        volume={volume}
        onVolumeChange={setVolume}
        seekTo={seekTo}
        crossfadeSettings={crossfadeSettings}
        onCrossfadeStateChange={setIsCrossfading}
        normalizationSettings={normalizationSettings}
        onNormalizationStateChange={setIsNormalizing}
        playbackSettings={playbackSettings}
        onError={handlePlayerError}
        onRetryStatus={handleRetryStatus}
        autoSkipOnError={autoSkipOnError}
      />

      <ErrorToast errors={errors} onDismiss={handleErrorDismiss} />

      <LyricsPanel
        isOpen={showLyrics}
        onClose={() => setShowLyrics(false)}
        lyrics={lyrics}
        currentTime={currentTime}
        onSeek={handleLyricsSeek}
        isLoading={isLoadingLyrics}
        trackName={currentTrack?.name}
        artistName={currentTrack?.artists[0]?.name}
        geniusUrl={
          currentTrack
            ? getGeniusSearchUrl(currentTrack.name, currentTrack.artists[0]?.name || 'Unknown')
            : undefined
        }
      />

      {miniPlayerMode && (
        <MiniPlayer
          track={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onTogglePlay={handleTogglePlay}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onExpand={handleExpandFromMini}
          onSeek={handleMiniPlayerSeek}
        />
      )}

      <ThemeSelector
        settings={themeSettings}
        onSettingsChange={handleThemeSettingsChange}
        isOpen={showThemeSelector}
        onClose={() => setShowThemeSelector(false)}
      />
    </>
  )
}
