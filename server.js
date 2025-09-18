import dotenv from 'dotenv';
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import qs from 'qs';
import config from './config.js';
import winston from 'winston';
import { youtube_v3 } from '@googleapis/youtube';

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'server.log' })
  ]
});

// Load environment variables
dotenv.config();

// Validate environment variables
const requiredEnvVars = [
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
    'YOUTUBE_API_KEY'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
    console.error('Missing required environment variables:', missingEnvVars);
    process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    headers: {
      ...req.headers,
      authorization: req.headers.authorization ? 'Present' : 'Missing'
    }
  });
  next();
});

// Initialize YouTube API client
const youtube = new youtube_v3.Youtube({
  auth: process.env.YOUTUBE_API_KEY
});

// Validate environment variables on startup
function validateEnvVars() {
  const requiredVars = ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'YOUTUBE_API_KEY'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    logger.error(`Missing environment variables: ${missingVars.join(', ')}`);
    return false;
  }
  return true;
}

// Spotify authentication endpoint
app.get('/auth', async (req, res) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Missing Spotify credentials' });
  }

  try {
    logger.info('Requesting Spotify access token');
    const response = await axios.post('https://accounts.spotify.com/api/token',
      'grant_type=client_credentials', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    logger.info('Spotify token retrieved successfully');

    res.json({
      access_token: response.data.access_token,
      expires_in: response.data.expires_in
    });
  } catch (error) {
    logger.error('Spotify Auth Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to retrieve access token' });
  }
});

