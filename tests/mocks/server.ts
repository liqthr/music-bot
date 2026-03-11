import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Mock Spotify API responses
const mockSpotifyTrack = {
  id: '4uLU6hMCjMI75M1A2tKUQC',
  name: 'Test Track',
  artists: [{ name: 'Test Artist' }],
  album: {
    name: 'Test Album',
    images: [{ url: 'https://example.com/image.jpg' }]
  },
  duration_ms: 180000,
  preview_url: 'https://example.com/preview.mp3'
}

// Mock YouTube API responses
const mockYouTubeItem = {
  id: { videoId: 'dQw4w9WgXcQ' },
  snippet: {
    title: 'Test Video',
    channelTitle: 'Test Channel',
    thumbnails: {
      default: { url: 'https://example.com/thumb.jpg' }
    }
  }
}

export const handlers = [
  // Spotify search
  http.get('https://api.spotify.com/v1/search', () =>
    HttpResponse.json({ 
      tracks: { 
        items: [mockSpotifyTrack],
        total: 1,
        limit: 10,
        offset: 0
      } 
    })
  ),

  // YouTube search
  http.get('https://www.googleapis.com/youtube/v3/search', () =>
    HttpResponse.json({ 
      items: [mockYouTubeItem],
      pageInfo: { totalResults: 1 }
    })
  ),

  // Spotify token
  http.post('https://accounts.spotify.com/api/token', () =>
    HttpResponse.json({ 
      access_token: 'mock-access-token',
      token_type: 'Bearer',
      expires_in: 3600
    })
  ),
]

export const server = setupServer(...handlers)
