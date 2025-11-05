// spotifySearch.js

import config from './config.js';

const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : window.location.origin;

console.log('SpotifySearch module loaded');

let accessToken = '';
let tokenExpiration = 0;

/**
 * Get Spotify access token, either from cache or by making a new request
 * @returns {Promise<string|null>} - The access token or null if failed
 */
async function getAccessToken() {
    console.log('getAccessToken called');
    
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
        
        if (!data.access_token) {
            throw new Error('No access token received');
        }

        accessToken = data.access_token;
        // Set expiration to 90% of the provided lifetime to ensure we refresh before expiration
        // expires_in is in seconds, so convert to milliseconds (* 1000) then take 90% (* 0.9)
        const expiresInSeconds = data.expires_in || 3600;
        tokenExpiration = Date.now() + (expiresInSeconds * 1000 * 0.9);

        console.log('New token received and cached');
        return accessToken;
    } catch (error) {
        console.error('Detailed access token error:', error);
        return null;
    }
}

/**
 * Search Spotify for tracks matching the query
 * @param {string} query - The search query
 * @returns {Promise<Array>} - Array of tracks matching the query
 */
async function searchSpotify(query, options = {}) {
    console.log('searchSpotify called with query:', query);

    if (!query || query.trim() === '') {
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

        const response = await fetch(`${baseUrl}/search?q=${encodeURIComponent(query.trim())}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            },
            signal: options.signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Search failed:', errorText);
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.tracks || !data.tracks.items) {
            console.warn('No tracks found in response', data);
            return [];
        }

        // Format track data for consistency with other platforms
        return data.tracks.items.map(item => ({
            id: item.id,
            artists: item.artists,
            name: item.name,
            album: {
                images: item.album.images
            },
            preview_url: item.preview_url,
            uri: item.uri,
            platform: 'spotify', // Add platform identifier
            external_url: item.external_urls?.spotify || ''
        }));
    } catch (error) {
        console.error('Spotify Search Error:', error);
        return [];
    }
}

// Use ES module exports
export { searchSpotify };