// Spotify search endpoint
app.get('/search', async (req, res) => {
  const query = req.query.q;
  const accessToken = req.headers.authorization?.split(' ')[1];

  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  if (!accessToken) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    logger.info(`Searching Spotify with query: ${query}`);
    const response = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`, 
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    logger.info('Spotify search successful');
    res.json(response.data);
  } catch (error) {
    logger.error('Spotify Search Error:', error.response?.data || error.message);
    
    // Handle token expiration
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Access token expired', code: 'TOKEN_EXPIRED' });
    }
    
    res.status(500).json({ error: 'Failed to search tracks' });
  }
});

// YouTube search endpoint
app.get('/youtube-search', async (req, res) => {
  const query = req.query.q;
  
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }
  
  if (!process.env.YOUTUBE_API_KEY) {
    return res.status(500).json({ error: 'Missing YouTube API key' });
  }
  
  try {
    logger.info(`Searching YouTube with query: ${query}`);
    
    const response = await youtube.search.list({
      part: 'snippet',
      q: query,
      maxResults: 5,
      type: 'video',
      videoCategoryId: '10', // Music category
      videoEmbeddable: true,
    });
    
    logger.info(`Found ${response.data.items?.length || 0} YouTube results`);
    res.json(response.data);
  } catch (error) {
    logger.error('YouTube Search Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to search YouTube', message: error.message });
  }
});

// YouTube video details endpoint (to get duration, etc.)
app.get('/youtube-video/:id', async (req, res) => {
  const videoId = req.params.id;
  
  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required' });
  }
  
  try {
    logger.info(`Getting YouTube video details for: ${videoId}`);
    
    const response = await youtube.videos.list({
      part: 'contentDetails,snippet,statistics',
      id: videoId
    });
    
    if (!response.data.items || response.data.items.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json(response.data.items[0]);
  } catch (error) {
    logger.error('YouTube Video Detail Error:', error);
    res.status(500).json({ error: 'Failed to get video details' });
  }
});

// Updated SoundCloud endpoints for server.js

// Primary SoundCloud search endpoint
app.get('/soundcloud-search', async (req, res) => {
  const query = req.query.q;
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;

  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  if (!clientId) {
    logger.error('Missing SoundCloud client ID in environment variables');
    return res.status(500).json({ error: 'Missing SoundCloud client ID' });
  }

  try {
    logger.info(`Searching SoundCloud with query: ${query}`);
    
    // Try the modern v2 API first
    const response = await axios({
      method: 'GET',
      url: 'https://api-v2.soundcloud.com/search/tracks',
      params: {
        q: query,
        client_id: clientId,
        limit: 10,
        offset: 0
      },
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      // Add timeout to prevent hanging requests
      timeout: 8000
    });

    logger.info('SoundCloud search successful');
    
    if (response.data && response.data.collection) {
      // Return just the track data from the collection
      res.json(response.data.collection);
    } else {
      // Fallback for different response format
      res.json(response.data);
    }
  } catch (error) {
    logger.error('SoundCloud Search Error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      code: error.code
    });
    
    res.status(500).json({ 
      error: 'Failed to search SoundCloud tracks',
      message: error.message,
      details: error.response?.data || error.code
    });
  }
});

// Alternative SoundCloud search endpoint using the public API
app.get('/soundcloud-search-alt', async (req, res) => {
  const query = req.query.q;
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;

  if (!query || !clientId) {
    return res.status(400).json({ error: 'Query and client ID are required' });
  }

  try {
    logger.info(`Using alternative SoundCloud search for: ${query}`);
    
    // Try the public web API instead of the v2 API
    const response = await axios({
      method: 'GET',
      url: 'https://api.soundcloud.com/tracks',
      params: {
        q: query,
        client_id: clientId,
        limit: 10,
        linked_partitioning: 1
      },
      headers: {
        'Accept': 'application/json'
      },
      timeout: 8000
    });

    logger.info('Alternative SoundCloud search successful');
    res.json(response.data.collection || response.data);
  } catch (error) {
    logger.error('Alternative SoundCloud Search Error:', error.message);
    res.status(500).json({ error: 'Failed to search tracks with alternative endpoint' });
  }
});

// Improved SoundCloud stream URL resolver with better error handling
app.get('/soundcloud-stream', async (req, res) => {
  const trackUrl = req.query.url;
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;

  if (!trackUrl) {
    return res.status(400).json({ error: 'Track URL is required' });
  }

  if (!clientId) {
    logger.error('Missing SoundCloud client ID in environment variables');
    return res.status(500).json({ error: 'Missing SoundCloud client ID' });
  }

  try {
    logger.info(`Resolving SoundCloud stream URL for: ${trackUrl}`);
    
    // First resolve the track URL to get track data
    const resolveResponse = await axios({
      method: 'GET',
      url: `https://api-v2.soundcloud.com/resolve`,
      params: {
        url: trackUrl,
        client_id: clientId
      },
      timeout: 8000
    });
    
    const track = resolveResponse.data;
    
    // Check if we got valid track data
    if (!track || !track.id) {
      throw new Error('Invalid track data received from SoundCloud');
    }
    
    logger.info('SoundCloud track resolved successfully');

    // If we don't have media info, try to fetch it directly using the track ID
    if (!track.media || !track.media.transcodings) {
      logger.info('Fetching detailed track info from track ID');
      
      const trackDetailResponse = await axios({
        method: 'GET',
        url: `https://api-v2.soundcloud.com/tracks/${track.id}`,
        params: {
          client_id: clientId
        },
        timeout: 8000
      });
      
      if (trackDetailResponse.data && trackDetailResponse.data.media) {
        track.media = trackDetailResponse.data.media;
      } else {
        throw new Error('Failed to get track media information');
      }
    }
    
    if (!track.media || !track.media.transcodings || track.media.transcodings.length === 0) {
      throw new Error('No transcoding information available for this track');
    }
    
    // Find a progressive MP3 stream if available
    const progressiveStream = track.media.transcodings.find(
      t => t.format.protocol === 'progressive' && t.format.mime_type.includes('audio/mpeg')
    );
    
    // Or try to find an HLS stream as backup
    const hlsStream = !progressiveStream ? 
      track.media.transcodings.find(t => t.format.protocol === 'hls') : null;
    
    const streamInfo = progressiveStream || hlsStream;
    
    if (!streamInfo) {
      throw new Error('No suitable stream format found');
    }
    
    // Get the actual audio URL from the transcoding URL
    const streamResponse = await axios({
      method: 'GET',
      url: streamInfo.url,
      params: {
        client_id: clientId
      },
      timeout: 8000
    });
    
    if (!streamResponse.data || !streamResponse.data.url) {
      throw new Error('Failed to get stream URL');
    }
    
    res.json({ stream_url: streamResponse.data.url });
    
  } catch (error) {
    logger.error('SoundCloud Stream Resolution Error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      code: error.code
    });
    
    res.status(500).json({ 
      error: 'Failed to resolve stream URL',
      message: error.message,
      details: error.response?.data || error.code
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const envStatus = validateEnvVars();
  res.status(envStatus ? 200 : 500).json({
    status: envStatus ? 'ok' : 'missing environment variables',
    timestamp: new Date().toISOString()
  });
});

// Error handler middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Server error', message: err.message });
});

// Start server
if (validateEnvVars()) {
  app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
  });
} else {
  logger.error('Server not started due to missing environment variables');
}
