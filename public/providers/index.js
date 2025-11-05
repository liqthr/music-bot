// Unified search provider facade with resilient fallbacks per mode.
// This concentrates cross-provider fallback logic in one place so the UI can
// call a single function regardless of the selected mode.

import { searchSpotify } from '../spotifySearch.js';
import { searchSoundCloud } from '../soundcloudSearch.js';
import { searchYouTube } from '../youtubeSearch.js';

/**
 * Attempt a list of async search functions in order until one returns results.
 * Ensures we always try multiple backends before surfacing an empty result.
 */
async function tryInOrder(tasks) {
    for (const task of tasks) {
        try {
            const results = await task();
            if (Array.isArray(results) && results.length > 0) return results;
        } catch (err) {
            // Swallow and continue to next provider; UI will show message if all fail
            console.warn('Provider attempt failed:', err?.message || err);
        }
    }
    return [];
}

/**
 * Provider-specific orchestrators with built-in fallback order.
 * - spotify mode: Spotify → SoundCloud → YouTube
 * - soundcloud mode: SoundCloud → Spotify → YouTube
 * - youtube mode: YouTube → Spotify → SoundCloud
 */
export const searchProvider = {
    async spotify(query, options = {}) {
        const { signal } = options;
        return await tryInOrder([
            () => searchSpotify(query, { signal }),
            () => searchSoundCloud(query, { signal }),
            () => searchYouTube(query, { signal })
        ]);
    },
    async soundcloud(query, options = {}) {
        const { signal } = options;
        return await tryInOrder([
            () => searchSoundCloud(query, { signal }),
            () => searchSpotify(query, { signal }),
            () => searchYouTube(query, { signal })
        ]);
    },
    async youtube(query, options = {}) {
        const { signal } = options;
        return await tryInOrder([
            () => searchYouTube(query, { signal }),
            () => searchSpotify(query, { signal }),
            () => searchSoundCloud(query, { signal })
        ]);
    }
};

/**
 * Helper to search by mode key with consistent signature.
 */
export async function searchByMode(mode, query, options = {}) {
    const provider = searchProvider[mode] || searchProvider.spotify;
    return provider(query, options);
}


