// spotifySearch.js

import config from './config.js';
// Remove node-fetch import because the native fetch is available in the browser
// import fetch from 'node-fetch';

const baseUrl = config.baseUrl || 'http://localhost:3000';

console.log('SpotifySearch module loaded');

let accessToken = '';
let tokenExpiration = 0;

async function getAccessToken() {
    console.log('getAccessToken called');
    console.log('Current token:', accessToken);
    console.log('Current expiration:', tokenExpiration);
    console.log('Current time:', Date.now());

    // Use the existing token if still valid
    if (accessToken && Date.now() < tokenExpiration) {
        console.log('Using existing valid token');
        return accessToken;
    }

    try {
        console.log('Fetching new access token');
        const response = await fetch(`${baseUrl}/auth`, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });

        console.log('Auth response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Auth response error:', errorText);
            throw new Error('Failed to fetch access token');
        }

        const data = await response.json();
        console.log('Received token data:', data);

        if (!data.access_token) {
            throw new Error('No access token received');
        }

        accessToken = data.access_token;
        // Set expiration to 90% of the provided lifetime
        tokenExpiration = Date.now() + ((data.expires_in || 3600) * 900);

        console.log('New token set:', accessToken.substring(0, 10) + '...');
        console.log('New expiration:', tokenExpiration);

        return accessToken;
    } catch (error) {
        console.error('Detailed access token error:', error);
        return null;
    }
}

async function searchSpotify(query) {
    console.log('searchSpotify called with query:', query);

    if (!query) {
        console.warn('Empty search query');
        return [];
    }

    try {
        // Ensure we have a valid access token
        const token = await getAccessToken();
        if (!token) {
            console.error('No access token available');
            return [];
        }

        console.log('Searching with token:', token.substring(0, 10) + '...');

        const response = await fetch(`${baseUrl}/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.tracks || !data.tracks.items) {
            console.warn('No tracks found', data);
            return [];
        }

        return data.tracks.items.map(item => ({
            id: item.id,
            artists: item.artists,
            name: item.name,
            album: {
                images: item.album.images
            },
            preview_url: item.preview_url
        }));
    } catch (error) {
        console.error('Spotify Search Error:', error);
        return [];
    }
}

// Use only ES module exports
export { searchSpotify };
