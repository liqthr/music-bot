import config from './config.js';

let player;
let deviceId;

export function initializePlayer() {
    window.onSpotifyWebPlaybackSDKReady = () => {
        const token = localStorage.getItem('spotify_access_token');
        
        if (!token) {
            console.error('No access token found');
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
            // Redirect to login if token is invalid
            window.location.href = '/login.html';
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

        // Not Ready
        player.addListener('not_ready', ({ device_id }) => {
            console.log('Device ID has gone offline:', device_id);
        });

        // Connect to the player!
        player.connect();
    };
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
                device_ids: [deviceId],           device_ids: [deviceId],
                play: false,               play: false,
            }),            }),
        });
    } catch (error) {
        console.error('Error transferring playback:', error);ansferring playback:', error);
    }
}

export async function playSong(uri) {
    if (!player || !deviceId) {r || !deviceId) {
        console.error('Player not ready');        console.error('Player not ready');
        return;
    }

    try {
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {iceId}`, {
            method: 'PUT',        method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('spotify_access_token')}`,_token')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({           body: JSON.stringify({
                uris: [uri]                uris: [uri]
            })
        });
    } catch (error) {
        console.error('Error playing track:', error);.error('Error playing track:', error);
    }
}}

// Update player stateeId };function updatePlayerState(state) {    // Update UI based on state    const {        position,        duration,        track_window: { current_track }    } = state;    // Update your existing player UI    document.getElementById('music-title').textContent = current_track.name;    document.getElementById('music-artist').textContent = current_track.artists[0].name;
    document.getElementById('cover').src = current_track.album.images[0].url;
    document.getElementById('bg-img').src = current_track.album.images[0].url;
    
    // Update progress
    document.getElementById('current-time').textContent = formatTime(position);
    document.getElementById('duration').textContent = formatTime(duration);
    document.getElementById('progress').style.width = `${(position / duration) * 100}%`;
}

export { player, deviceId };