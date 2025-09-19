// Development search functions - direct API calls without server
// For coursework/local development only

// Get access token using Client Credentials flow
async function getClientCredentialsToken(clientId, clientSecret) {
    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret)
            },
            body: 'grant_type=client_credentials'
        });

        if (!response.ok) {
            throw new Error(`Token request failed: ${response.status}`);
        }

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error('Failed to get client credentials token:', error);
        return null;
    }
}

export async function devSearchSpotify(query, config) {
    try {
        // Get token using client credentials
        const token = await getClientCredentialsToken(config.SPOTIFY_CLIENT_ID, config.SPOTIFY_CLIENT_SECRET);
        
        if (!token) {
            console.error('No Spotify token available for search');
            return getFallbackTracks(query);
        }

        const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Spotify API error: ${response.status}`);
        }

        const data = await response.json();
        
        return data.tracks.items.map(track => ({
            id: track.id,
            name: track.name,
            artists: track.artists,
            album: track.album,
            duration_ms: track.duration_ms,
            preview_url: track.preview_url,
            external_urls: track.external_urls,
            uri: track.uri,
            platform: 'spotify'
        }));
    } catch (error) {
        console.error('Dev Spotify search error:', error);
        return getFallbackTracks(query);
    }
}

// Fallback search with some sample tracks for demo purposes
export function getFallbackTracks(query) {
    const sampleTracks = [
        {
            id: 'sample1',
            name: 'Imagine Dragons - Believer',
            artists: [{ name: 'Imagine Dragons' }],
            album: { 
                name: 'Evolve',
                images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273b2b2747c89d2157b0b29fb6a' }]
            },
            duration_ms: 204000,
            preview_url: 'https://p.scdn.co/mp3-preview/6b00e0d9e3b2e0b0e0b0e0b0e0b0e0b0e0b0e0b0',
            platform: 'spotify'
        },
        {
            id: 'sample2',
            name: 'Ed Sheeran - Shape of You',
            artists: [{ name: 'Ed Sheeran' }],
            album: { 
                name: '÷ (Divide)',
                images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273ba5db46f4b838ef6027e6f96' }]
            },
            duration_ms: 233000,
            preview_url: 'https://p.scdn.co/mp3-preview/7b00e0d9e3b2e0b0e0b0e0b0e0b0e0b0e0b0e0b0',
            platform: 'spotify'
        },
        {
            id: 'sample3',
            name: 'The Weeknd - Blinding Lights',
            artists: [{ name: 'The Weeknd' }],
            album: { 
                name: 'After Hours',
                images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36' }]
            },
            duration_ms: 200000,
            preview_url: 'https://p.scdn.co/mp3-preview/8b00e0d9e3b2e0b0e0b0e0b0e0b0e0b0e0b0e0b0',
            platform: 'spotify'
        }
    ];

    // Filter tracks based on query
    const filtered = sampleTracks.filter(track => 
        track.name.toLowerCase().includes(query.toLowerCase()) ||
        track.artists[0].name.toLowerCase().includes(query.toLowerCase())
    );

    return filtered.length > 0 ? filtered : sampleTracks;
}