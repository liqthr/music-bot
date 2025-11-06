// soundcloudSearch.js - Enhanced with better error handling and fallback mechanisms

console.log('SoundCloudSearch module loaded');

const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : window.location.origin;

/**
 * Creates an abort signal with timeout support, with fallback for browsers without AbortSignal.timeout
 * @param {number} timeoutMs - Timeout in milliseconds (default: 10000)
 * @param {AbortSignal} [userSignal] - Optional user-provided signal to use instead
 * @returns {{signal: AbortSignal, cleanup: function}} - Signal and cleanup function
 */
function createTimeoutSignal(timeoutMs = 10000, userSignal = null) {
    // Prefer user-provided signal if available
    if (userSignal) {
        return { signal: userSignal, cleanup: () => {} };
    }

    // Use AbortSignal.timeout if available (modern browsers)
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
        return { signal: AbortSignal.timeout(timeoutMs), cleanup: () => {} };
    }

    // Fallback: create AbortController with setTimeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    return {
        signal: controller.signal,
        cleanup: () => clearTimeout(timeoutId)
    };
}

/**
 * Searches SoundCloud for tracks matching the query
 * @param {string} query - The search query
 * @returns {Promise<Array>} - Array of tracks matching the query
 */
export async function searchSoundCloud(query, options = {}) {
    console.log('searchSoundCloud called with query:', query);
    if (!query || query.trim() === '') {
        console.warn('Empty search query');
        return [];
    }

    try {
        // Create timeout signal with fallback support
        const { signal: firstSignal, cleanup: firstCleanup } = createTimeoutSignal(10000, options.signal);

        // First attempt - standard endpoint
        let response;
        try {
            response = await fetch(
                `${baseUrl}/soundcloud-search?q=${encodeURIComponent(query.trim())}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache'
                    },
                    signal: firstSignal
                }
            );
        } finally {
            // Clean up timeout if we created one
            firstCleanup();
        }

        // If first attempt fails with 500, try alternative endpoint
        if (!response.ok && response.status === 500) {
            console.warn('Primary SoundCloud endpoint failed, trying fallback...');
            const { signal: fallbackSignal, cleanup: fallbackCleanup } = createTimeoutSignal(10000, options.signal);
            try {
                response = await fetch(
                    `${baseUrl}/soundcloud-search-alt?q=${encodeURIComponent(query.trim())}`,
                    {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cache-Control': 'no-cache'
                        },
                        signal: fallbackSignal
                    }
                );
            } finally {
                // Clean up timeout if we created one
                fallbackCleanup();
            }
        }

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
        console.log('SoundCloud search results count:', data.length || 'unknown format');

        // Handle different response formats from SoundCloud API
        let tracks = [];
        if (Array.isArray(data)) {
            tracks = data;
        } else if (data.collection && Array.isArray(data.collection)) {
            tracks = data.collection;
        } else {
            console.warn('Unexpected SoundCloud API response format:', data);
            return [];
        }

        // Map the data to a common format compatible with Spotify results
        // Handle potential missing fields more gracefully
        const formattedTracks = tracks
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
                // Use the permalink_url for SoundCloud streams
                preview_url: `${baseUrl}/soundcloud-stream?url=${encodeURIComponent(item.permalink_url || item.uri)}`,
                platform: 'soundcloud',
                permalink_url: item.permalink_url || ''
            }));

        return formattedTracks;
    } catch (error) {
        console.error("SoundCloud Search Error:", error);
        // Add more detailed error info for debugging
        if (error.name === 'AbortError') {
            console.error("SoundCloud search timed out");
        }
        throw error; // Let the main search function handle the error for fallback
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
    // Handle potential null values safely with optional chaining
    return (
        // Try track artwork with higher resolution if available
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