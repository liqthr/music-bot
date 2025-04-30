// youtubeSearch.js - YouTube search and player integration
import config from './config.js';

const baseUrl = config.baseUrl || 'http://localhost:3000';

/**
 * Search YouTube for a track matching Spotify metadata
 * @param {Object} spotifyTrack - Track object from Spotify search
 * @returns {Promise<Object>} - YouTube track object with playable URL
 */
export async function findOnYouTube(spotifyTrack) {
    if (!spotifyTrack) {
        console.error('No track provided to search on YouTube');
        return null;
    }

    const artistName = spotifyTrack.artists?.[0]?.name || '';
    const trackName = spotifyTrack.name || '';
    const searchQuery = `${artistName} ${trackName} audio`;

    try {
        console.log(`Searching YouTube for: ${searchQuery}`);
        // Use our backend as a proxy to make YouTube API calls
        const response = await fetch(
            `${baseUrl}/youtube-search?q=${encodeURIComponent(searchQuery)}`,
            {
                headers: {
                    'Cache-Control': 'no-cache'
                }
            }
        );

        if (!response.ok) {
            throw new Error(`YouTube search failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('YouTube search results:', data.items?.length || 0);

        if (!data.items || data.items.length === 0) {
            console.warn('No YouTube results found');
            return null;
        }

        // Filter results to find best match (official audio)
        const bestMatch = findBestMatch(data.items, spotifyTrack);
        if (!bestMatch) {
            console.warn('No suitable YouTube match found');
            return null;
        }

        return {
            id: bestMatch.id.videoId,
            title: bestMatch.snippet.title,
            channelTitle: bestMatch.snippet.channelTitle,
            thumbnailUrl: bestMatch.snippet.thumbnails.high?.url || bestMatch.snippet.thumbnails.default?.url,
            duration: null, // We'll get this from another API call if needed
            youtubeUrl: `https://www.youtube.com/watch?v=${bestMatch.id.videoId}`,
            // Keep original Spotify metadata for display
            originalMetadata: {
                name: spotifyTrack.name,
                artist: spotifyTrack.artists?.[0]?.name || 'Unknown Artist',
                album: spotifyTrack.album
            }
        };
    } catch (error) {
        console.error('YouTube search error:', error);
        return null;
    }
}

/**
 * Find the best match from YouTube results based on Spotify metadata
 * @param {Array} items - YouTube search results
 * @param {Object} spotifyTrack - Original Spotify track
 * @returns {Object} - Best matching YouTube result
 */
function findBestMatch(items, spotifyTrack) {
    if (!items || items.length === 0) return null;

    const artistName = spotifyTrack.artists?.[0]?.name?.toLowerCase() || '';
    const trackName = spotifyTrack.name?.toLowerCase() || '';
    
    // Scoring system for matches
    const scoredItems = items.map(item => {
        const title = item.snippet.title.toLowerCase();
        const channel = item.snippet.channelTitle.toLowerCase();
        let score = 0;
        
        // Check if title contains both artist and track name
        if (title.includes(artistName) && title.includes(trackName)) {
            score += 10;
        } else if (title.includes(trackName)) {
            score += 5;
        }
        
        // Prefer official artist channels
        if (channel.includes(artistName) || 
            channel.includes('vevo') || 
            channel.includes('official')) {
            score += 5;
        }
        
        // Prefer audio versions over music videos
        if (title.includes('audio') || 
            title.includes('official audio') || 
            title.includes('lyric')) {
            score += 3;
        }
        
        // Avoid music videos and live versions
        if (title.includes('official video') || 
            title.includes('music video') || 
            title.includes('live')) {
            score -= 2;
        }
        
        return { ...item, score };
    });
    
    // Sort by score and return the best match
    scoredItems.sort((a, b) => b.score - a.score);
    return scoredItems[0];
}

// YouTube Player state
let youtubePlayer = null;
let isYouTubePlayerReady = false;
let pendingVideoId = null;

/**
 * Initialize YouTube Player API
 * @returns {Promise} - Resolves when player is ready
 */
export function initYouTubePlayer() {
    return new Promise((resolve) => {
        // Check if YouTube IFrame API is already loaded
        if (window.YT && window.YT.Player) {
            createYouTubePlayer();
            resolve();
        } else {
            // Add YouTube API script
            window.onYouTubeIframeAPIReady = function() {
                createYouTubePlayer();
                resolve();
            };
            
            // Add script tag if not already present
            if (!document.getElementById('youtube-api')) {
                const tag = document.createElement('script');
                tag.id = 'youtube-api';
                tag.src = 'https://www.youtube.com/iframe_api';
                const firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            }
        }
    });
}

/**
 * Create YouTube player instance
 */
function createYouTubePlayer() {
    // Create a hidden player
    const playerContainer = document.getElementById('player-container');
    if (!playerContainer) {
        console.error('YouTube player container not found');
        return;
    }
    
    youtubePlayer = new YT.Player('player-container', {
        height: '0',
        width: '0',
        playerVars: {
            'autoplay': 0,
            'controls': 0,
            'disablekb': 1,
            'enablejsapi': 1,
            'iv_load_policy': 3, // Hide annotations
            'modestbranding': 1,
            'rel': 0, // Don't show related videos
            'showinfo': 0,
            'fs': 0 // No fullscreen button
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
}

/**
 * YouTube player ready handler
 */
function onPlayerReady(event) {
    console.log('YouTube player ready');
    isYouTubePlayerReady = true;
    
    // If there's a pending video, play it
    if (pendingVideoId) {
        playYouTubeVideo(pendingVideoId);
        pendingVideoId = null;
    }
}

/**
 * YouTube player state change handler
 */
function onPlayerStateChange(event) {
    // Emit custom events that our player can listen to
    switch(event.data) {
        case YT.PlayerState.PLAYING:
            document.dispatchEvent(new CustomEvent('youtube:playing'));
            break;
        case YT.PlayerState.PAUSED:
            document.dispatchEvent(new CustomEvent('youtube:paused'));
            break;
        case YT.PlayerState.ENDED:
            document.dispatchEvent(new CustomEvent('youtube:ended'));
            break;
    }
}

/**
 * YouTube player error handler
 */
function onPlayerError(event) {
    console.error('YouTube player error:', event.data);
    document.dispatchEvent(new CustomEvent('youtube:error', { detail: event.data }));
}

/**
 * Play a YouTube video by ID
 * @param {string} videoId - YouTube video ID
 */
export function playYouTubeVideo(videoId) {
    if (!videoId) {
        console.error('No video ID provided');
        return;
    }
    
    if (isYouTubePlayerReady && youtubePlayer) {
        youtubePlayer.loadVideoById(videoId);
        youtubePlayer.playVideo();
    } else {
        // Store ID to play when player is ready
        pendingVideoId = videoId;
        initYouTubePlayer();
    }
}

/**
 * Control YouTube player
 */
export function pauseYouTubeVideo() {
    if (isYouTubePlayerReady && youtubePlayer) {
        youtubePlayer.pauseVideo();
    }
}

export function resumeYouTubeVideo() {
    if (isYouTubePlayerReady && youtubePlayer) {
        youtubePlayer.playVideo();
    }
}

export function setYouTubeVolume(volume) {
    if (isYouTubePlayerReady && youtubePlayer) {
        // YouTube volume is 0-100
        youtubePlayer.setVolume(volume * 100);
    }
}

export function getYouTubeCurrentTime() {
    if (isYouTubePlayerReady && youtubePlayer) {
        return youtubePlayer.getCurrentTime();
    }
    return 0;
}

export function getYouTubeDuration() {
    if (isYouTubePlayerReady && youtubePlayer) {
        return youtubePlayer.getDuration();
    }
    return 0;
}

export function seekYouTubeVideo(seconds) {
    if (isYouTubePlayerReady && youtubePlayer) {
        youtubePlayer.seekTo(seconds, true);
    }
}