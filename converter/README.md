# Converter Service Deployment

This directory contains the converter microservice for YouTube audio processing.

## Deployment Options

### Fly.io
```bash
# From converter directory
fly launch
fly secrets set CONVERTER_SECRET=your-secret-key
fly deploy
```

### Railway
```bash
# From converter directory
railway login
railway init
railway add
railway variables set CONVERTER_SECRET=your-secret-key
railway up
```

## Environment Variables

- `CONVERTER_SECRET`: Shared secret between Next.js app and converter service
- `PORT`: Service port (default: 3001)

## Usage

Once deployed, set these in your Next.js environment:
- `CONVERTER_SERVICE_URL`: https://your-converter-service.fly.dev
- `CONVERTER_SECRET`: Same secret as the converter service

## API Endpoints

### GET /convert
Converts YouTube video to audio format.

**Query Parameters:**
- `id`: YouTube video ID (required)
- `format`: Output format, `flac` or `mp3` (default: `flac`)

**Headers:**
- `x-converter-secret`: Authentication secret

**Response:** Audio stream with appropriate Content-Type header

## Architecture

The service uses a pipeline:
1. `yt-dlp` extracts audio from YouTube
2. `ffmpeg` converts to requested format (FLAC/MP3)
3. Streams directly back to client

This avoids buffering entire files in memory and enables CDN caching.
