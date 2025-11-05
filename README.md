# AURALIS - Music Player

A modern music player built with Next.js 14, TypeScript, and React. Search and play music from Spotify, SoundCloud, and YouTube using native HTML5 audio with FLAC support.

## Features

- **Multi-platform Search**: Search across Spotify, SoundCloud, and YouTube
- **FLAC Support**: Native browser FLAC support via HTML5 audio (no external libraries needed)
- **Modern UI**: Beautiful, responsive interface with atmospheric animations
- **Queue Management**: Add tracks to queue and manage playback
- **No Authentication Required**: Search-only functionality - no login needed
- **Resilient Fallbacks**: Automatic fallback to alternative providers if search fails

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI**: React 18
- **Audio**: HTML5 Audio (native FLAC support in modern browsers)
- **Styling**: CSS Modules with custom properties
- **API Integration**: Spotify, SoundCloud, YouTube APIs

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd music-bot
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your API credentials:
- `SPOTIFY_CLIENT_ID`: Spotify Client ID from [Spotify Dashboard](https://developer.spotify.com/dashboard)
- `SPOTIFY_CLIENT_SECRET`: Spotify Client Secret
- `YOUTUBE_API_KEY`: YouTube Data API Key from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- `SOUNDCLOUD_CLIENT_ID`: SoundCloud Client ID

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
music-bot/
├── app/
│   ├── api/              # Next.js API routes
│   │   ├── search/       # Search endpoints
│   │   └── soundcloud/   # SoundCloud stream resolver
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Main player page
│   └── globals.css       # Global styles
├── components/
│   ├── player.tsx        # Audio player component
│   ├── search-bar.tsx    # Search input component
│   └── search-results.tsx # Search results display
├── lib/
│   ├── search.ts         # Search functions
│   └── types.ts          # TypeScript types
└── public/
    └── images/           # Static assets
```

## Key Features

### Search Providers

Each platform has its own search endpoint:
- `/api/search/spotify` - Spotify search
- `/api/search/soundcloud` - SoundCloud search  
- `/api/search/youtube` - YouTube search

### Audio Playback

The player component uses native HTML5 audio:
- Native FLAC support in modern browsers (Chrome, Firefox, Safari, Edge)
- Support for preview URLs and stream URLs
- Automatic format detection and playback

### Search Fallbacks

If a primary search provider fails or returns no results, the system automatically tries alternative providers to ensure users always get results.

## Development

### Build for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Deployment

This project is ready for deployment on Vercel:

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SPOTIFY_CLIENT_ID` | Spotify API Client ID | Yes |
| `SPOTIFY_CLIENT_SECRET` | Spotify API Client Secret | Yes |
| `YOUTUBE_API_KEY` | YouTube Data API Key | Yes |
| `SOUNDCLOUD_CLIENT_ID` | SoundCloud Client ID | Yes |

## Notes

- Spotify search uses client credentials flow (no user authentication required)
- SoundCloud tracks require stream URL resolution via `/api/soundcloud/stream`
- YouTube search is limited to music category videos
- FLAC support is provided natively by modern browsers (no external libraries needed)

## License

ISC
