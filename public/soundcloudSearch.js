// soundcloudSearch.js - Updated with proper error handling and modern SoundCloud API integration
console.log('SoundCloudSearch module loaded');

const baseUrl = window.location.origin || 'http://localhost:3000';

/**
 * Searches SoundCloud for tracks matching the query
 * @param {string} query - The search query
 * @returns {Promise<Array>} - Array of tracks matching the query
 */
export async function searchSoundCloud(query) {
    console.log('searchSoundCloud called with query:', query);
    if (!query || query.trim() === '') {
        console.warn('Empty search query');
        return [];
    }

    try {
        // Use a more reliable endpoint structure with better error handling
        const response = await fetch(
            `${baseUrl}/soundcloud-search?q=${encodeURIComponent(query.trim())}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            }
        );

        // Better error handling with detailed logging
        if (!response.ok) {
            const errorData = await response.text();
            console.error('Search response error:', {
                status: response.status,
                statusText: response.statusText,
                details: errorData
            });
            throw new Error(`Failed to search SoundCloud tracks: ${response.status}`);
        }

        const data = await response.json();
        console.log('SoundCloud search results count:', data.length);

        // Map the data to a common format compatible with Spotify results
        // Handle potential missing fields more gracefully
        const formattedTracks = data
            .filter(item => item && item.title)
            .map(item => ({
                id: item.id || `sc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                name: item.title || 'Unknown Title',
                artists: [{
                    name: item.user?.username || 'Unknown Artist'
                }],
                album: {
                    images: [{
                        url: getArtworkUrl(item) || '/images/default.jpg'
                    }]
                },
                duration_ms: item.duration || 0,
                preview_url: getStreamUrl(item),
                platform: 'soundcloud',
                stream_url: getStreamUrl(item),
                permalink_url: item.permalink_url || ''
            }));

        return formattedTracks;
    } catch (error) {
        console.error("SoundCloud Search Error:", error);
        // Return empty array instead of rejecting to keep the UI functioning
        return [];
    }
}

/**
 * Extract the best available artwork URL from a SoundCloud track
 * @param {Object} track - SoundCloud track object
 * @returns {string} - Best available artwork URL
 */
function getArtworkUrl(track) {
    if (!track) return null;
    
    // Try different artwork sources in order of preference
    return (
        // Try track artwork with higher resolution
        (track.artwork_url && track.artwork_url.replace('-large', '-t500x500')) ||
        // Original artwork URL
        track.artwork_url ||
        // Try user avatar with higher resolution
        (track.user?.avatar_url && track.user.avatar_url.replace('-large', '-t500x500')) ||
        // Original user avatar
        track.user?.avatar_url ||
        // Fallback
        '/images/default.jpg'
    );
}

/**
 * Get a proper stream URL from a SoundCloud track
 * @param {Object} track - SoundCloud track object
 * @returns {string|null} - Stream URL if available
 */
function getStreamUrl(track) {
    if (!track) return null;
    
    // SoundCloud API v2 may provide different property names for stream URLs
    return track.stream_url || track.media?.transcodings?.[0]?.url || null;
}

/**
 * Get a playable stream URL with client ID
 * @param {Object} track - Track object with stream_url
 * @returns {Promise<string|null>} - Playable stream URL
 */
export async function getSoundCloudStreamUrl(track) {
    if (!track || (!track.stream_url && !track.permalink_url)) {
        console.error('Invalid track or missing URLs');
        return null;
    }
    
    try {
        // Use track permalink as fallback if stream_url is missing
        const urlToResolve = track.stream_url || track.permalink_url;
        
        const response = await fetch(
            `${baseUrl}/soundcloud-stream?url=${encodeURIComponent(urlToResolve)}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`Failed to resolve stream URL: ${response.status}`);
        }
        
        const data = await response.json();
        return data.stream_url;
    } catch (error) {
        console.error('Error resolving SoundCloud stream URL:', error);
        return null;
    }
}