import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TrackMetadata } from '@/lib/types/track'

interface PlayerState {
  currentTrack: TrackMetadata | null
  isPlaying: boolean
  volume: number
  currentTime: number
  duration: number
  playbackMode: 'stream' | 'local-blob'

  setTrack: (track: TrackMetadata) => void
  setPlaying: (v: boolean) => void
  setVolume: (v: number) => void
  setCurrentTime: (t: number) => void
  setDuration: (d: number) => void
  setPlaybackMode: (mode: 'stream' | 'local-blob') => void
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      currentTrack: null,
      isPlaying: false,
      volume: 1,
      currentTime: 0,
      duration: 0,
      playbackMode: 'stream',
      setTrack: (track) => set({ currentTrack: track, currentTime: 0, isPlaying: false }),
      setPlaying: (isPlaying) => set({ isPlaying }),
      setVolume: (volume) => set({ volume }),
      setCurrentTime: (currentTime) => set({ currentTime }),
      setDuration: (duration) => set({ duration }),
      setPlaybackMode: (playbackMode) => set({ playbackMode }),
    }),
    {
      name: 'auralis-player',
      // Only persist user preferences — not transient playback state
      partialize: (s) => ({ volume: s.volume, playbackMode: s.playbackMode }),
    }
  )
)
