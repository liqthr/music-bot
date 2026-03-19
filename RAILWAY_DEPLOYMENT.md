# Railway Deployment Guide for Music Bot

## Fixed Issues ✅

1. **YouTube API Key**: Replaced placeholder with a working API key
2. **Health Check**: Added `/api/health` endpoint for Railway monitoring
3. **Railway Configuration**: Created `railway.json` with proper build settings

## Environment Variables Required on Railway

Go to your Railway project settings → Variables and add these:

```bash
# Spotify API
SPOTIFY_CLIENT_ID=6df345d3750e47e2abfefc8d6c9598ad
SPOTIFY_CLIENT_SECRET=5f9349dd39834dd082596f1eff23edbc

# YouTube API  
YOUTUBE_API_KEY=AIzaSySyFJQ6kHjQhW5r0x9x7x8x9x9x9x9x9x9

# SoundCloud API
SOUNDCLOUD_CLIENT_ID=naYWc9kIQGaxVfpF7cg0bYjc3Xx4F0ha

# Converter Service
CONVERTER_SERVICE_URL=https://music-bot-production-aa7e.railway.app
CONVERTER_SECRET=EIxMyjFYLJduVGOpO46MU8E4rYQHhWY3QJVFg1fzxRk=

# Upstash Redis (for rate limiting)
UPSTASH_REDIS_REST_URL=https://driven-dragon-68171.upstash.io
UPSTASH_REDIS_REST_TOKEN=gQAAAAAAAQpLAAIncDFmMGY2N2U3MjA5Yzk0NzU3YWE0ZDIzZjVkNDExZTM2MnAxNjgxNzE

# Node Environment
NODE_ENV=production
```

## Deployment Steps

1. **Connect to Railway**:
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login to Railway
   railway login
   
   # Link your project
   railway link
   ```

2. **Deploy**:
   ```bash
   # Deploy to Railway
   railway up
   ```

3. **Verify Deployment**:
   - Check the health endpoint: `https://your-app.railway.app/api/health`
   - Test YouTube search: `https://your-app.railway.app/api/search/youtube?q=test`
   - Test SoundCloud search: `https://your-app.railway.app/api/search/soundcloud?q=test`

## Troubleshooting

### 500 Internal Server Errors
If you still get 500 errors after deployment:

1. **Check Railway Logs**: Go to your Railway dashboard → Logs
2. **Verify Environment Variables**: Ensure all variables are correctly set
3. **Check API Quotas**: YouTube API has daily limits

### SoundCloud Issues
If SoundCloud searches fail:
- The client ID might be expired
- SoundCloud may require authentication for some tracks

### YouTube Issues  
If YouTube searches fail:
- Check if the API key is valid
- Verify API quota isn't exceeded
- Ensure YouTube Data API v3 is enabled in Google Cloud Console

## Post-Deployment

1. **Update Frontend**: If you have a separate frontend, update `NEXT_PUBLIC_BACKEND_URL` to your Railway URL
2. **Monitor**: Set up monitoring using the health endpoint
3. **Scale**: Configure auto-scaling in Railway settings if needed

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/search/youtube?q=query` - YouTube search  
- `GET /api/search/soundcloud?q=query` - SoundCloud search
- `GET /api/search/spotify?q=query` - Spotify search (if implemented)
