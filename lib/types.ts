/**
 * Track data structure normalized across all platforms
 */
export interface Track {
  id: string
  name: string
  artists: Array<{ name: string }>
  album: {
    images: Array<{ url: string }>
  }
  duration_ms?: number
  preview_url?: string
  stream_url?: string
  platform: 'spotify' | 'soundcloud' | 'youtube'
  uri?: string
  videoId?: string
  permalink_url?: string
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
