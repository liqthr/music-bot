'use client'

import { useQuery } from '@tanstack/react-query'
import type { TrackMetadata } from '@/lib/types/track'

async function searchSpotify(query: string): Promise<TrackMetadata[]> {
  const response = await fetch(`/api/search/spotify?q=${encodeURIComponent(query)}`)
  if (!response.ok) throw new Error('Spotify search failed')
  const data = await response.json()
  return data.tracks
}

async function searchYouTube(query: string): Promise<TrackMetadata[]> {
  const response = await fetch(`/api/search/youtube?q=${encodeURIComponent(query)}`)
  if (!response.ok) throw new Error('YouTube search failed')
  const data = await response.json()
  return data.tracks
}

async function searchSoundCloud(query: string): Promise<TrackMetadata[]> {
  const response = await fetch(`/api/search/soundcloud?q=${encodeURIComponent(query)}`)
  if (!response.ok) throw new Error('SoundCloud search failed')
  const data = await response.json()
  return data.tracks
}

export function useSpotifySearch(query: string) {
  return useQuery({
    queryKey: ['search', 'spotify', query],
    queryFn: () => searchSpotify(query),
    enabled: !!query && query.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useYouTubeSearch(query: string) {
  return useQuery({
    queryKey: ['search', 'youtube', query],
    queryFn: () => searchYouTube(query),
    enabled: !!query && query.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useSoundCloudSearch(query: string) {
  return useQuery({
    queryKey: ['search', 'soundcloud', query],
    queryFn: () => searchSoundCloud(query),
    enabled: !!query && query.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useAllSearch(query: string) {
  const spotify = useSpotifySearch(query)
  const youtube = useYouTubeSearch(query)
  const soundcloud = useSoundCloudSearch(query)

  const isLoading = spotify.isLoading || youtube.isLoading || soundcloud.isLoading
  const isError = spotify.isError || youtube.isError || soundcloud.isError
  const error = spotify.error || youtube.error || soundcloud.error

  const allTracks = [
    ...(spotify.data || []),
    ...(youtube.data || []),
    ...(soundcloud.data || []),
  ]

  return {
    tracks: allTracks,
    isLoading,
    isError,
    error,
    refetch: () => {
      spotify.refetch()
      youtube.refetch()
      soundcloud.refetch()
    },
  }
}
