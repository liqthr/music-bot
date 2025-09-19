# 🔧 Development Setup for Coursework

This guide will help you set up the music bot for local development without needing the login flow.

## Quick Setup Steps

### 1. Get Your Spotify Token

1. Go to [Spotify Web API Console](https://developer.spotify.com/console/get-search-item/)
2. Click **"Get Token"**
3. Select these scopes (check all boxes):
   - ✅ `streaming`
   - ✅ `user-read-email`
   - ✅ `user-read-private`
   - ✅ `user-read-playback-state`
   - ✅ `user-modify-playback-state`
   - ✅ `user-read-currently-playing`
4. Click **"Request Token"**
5. Copy the generated token (starts with `BQA...`)

### 2. Configure Development Mode

1. Open `public/dev-config.js`
2. Replace `YOUR_SPOTIFY_TOKEN_HERE` with your token from step 1
3. Replace `YOUR_CLIENT_ID_HERE` with your Spotify Client ID
4. Save the file

Example:
```javascript
export const DEV_CONFIG = {
    DEVELOPMENT_MODE: true,
    SPOTIFY_ACCESS_TOKEN: 'BQAbc123def456...', // Your actual token
    SPOTIFY_CLIENT_ID: '1234567890abcdef',     // Your actual client ID
    // ... rest stays the same
};
```

### 3. Start the Server

```bash
npm start
```

### 4. Open the App

Go to `http://localhost:3000` - you should now be able to:
- ✅ Search for songs without logging in
- ✅ Play full songs (if you have Spotify Premium)
- ✅ Use all playback controls
- ✅ Add songs to queue

## Important Notes

### Token Expiration
- Spotify tokens expire after **1 hour**
- When it expires, just get a new token from the console and update `dev-config.js`
- You'll see "401 Unauthorized" errors when the token expires

### Spotify Premium Required
- **Full song playback** requires Spotify Premium
- **Free accounts** will only get 30-second previews
- The app will automatically detect your account type

### For Coursework Submission
- **DO NOT** commit `dev-config.js` with real tokens to version control
- The file is already in `.gitignore` to prevent accidental commits
- For submission, you can include the file with placeholder values

## Troubleshooting

### "No results found"
- Check if your token is valid and not expired
- Make sure you have the correct scopes selected
- Try searching for popular artists like "Ed Sheeran" or "Taylor Swift"

### "Player not ready"
- Make sure you have Spotify Premium
- Check that the Web Playback SDK is loaded (you should see the iframe)
- Try refreshing the page

### 404 Errors
- These are expected in development mode
- The app will use direct API calls instead of server endpoints
- Search functionality will still work through the development search

## Production Deployment

When ready to deploy to Vercel:
1. Set `DEVELOPMENT_MODE: false` in `dev-config.js`
2. Use the proper OAuth flow with environment variables
3. Follow the deployment instructions in the main README