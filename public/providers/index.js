// Unified search provider facade with resilient fallbacks per mode.
// This concentrates cross-provider fallback logic in one place so the UI can
// call a single function regardless of the selected mode.

import { searchSpotify } from '../spotifySearch.js';
import { searchSoundCloud } from '../soundcloudSearch.js';
import { searchYouTube } from '../youtubeSearch.js';

/**
 * Attempt a list of async search functions in order until one returns results.
 * Ensures we always try multiple backends before surfacing an empty result.
<<<<<<< HEAD
 * 
 * Important: Each fallback provider gets a fresh signal or no signal to prevent
 * aborted signals from causing all fallbacks to fail immediately. Only the
 * primary provider (first in the chain) respects the original abort signal.
 */
async function tryInOrder(tasks, primarySignal = null) {
    for (let i = 0; i < tasks.length; i++) {
        try {
            // Only pass signal to the first (primary) provider
            // Fallback providers run without signal to ensure independence
            const taskOptions = i === 0 && primarySignal ? { signal: primarySignal } : {};
            const results = await tasks[i](taskOptions);
            if (Array.isArray(results) && results.length > 0) return results;
        } catch (err) {
            // If the error is an AbortError and we're on the primary provider,
            // re-throw it so the caller can handle cancellation properly
            if (i === 0 && err.name === 'AbortError') {
                throw err;
            }
            // Swallow fallback errors and continue to next provider
            console.warn(`Provider attempt ${i + 1} failed:`, err?.message || err);
=======
 */
async function tryInOrder(tasks) {
    for (const task of tasks) {
        try {
            const results = await task();
            if (Array.isArray(results) && results.length > 0) return results;
        } catch (err) {
            // Swallow and continue to next provider; UI will show message if all fail
            console.warn('Provider attempt failed:', err?.message || err);
>>>>>>> main
        }
    }
    return [];
}

/**
 * Provider-specific orchestrators with built-in fallback order.
 * - spotify mode: Spotify → SoundCloud → YouTube
 * - soundcloud mode: SoundCloud → Spotify → YouTube
 * - youtube mode: YouTube → Spotify → SoundCloud
<<<<<<< HEAD
 * 
 * Each fallback provider runs independently without the abort signal to ensure
 * resilience - if one provider times out or is aborted, others can still succeed.
=======
>>>>>>> main
 */
export const searchProvider = {
    async spotify(query, options = {}) {
        const { signal } = options;
        return await tryInOrder([
<<<<<<< HEAD
            (opts) => searchSpotify(query, opts),
            (opts) => searchSoundCloud(query, opts),
            (opts) => searchYouTube(query, opts)
        ], signal);
=======
            () => searchSpotify(query, { signal }),
            () => searchSoundCloud(query, { signal }),
            () => searchYouTube(query, { signal })
        ]);
>>>>>>> main
    },
    async soundcloud(query, options = {}) {
        const { signal } = options;
        return await tryInOrder([
<<<<<<< HEAD
            (opts) => searchSoundCloud(query, opts),
            (opts) => searchSpotify(query, opts),
            (opts) => searchYouTube(query, opts)
        ], signal);
=======
            () => searchSoundCloud(query, { signal }),
            () => searchSpotify(query, { signal }),
            () => searchYouTube(query, { signal })
        ]);
>>>>>>> main
    },
    async youtube(query, options = {}) {
        const { signal } = options;
        return await tryInOrder([
<<<<<<< HEAD
            (opts) => searchYouTube(query, opts),
            (opts) => searchSpotify(query, opts),
            (opts) => searchSoundCloud(query, opts)
        ], signal);
=======
            () => searchYouTube(query, { signal }),
            () => searchSpotify(query, { signal }),
            () => searchSoundCloud(query, { signal })
        ]);
>>>>>>> main
    }
};

/**
 * Helper to search by mode key with consistent signature.
 */
export async function searchByMode(mode, query, options = {}) {
    const provider = searchProvider[mode] || searchProvider.spotify;
    return provider(query, options);
}


