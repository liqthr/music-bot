import type { EqualizerSettings } from './audio-processor'

/**
 * Track data structure normalized across all platforms
 */
export interface Track {
  id: string
  name: string
  artists: Array<{ name: string }>
  album: {
    images: Array<{ url: string }>
    name?: string
    release_date?: string // ISO date string (YYYY-MM-DD or YYYY)
  }
  duration_ms?: number
  preview_url?: string
  stream_url?: string
  platform: 'spotify' | 'soundcloud' | 'youtube'
  uri?: string
  videoId?: string
  permalink_url?: string
  quality?: 'hq' | 'standard' | 'preview' | 'low'
  bitrate?: number
  replayGain?: ReplayGainMetadata // ReplayGain metadata if available
  genre?: string // Genre metadata if available
}

/**
 * Search mode
 */
export type SearchMode = 'spotify' | 'soundcloud' | 'youtube'

/**
 * Player state
 */
export interface PlayerState {
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  queue: Track[]
}

/**
 * Duration filter preset
 */
export type DurationPreset = 'short' | 'medium' | 'long' | 'custom'

/**
 * Year range for filtering
 */
export interface YearRange {
  from?: number
  to?: number
}

/**
 * Duration range for filtering (in seconds)
 */
export interface DurationRange {
  min?: number // in seconds
  max?: number // in seconds
}

/**
 * Search filters for advanced search
 */
export interface SearchFilters {
  genres?: string[] // Array of selected genres
  yearRange?: YearRange // Year range filter
  duration?: {
    preset?: DurationPreset // Preset duration filter
    custom?: DurationRange // Custom duration range
  }
  platforms?: ('spotify' | 'soundcloud' | 'youtube')[] // Selected platforms
}

/**
 * Search history item
 */
export interface SearchHistoryItem {
  query: string
  mode: SearchMode
  filters?: SearchFilters
  timestamp: number
}

/**
 * Saved search with custom name
 */
export interface SavedSearch {
  id: string
  name: string
  query: string
  mode: SearchMode
  filters?: SearchFilters
  createdAt: number
}

/**
 * Repeat mode for queue playback
 */
export type RepeatMode = 'off' | 'all' | 'one'

/**
 * Saved queue with metadata
 */
export interface SavedQueue {
  id: string
  name: string
  tracks: Track[]
  repeatMode: RepeatMode
  createdAt: number
  updatedAt: number
}

/**
 * Crossfade settings
 */
export interface CrossfadeSettings {
  enabled: boolean
  duration: number // Duration in seconds (0-12)
}

/**
 * Volume normalization settings
 */
export interface NormalizationSettings {
  enabled: boolean
  targetLUFS: number // Target loudness in LUFS (default -14)
  preventClipping: boolean // Limit maximum gain to prevent clipping
}

/**
 * ReplayGain metadata (if available in track)
 */
export interface ReplayGainMetadata {
  trackGain?: number // dB gain for track
  albumGain?: number // dB gain for album
  trackPeak?: number // Peak level for track (0.0 to 1.0)
  albumPeak?: number // Peak level for album (0.0 to 1.0)
}

/**
 * Playback settings for speed, pitch, and equalizer
 */
export interface PlaybackSettings {
  speed: number // Playback speed (0.5 to 2.0)
  pitch: number // Pitch adjustment in semitones (-12 to +12)
  equalizer: EqualizerSettings // 3-band EQ settings
  eqPreset: string // Current EQ preset name
}

/**
 * EQ preset definitions
 */
export type EQPreset = 'flat' | 'bass-boost' | 'treble-boost' | 'vocal' | 'rock'

/**
 * EQ preset configurations
 */
export const EQ_PRESETS: Record<EQPreset, EqualizerSettings> = {
  flat: { bass: 0, mid: 0, treble: 0 },
  'bass-boost': { bass: 6, mid: 0, treble: 0 },
  'treble-boost': { bass: 0, mid: 0, treble: 6 },
  vocal: { bass: 0, mid: 3, treble: 0 },
  rock: { bass: 3, mid: 0, treble: 3 },
}

/**
 * Theme mode
 */
export type ThemeMode = 'light' | 'dark' | 'system'

/**
 * Color scheme
 */
export type ColorScheme = 'default' | 'ocean' | 'sunset' | 'forest' | 'monochrome'

/**
 * Theme settings
 */
export interface ThemeSettings {
  mode: ThemeMode // 'light', 'dark', or 'system'
  colorScheme: ColorScheme // Color scheme name
  customBackground: string | null // Base64 encoded background image
  fontSize: number // Font size multiplier (0.8 to 1.2)
}

/**
 * Color scheme definitions
 */
export interface ColorSchemeDefinition {
  name: string
  primary: string
  secondary: string
  accent: string
  bg: string
  bgSecondary: string
  text: string
  textDim: string
}
