# Deploy to Vercel Instructions

## Quick Deployment Steps

### Option 1: Using Vercel CLI (Recommended)
1. Install Vercel CLI globally:
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy from the project directory:
   ```bash
   cd /path/to/music-bot
   vercel --prod
   ```

4. Follow the prompts:
   - Link to existing project? **Yes** (if you already have the project on Vercel)
   - Project name: **music-bot**
   - Deploy to production? **Yes**

### Option 2: Using Vercel Dashboard
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import from GitHub: `liqthr/music-bot`
4. Configure:
   - Framework Preset: **Other**
   - Build Command: (leave empty)
   - Output Directory: (leave empty)
   - Install Command: `npm install`

### Environment Variables to Set in Vercel
```
SPOTIFY_CLIENT_ID=7d5f49487f00431b94f30c773348219c
SPOTIFY_CLIENT_SECRET=b844cc8917be410ba8002ef89c8cedfa
SOUNDCLOUD_CLIENT_ID=naYWc9kIQGaxVfpF7cg0bYjc3Xx4F0ha
YOUTUBE_API_KEY=AIzaSyCU5jm865sr8l8kSS4GrLL4j6MsQG32YHs
NODE_ENV=production
```

### After Deployment
1. Your app will be available at: `https://music-bot-brown-nine.vercel.app`
2. Update Spotify app settings with callback URL: `https://music-bot-brown-nine.vercel.app/callback`
3. Test all functionality

### Spotify App Configuration
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Select your app (or create a new one)
3. Click "Edit Settings"
4. Add to Redirect URIs:
   - `https://music-bot-brown-nine.vercel.app/callback`
   - `http://localhost:3000/callback` (for local development)
5. Save changes

### Troubleshooting
- If deployment fails, check the build logs in Vercel dashboard
- Ensure all environment variables are set correctly
- Verify the callback URL matches exactly in Spotify settings
- Check that the repository is public and accessible

### Files Ready for Deployment
- ✅ `vercel.json` - Configured for Node.js + static files
- ✅ `package.json` - Dependencies and scripts
- ✅ `server.js` - Main server file
- ✅ `public/` - Static assets and client-side code
- ✅ Environment variables configured
- ✅ Callback URL set to your Vercel domain