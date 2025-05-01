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
dotenv.config({ path: './spotify.env' });

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

// SoundCloud client ID endpoint
app.get('/soundcloud-client-id', (req, res) => {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  
  if (!clientId) {
    return res.status(500).json({ error: 'Missing SoundCloud client ID' });
  }
  
  res.json({ clientId });
});

// SoundCloud search endpoint
app.get('/soundcloud-search', async (req, res) => {
  const query = req.query.q;
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;

  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  if (!clientId) {
    return res.status(500).json({ error: 'Missing SoundCloud client ID' });
  }

  try {
    logger.info(`Searching SoundCloud with query: ${query}`);
    const response = await axios.get(
      `https://api.soundcloud.com/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=10`
    );

    logger.info('SoundCloud search successful');
    res.json(response.data);
  } catch (error) {
    logger.error('SoundCloud Search Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to search SoundCloud tracks' });
  }
});

// SoundCloud stream URL resolver
app.get('/soundcloud-stream', async (req, res) => {
  const trackUrl = req.query.url;
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;

  if (!trackUrl) {
    return res.status(400).json({ error: 'Track URL is required' });
  }

  if (!clientId) {
    return res.status(500).json({ error: 'Missing SoundCloud client ID' });
  }

  try {
    logger.info(`Resolving SoundCloud stream URL for: ${trackUrl}`);
    const response = await axios.get(
      `${trackUrl}?client_id=${clientId}`
    );

    logger.info('SoundCloud stream URL resolved');
    res.json({ stream_url: response.data.stream_url });
  } catch (error) {
    logger.error('SoundCloud Stream Resolution Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to resolve stream URL' });
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
