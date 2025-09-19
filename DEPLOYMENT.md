# Deployment Guide

## Vercel Deployment

### Prerequisites
1. Merge the pull request #1 to main branch
2. Connect your GitHub repository to Vercel

### Environment Variables
Set these environment variables in your Vercel dashboard:

```
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SOUNDCLOUD_CLIENT_ID=your_soundcloud_client_id
YOUTUBE_API_KEY=your_youtube_api_key
NODE_ENV=production
```

### Vercel Configuration
The `vercel.json` file is configured for Node.js deployment with static file serving.

### Callback URL Configuration
The app is configured to use: `https://music-bot-brown-nine.vercel.app/callback`

Make sure to update your Spotify app settings with this callback URL:
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Select your app
3. Click "Edit Settings"
4. Add `https://music-bot-brown-nine.vercel.app/callback` to Redirect URIs
5. Save changes

### Steps to Deploy
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository `liqthr/music-bot`
4. Add the environment variables listed above
5. Deploy

### Post-Deployment
1. Test all functionality at https://music-bot-brown-nine.vercel.app
2. Verify Spotify authentication works with the new callback URL
3. Test search functionality with valid API credentials

## Local Development
1. Copy `.env.example` to `.env`
2. Fill in your API credentials
3. Run `npm start`
4. Open `http://localhost:3000`

## Features Working
- ✅ Search functionality (UI working, needs valid API credentials)
- ✅ Queue management system
- ✅ Album cover display and scaling
- ✅ Responsive design
- ✅ Platform switching (Spotify/SoundCloud)
- ✅ Volume controls
- ✅ Progress tracking
- ✅ Keyboard shortcuts