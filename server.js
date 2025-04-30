import dotenv from 'dotenv';
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    console.log('Headers:', req.headers);
    console.log('Query:', req.query);
    next();
});

function validateEnvVars() {
    const requiredVars = ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
        console.error(`Missing environment variables: ${missingVars.join(', ')}`);
    }
}

app.get('/auth', async (req, res) => {
    const clientId = config.spotifyClientId;
    const clientSecret = config.spotifyClientSecret;

    console.log('Auth Request - Client ID:', clientId ? 'Present' : 'Missing');

    try {
        console.log('Requesting Spotify access token');
        const response = await axios.post('https://accounts.spotify.com/api/token',
            'grant_type=client_credentials', {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        console.log('Spotify token response:', response.data);

        res.json({
            access_token: response.data.access_token,
            expires_in: response.data.expires_in
        });
    } catch (error) {
        console.error('Detailed Spotify Auth Error:', error);
        res.status(500).json({ error: 'Failed to retrieve access token' });
    }
});

app.get('/search', async (req, res) => {
    const query = req.query.q;
    const accessToken = req.headers.authorization?.split(' ')[1];

    console.log('Search Request - Query:', query, 'Token:', accessToken ? 'Present' : 'Missing');

    if (!accessToken) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        console.log('Searching Spotify with query:', query);
        const response = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        console.log('Spotify search response:', response.data);
        res.json(response.data);
        } catch (error) {
            console.error('Detailed Spotify Search Error:', error.response?.data || error.message);
            res.status(500).json({ error: 'Failed to search tracks' });
        }
    });
    
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
