import config from './config.js';

// Minimal, robust Spotify Web Playback SDK helper

let player = null;
let deviceId = null;

function createPlayer(token) {
  if (!window.Spotify) {
    console.error('Spotify SDK not loaded');
    return;
  }

  player = new Spotify.Player({
    name: 'Web Music Player',
    getOAuthToken: cb => { cb(token); },
    volume: 0.5,
  });

  player.addListener('initialization_error', ({ message }) => {
    console.error('Spotify initialization_error:', message);
  });

  player.addListener('authentication_error', ({ message }) => {
    console.error('Spotify authentication_error:', message);
    // cleanup token if invalid
    localStorage.removeItem('spotify_access_token');
  });

  player.addListener('account_error', ({ message }) => {
    console.error('Spotify account_error:', message);
  });

  player.addListener('playback_error', ({ message }) => {
    console.error('Spotify playback_error:', message);
  });

  player.addListener('ready', ({ device_id }) => {
    console.log('Spotify Player ready with device id', device_id);
    deviceId = device_id;
    transferPlayback(deviceId).catch(e => console.warn('transferPlayback failed', e));
  });

  player.addListener('not_ready', ({ device_id }) => {
    console.log('Spotify device went offline', device_id);
  });

  player.addListener('player_state_changed', state => {
    updatePlayerState(state);
  });

  player.connect().catch(err => console.error('player.connect() failed', err));
}

window.addEventListener('spotify-sdk-ready', async () => {
  // Called when the SDK script loads and sets the global callback (defined in index.html)
  const token = localStorage.getItem('spotify_access_token');
  if (!token) {
    console.warn('No Spotify access token in localStorage — player will not initialize until logged in');
    return;
  }
  try {
    createPlayer(token);
  } catch (err) {
    console.error('Failed to create Spotify player:', err);
  }
});

export async function transferPlayback(targetDeviceId) {
  if (!targetDeviceId) return;
  const token = localStorage.getItem('spotify_access_token');
  if (!token) throw new Error('No token for transferPlayback');
  await fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ device_ids: [targetDeviceId], play: false })
  });
}

export async function playSong(uri) {
  const token = localStorage.getItem('spotify_access_token');
  if (!token) throw new Error('No token to play song');
  if (!deviceId) throw new Error('No Spotify deviceId available');
  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ uris: [uri] })
  });
}

function updatePlayerState(state) {
  // Minimal handler — update UI as needed.
  if (!state) return;
  try {
    const track = state.track_window && state.track_window.current_track;
    if (track) {
      console.log('Now playing:', track.name, 'by', track.artists.map(a => a.name).join(', '));
      // TODO: update DOM elements with track info
    }
  } catch (err) {
    console.error('Error updating player state', err);
  }
}

export { player, deviceId };
