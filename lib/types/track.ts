export type AudioPlatform = 'spotify' | 'soundcloud' | 'youtube' | 'local'
export type AudioQuality = 'flac' | 'mp3-320' | 'mp3-192' | 'ogg' | 'preview'

export interface TrackArtwork {
  url: string
  width?: number
  height?: number
}

export interface TrackMetadata {
  /** Stable app-internal ID: `${platform}:${platformId}` */
  id: string
  title: string
  artist: string
  albumArtist?: string
  album?: string
  year?: number
  trackNumber?: number
  discNumber?: number
  genre?: string[]
  durationSeconds: number
  bpm?: number
  artwork: TrackArtwork | null

  /** ISRC enables cross-platform matching */
  isrc?: string

  source: TrackSource
  fetchedAt: number
}

export interface TrackSource {
  platform: AudioPlatform
  platformId: string

  /** NOT persisted. Stream URLs expire. Always resolve fresh at playback time. */
  streamUrl?: string
  previewUrl?: string
  quality?: AudioQuality
}

export type AudioSource =
  | { mode: 'stream'; url: string }
  | { mode: 'local-blob'; buffer: ArrayBuffer; mimeType: string }
