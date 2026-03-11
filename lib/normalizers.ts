import type { TrackMetadata, TrackSource } from '@/lib/types/track'

export function normalizeSpotifyTrack(spotifyTrack: any): TrackMetadata {
  const track = spotifyTrack
  return {
    id: `spotify:${track.id}`,
    title: track.name,
    artist: track.artists.map((a: any) => a.name).join(', '),
    album: track.album.name,
    albumArtist: track.album.artists[0]?.name,
    trackNumber: track.track_number,
    durationSeconds: Math.floor(track.duration_ms / 1000),
    artwork: track.album.images[0] ? {
      url: track.album.images[0].url,
      width: track.album.images[0].width,
      height: track.album.images[0].height,
    } : null,
    source: {
      platform: 'spotify',
      platformId: track.id,
      previewUrl: track.preview_url,
      quality: track.preview_url ? 'preview' : undefined,
    },
    fetchedAt: Date.now(),
  }
}

export function normalizeYouTubeVideo(video: any): TrackMetadata {
  const snippet = video.snippet
  const videoId = video.id.videoId
  
  return {
    id: `youtube:${videoId}`,
    title: snippet.title,
    artist: snippet.channelTitle,
    durationSeconds: 0, // YouTube search doesn't include duration
    artwork: snippet.thumbnails.default ? {
      url: snippet.thumbnails.default.url,
      width: snippet.thumbnails.default.width,
      height: snippet.thumbnails.default.height,
    } : null,
    source: {
      platform: 'youtube',
      platformId: videoId,
    },
    fetchedAt: Date.now(),
  }
}

export function normalizeSoundCloudTrack(track: any): TrackMetadata {
  return {
    id: `soundcloud:${track.id}`,
    title: track.title,
    artist: track.user?.username || 'Unknown Artist',
    durationSeconds: Math.floor(track.duration / 1000),
    artwork: track.artwork_url ? {
      url: track.artwork_url,
    } : null,
    source: {
      platform: 'soundcloud',
      platformId: track.id.toString(),
      streamUrl: track.stream_url,
      quality: track.stream_url ? 'mp3-192' : undefined,
    },
    fetchedAt: Date.now(),
  }
}
