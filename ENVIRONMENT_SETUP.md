# Environment Configuration Guide
# Step-by-step setup for AURALIS architecture

## 📋 Overview of Required Services

1. **Upstash Redis** - Rate limiting
2. **Converter Service** - YouTube audio processing  
3. **Next.js App** - Main application

---

## 🔴 Step 1: Upstash Redis Setup

### 1.1 Create Upstash Account
1. Go to [upstash.com](https://upstash.com)
2. Sign up/login
3. Create new Redis database

### 1.2 Get Redis Credentials
1. In your dashboard, click on your Redis database
2. Go to "Details" tab
3. Copy these values:
   - **REST URL** (looks like: `https://xxx-xxx-xxx.upstash.io`)
   - **REST Token** (long token string)

### 1.3 Environment Variables for Next.js
Add to your `.env.local`:
```bash
# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=https://your-redis-xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_long_token_here
```

---

## 🔴 Step 2: Converter Service Setup

### 2.1 Choose Platform (Fly.io or Railway)

#### Option A: Fly.io (Recommended)
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Navigate to converter directory
cd converter

# Initialize and deploy
fly launch
fly secrets set CONVERTER_SECRET=your_unique_secret_key_here
fly deploy
```

#### Option B: Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Navigate to converter directory
cd converter

# Initialize and deploy
railway init
railway add
railway variables set CONVERTER_SECRET=your_unique_secret_key_here
railway up
```

### 2.2 Get Converter Service URL
After deployment, you'll get a URL like:
- Fly.io: `https://your-app-name.fly.dev`
- Railway: `https://your-app-name.up.railway.app`

### 2.3 Environment Variables for Converter
The converter service only needs one variable:
```bash
# Set during deployment (fly secrets set or railway variables set)
CONVERTER_SECRET=your_unique_secret_key_here
```

---

## 🔴 Step 3: Next.js App Configuration

### 3.1 Complete .env.local Setup
```bash
# === Existing API Keys ===
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SOUNDCLOUD_CLIENT_ID=your_soundcloud_client_id_here
YOUTUBE_API_KEY=your_youtube_api_key_here

# === New: Rate Limiting ===
UPSTASH_REDIS_REST_URL=https://your-redis-xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_long_token_here

# === New: Converter Service ===
CONVERTER_SERVICE_URL=https://your-converter-app.fly.dev
CONVERTER_SECRET=your_unique_secret_key_here

# === App Configuration ===
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
PORT=3000
NODE_ENV=development

# === Optional: Sentry ===
SENTRY_DSN=your_sentry_dsn_here
```

### 3.2 Important Notes
- **CONVERTER_SECRET** must be **identical** in both converter service and Next.js app
- **NEXT_PUBLIC_APP_URL** should match your deployed URL (Vercel, Netlify, etc.)
- **UPSTASH_REDIS_*** credentials come from Step 1.2

---

## 🔴 Step 4: Verification

### 4.1 Test Rate Limiting
```bash
# Start your app
npm run dev

# Test API endpoints (should work normally)
curl http://localhost:3000/api/search/spotify?q=test

# Test rate limiting (should return 429 after 30 requests)
for i in {1..35}; do curl http://localhost:3000/api/search/spotify?q=test; done
```

### 4.2 Test Converter Service
```bash
# Test converter directly
curl -H "x-converter-secret: your_secret" \
     "https://your-converter.fly.dev/convert?id=dQw4w9WgXcQ&format=flac"

# Test via Next.js proxy
curl "http://localhost:3000/api/audio/youtube?id=dQw4w9WgXcQ&format=flac"
```

---

## 🔴 Step 5: Production Deployment

### 5.1 Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
# Go to: vercel.com/your-project/settings/environment-variables
# Add all variables from Step 3.1
```

### 5.2 Environment Variables in Vercel Dashboard
In your Vercel project settings, add:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN` 
- `CONVERTER_SERVICE_URL`
- `CONVERTER_SECRET`
- `NEXT_PUBLIC_APP_URL` (set to your Vercel URL)
- All your API keys (Spotify, YouTube, SoundCloud)

---

## 🔧 Troubleshooting

### Common Issues

#### Rate Limiting Not Working
```bash
# Check if Redis credentials are correct
curl https://your-redis-url.upstash.io/ping
# Should return: {"result":"pong"}
```

#### Converter Service Fails
```bash
# Check converter logs
fly logs  # or railway logs

# Test converter health
curl -H "x-converter-secret: your_secret" \
     "https://your-converter.fly.dev/"
```

#### CORS Issues
Make sure `NEXT_PUBLIC_APP_URL` matches your actual domain:
```bash
# For local development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# For production
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

---

## 📋 Quick Reference

| Service | Required Variables | Where to Get |
|---------|-------------------|---------------|
| **Upstash Redis** | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Upstash dashboard |
| **Converter** | `CONVERTER_SECRET` | Choose your own |
| **Next.js App** | All above + API keys | Various providers |

### Security Best Practices
1. **Never commit `.env.local`** to git
2. **Use strong secrets** for `CONVERTER_SECRET`
3. **Rotate secrets** periodically
4. **Use different environments** (dev/staging/prod)

---

## 🚀 Ready to Go!

Once you've completed these steps:
1. ✅ Rate limiting protects your APIs
2. ✅ YouTube audio extraction works in production  
3. ✅ All services communicate securely
4. ✅ Your app is production-ready

Your AURALIS music player now has enterprise-grade architecture!
