import { describe, it, expect } from 'vitest'
import { normalizeSpotifyTrack, normalizeYouTubeVideo, normalizeSoundCloudTrack } from '@/lib/normalizers'

describe('track normalizers', () => {
  describe('normalizeSpotifyTrack', () => {
    it('converts Spotify API response to TrackMetadata', () => {
      const spotifyTrack = {
        id: '4uLU6hMCjMI75M1A2tKUQC',
        name: 'Test Track',
        artists: [{ name: 'Test Artist' }, { name: 'Featured Artist' }],
        album: {
          name: 'Test Album',
          artists: [{ name: 'Album Artist' }],
          images: [
            { url: 'https://example.com/image.jpg', width: 300, height: 300 }
          ],
        },
        duration_ms: 180000,
        track_number: 5,
        preview_url: 'https://example.com/preview.mp3',
      }

      const result = normalizeSpotifyTrack(spotifyTrack)

      expect(result).toEqual({
        id: 'spotify:4uLU6hMCjMI75M1A2tKUQC',
        title: 'Test Track',
        artist: 'Test Artist, Featured Artist',
        album: 'Test Album',
        albumArtist: 'Album Artist',
        trackNumber: 5,
        durationSeconds: 180,
        artwork: {
          url: 'https://example.com/image.jpg',
          width: 300,
          height: 300,
        },
        source: {
          platform: 'spotify',
          platformId: '4uLU6hMCjMI75M1A2tKUQC',
          previewUrl: 'https://example.com/preview.mp3',
          quality: 'preview',
        },
        fetchedAt: expect.any(Number),
      })
    })

    it('handles missing optional fields', () => {
      const minimalTrack = {
        id: 'test-id',
        name: 'Minimal Track',
        artists: [{ name: 'Artist' }],
        album: {
          name: 'Album',
          artists: [],
          images: [],
        },
        duration_ms: 120000,
      }

      const result = normalizeSpotifyTrack(minimalTrack)

      expect(result.title).toBe('Minimal Track')
      expect(result.artwork).toBeNull()
      expect(result.source.previewUrl).toBeUndefined()
      expect(result.source.quality).toBeUndefined()
    })
  })

  describe('normalizeYouTubeVideo', () => {
    it('converts YouTube API response to TrackMetadata', () => {
      const youtubeVideo = {
        id: { videoId: 'dQw4w9WgXcQ' },
        snippet: {
          title: 'Test Video',
          channelTitle: 'Test Channel',
          thumbnails: {
            default: { url: 'https://example.com/thumb.jpg', width: 120, height: 90 }
          },
        },
      }

      const result = normalizeYouTubeVideo(youtubeVideo)

      expect(result).toEqual({
        id: 'youtube:dQw4w9WgXcQ',
        title: 'Test Video',
        artist: 'Test Channel',
        durationSeconds: 0,
        artwork: {
          url: 'https://example.com/thumb.jpg',
          width: 120,
          height: 90,
        },
        source: {
          platform: 'youtube',
          platformId: 'dQw4w9WgXcQ',
        },
        fetchedAt: expect.any(Number),
      })
    })

    it('handles missing thumbnails', () => {
      const videoWithoutThumb = {
        id: { videoId: 'test-id' },
        snippet: {
          title: 'Video',
          channelTitle: 'Channel',
          thumbnails: {},
        },
      }

      const result = normalizeYouTubeVideo(videoWithoutThumb)

      expect(result.artwork).toBeNull()
    })
  })

  describe('normalizeSoundCloudTrack', () => {
    it('converts SoundCloud API response to TrackMetadata', () => {
      const soundcloudTrack = {
        id: 12345,
        title: 'SC Track',
        duration: 240000, // 4 minutes in ms
        artwork_url: 'https://example.com/artwork.jpg',
        stream_url: 'https://api.soundcloud.com/stream/12345',
        user: {
          username: 'SC Artist',
        },
      }

      const result = normalizeSoundCloudTrack(soundcloudTrack)

      expect(result).toEqual({
        id: 'soundcloud:12345',
        title: 'SC Track',
        artist: 'SC Artist',
        durationSeconds: 240,
        artwork: {
          url: 'https://example.com/artwork.jpg',
        },
        source: {
          platform: 'soundcloud',
          platformId: '12345',
          streamUrl: 'https://api.soundcloud.com/stream/12345',
          quality: 'mp3-192',
        },
        fetchedAt: expect.any(Number),
      })
    })

    it('handles missing user and artwork', () => {
      const minimalTrack = {
        id: 67890,
        title: 'Minimal SC Track',
        duration: 180000,
      }

      const result = normalizeSoundCloudTrack(minimalTrack)

      expect(result.artist).toBe('Unknown Artist')
      expect(result.artwork).toBeNull()
      expect(result.source.streamUrl).toBeUndefined()
      expect(result.source.quality).toBeUndefined()
    })
  })
})
