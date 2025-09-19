import config from './config.js';

let player;
let deviceId;

window.onSpotifyWebPlaybackSDKReady = () => {
    const token = localStorage.getItem('spotify_access_token');
    if (!token) {
        console.error('No access token available');
        return;
    }

    player = new Spotify.Player({
        name: 'Web Music Player',
        getOAuthToken: cb => { cb(token); },
        volume: 0.5
    });

    // Error handling
    player.addListener('initialization_error', ({ message }) => {
        console.error('Failed to initialize:', message);
    });

    player.addListener('authentication_error', ({ message }) => {
        console.error('Failed to authenticate:', message);
        localStorage.removeItem('spotify_access_token');
        window.location.href = '/';
    });

    player.addListener('account_error', ({ message }) => {
        console.error('Failed to validate Spotify account:', message);
    });

    player.addListener('playback_error', ({ message }) => {
        console.error('Failed to perform playback:', message);
    });

    // Ready
    player.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID:', device_id);
        deviceId = device_id;
        // Transfer playback to this device
        transferPlayback(device_id);
    });

    // Connect to the player
    player.connect();
};

// Connect script in your HTML
export function initializeSpotifyPlayer() {
    if (!window.Spotify) {
        const script = document.createElement('script');
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        document.head.appendChild(script);
    }
}

export async function transferPlayback(deviceId) {
    try {
        await fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('spotify_access_token')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                device_ids: [deviceId],
                play: false,
            }),
        });
    } catch (error) {
        console.error('Error transferring playback:', error);
    }
}

export async function playSong(uri) {
    if (!player || !deviceId) {
        console.error('Player not ready');
        return;
    }

    try {
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('spotify_access_token')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                uris: [uri]
            })
        });
    } catch (error) {
        console.error('Error playing track:', error);
    }
}

// Update player state
function updatePlayerState(state) {
    // Update UI based on state
    const {
        position,
        duration,
        track_window: { current_track }
    } = state;
    // Update your existing player UI
    document.getElementById('music-title').textContent = current_track.name;
    document.getElementById('music-artist').textContent = current_track.artists[0].name;
    document.getElementById('cover').src = current_track.album.images[0].url;
    document.getElementById('bg-img').src = current_track.album.images[0].url;
    
    // Update progress
    document.getElementById('current-time').textContent = formatTime(position);
    document.getElementById('duration').textContent = formatTime(duration);
    document.getElementById('progress').style.width = `${(position / duration) * 100}%`;
}

export { player, deviceId };
