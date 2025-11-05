# AURALIS - Music Player

A modern music player built with Next.js 14, TypeScript, and React. Search and play music from Spotify, SoundCloud, and YouTube using native HTML5 audio with FLAC support.

## Features

- **Multi-platform Search**: Search across Spotify, SoundCloud, and YouTube (mode-specific, no automatic fallbacks)
- **High-Quality Audio**: Download and play YouTube audio in FLAC (lossless) or MP3 (high-quality) formats
- **FLAC Support**: Native browser FLAC support via HTML5 audio (no external libraries needed)
- **Modern UI**: Beautiful, responsive interface with atmospheric animations
- **Queue Management**: Add tracks to queue and manage playback
- **No Authentication Required**: Search-only functionality - no login needed
- **Platform-Specific Results**: Each search mode shows results only from the selected platform

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
- **yt-dlp** (for YouTube audio download) - [Installation Guide](https://github.com/yt-dlp/yt-dlp#installation)
- **ffmpeg** (for audio conversion) - [Download](https://ffmpeg.org/download.html)

**Installing yt-dlp and ffmpeg:**

**macOS (using Homebrew):**
```bash
brew install yt-dlp ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install yt-dlp ffmpeg
```

**Windows:**
- Download yt-dlp from: https://github.com/yt-dlp/yt-dlp/releases
- Download ffmpeg from: https://ffmpeg.org/download.html
- Add both to your system PATH

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
│   │   ├── audio/        # Audio download/conversion
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
- **Spotify**: Uses preview URLs (30-second previews, if available)
- **SoundCloud**: Streams full tracks via SoundCloud API
- **YouTube**: Downloads and converts audio to FLAC (lossless) or MP3 (192kbps) using yt-dlp
- Native FLAC support in modern browsers (Chrome, Firefox, Safari, Edge)
- Automatic format detection and playback

### Audio Download & Conversion

YouTube tracks are automatically downloaded and converted:
- **FLAC Format**: Lossless audio quality (default)
- **MP3 Format**: High-quality 192kbps encoding
- Files are cached to avoid re-downloading
- Conversion handled by yt-dlp and ffmpeg

### Search Behavior

- **Mode-Specific Results**: Each search mode (Spotify/SoundCloud/YouTube) shows results only from that platform
- **No Automatic Fallbacks**: Results are filtered to match the selected platform
- **Quality Filtering**: Spotify results only include tracks with available preview URLs

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

**Note**: YouTube audio download requires yt-dlp and ffmpeg installed on the server. For Vercel/serverless environments, consider:
- Using a Docker container with yt-dlp pre-installed
- Using an external API service for audio extraction
- Running a separate server/container for audio processing
- Using Edge Functions with a custom runtime (if supported)

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SPOTIFY_CLIENT_ID` | Spotify API Client ID | Yes |
| `SPOTIFY_CLIENT_SECRET` | Spotify API Client Secret | Yes |
| `YOUTUBE_API_KEY` | YouTube Data API Key | Yes |
| `SOUNDCLOUD_CLIENT_ID` | SoundCloud Client ID | Yes |

## Notes

- **Spotify**: Only tracks with preview URLs are shown (30-second previews). Full tracks require Spotify Premium and Web Playback SDK integration.
- **SoundCloud**: Full tracks are streamed via SoundCloud API
- **YouTube**: Audio is downloaded and converted using yt-dlp. Requires yt-dlp and ffmpeg installed on server.
- **Search Modes**: Each mode shows results only from the selected platform (no automatic fallbacks)
- **FLAC Support**: Provided natively by modern browsers (no external libraries needed)
- **Server Requirements**: For YouTube audio download, ensure yt-dlp and ffmpeg are installed and accessible in your system PATH

## License

ISC
