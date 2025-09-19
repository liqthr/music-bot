import config from './config.js';

// Spotify Web Playback SDK helper for full song playback

let player = null;
let deviceId = null;
let currentState = null;
let isSpotifyReady = false;

function createPlayer(token) {
  if (!window.Spotify) {
    console.error('Spotify SDK not loaded');
    return;
  }

  player = new Spotify.Player({
    name: 'Music Bot Web Player',
    getOAuthToken: cb => { cb(token); },
    volume: 0.5,
  });

  player.addListener('initialization_error', ({ message }) => {
    console.error('Spotify initialization_error:', message);
    showSpotifyError('Failed to initialize Spotify player');
  });

  player.addListener('authentication_error', ({ message }) => {
    console.error('Spotify authentication_error:', message);
    localStorage.removeItem('spotify_access_token');
    showSpotifyError('Spotify authentication failed. Please log in again.');
  });

  player.addListener('account_error', ({ message }) => {
    console.error('Spotify account_error:', message);
    showSpotifyError('Spotify account error. Premium subscription required for full playback.');
  });

  player.addListener('playback_error', ({ message }) => {
    console.error('Spotify playback_error:', message);
    showSpotifyError('Playback error occurred');
  });

  player.addListener('ready', ({ device_id }) => {
    console.log('Spotify Player ready with device id', device_id);
    deviceId = device_id;
    isSpotifyReady = true;
    
    // Dispatch event to notify other parts of the app
    window.dispatchEvent(new CustomEvent('spotify-player-ready', { detail: { deviceId: device_id } }));
    
    // Transfer playback to this device
    transferPlayback(deviceId).catch(e => console.warn('transferPlayback failed', e));
  });

  player.addListener('not_ready', ({ device_id }) => {
    console.log('Spotify device went offline', device_id);
    isSpotifyReady = false;
  });

  player.addListener('player_state_changed', state => {
    currentState = state;
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

// Play a song using Spotify Web Playback SDK
export async function playSong(uri) {
  const token = localStorage.getItem('spotify_access_token');
  if (!token) {
    showSpotifyError('No Spotify token available. Please log in.');
    return false;
  }
  
  if (!deviceId || !isSpotifyReady) {
    showSpotifyError('Spotify player not ready. Please wait or refresh the page.');
    return false;
  }

  try {
    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uris: [uri] })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    console.log('Successfully started playback for:', uri);
    return true;
  } catch (error) {
    console.error('Failed to play song:', error);
    showSpotifyError(`Failed to play song: ${error.message}`);
    return false;
  }
}

// Control playback
export async function togglePlayback() {
  if (!player) return false;
  
  try {
    await player.togglePlay();
    return true;
  } catch (error) {
    console.error('Failed to toggle playback:', error);
    return false;
  }
}

export async function nextTrack() {
  if (!player) return false;
  
  try {
    await player.nextTrack();
    return true;
  } catch (error) {
    console.error('Failed to skip to next track:', error);
    return false;
  }
}

export async function previousTrack() {
  if (!player) return false;
  
  try {
    await player.previousTrack();
    return true;
  } catch (error) {
    console.error('Failed to skip to previous track:', error);
    return false;
  }
}

export async function setVolume(volume) {
  if (!player) return false;
  
  try {
    await player.setVolume(volume);
    return true;
  } catch (error) {
    console.error('Failed to set volume:', error);
    return false;
  }
}

export async function seek(positionMs) {
  if (!player) return false;
  
  try {
    await player.seek(positionMs);
    return true;
  } catch (error) {
    console.error('Failed to seek:', error);
    return false;
  }
}

// Get current playback state
export function getCurrentState() {
  return currentState;
}

export function isPlayerReady() {
  return isSpotifyReady && deviceId !== null;
}

// Update UI based on player state
function updatePlayerState(state) {
  if (!state) {
    // No playback state - update UI to show stopped state
    updateUIForNoPlayback();
    return;
  }

  try {
    const track = state.track_window?.current_track;
    if (track) {
      console.log('Now playing:', track.name, 'by', track.artists.map(a => a.name).join(', '));
      
      // Update UI elements
      updateUIForSpotifyPlayback(track, state);
      
      // Dispatch event for other parts of the app to listen to
      window.dispatchEvent(new CustomEvent('spotify-track-changed', { 
        detail: { track, state } 
      }));
    }
  } catch (err) {
    console.error('Error updating player state', err);
  }
}

function updateUIForSpotifyPlayback(track, state) {
  // Update cover art
  const coverImg = document.getElementById('cover');
  const bgImg = document.getElementById('bg-img');
  if (track.album?.images?.[0]?.url) {
    const imageUrl = track.album.images[0].url;
    if (coverImg) coverImg.src = imageUrl;
    if (bgImg) bgImg.src = imageUrl;
  }

  // Update track info
  const titleEl = document.getElementById('music-title');
  const artistEl = document.getElementById('music-artist');
  if (titleEl) titleEl.textContent = track.name;
  if (artistEl) artistEl.textContent = track.artists.map(a => a.name).join(', ');

  // Update play/pause button
  const playBtn = document.getElementById('play');
  if (playBtn) {
    playBtn.className = state.paused ? 'fas fa-play play-button' : 'fas fa-pause play-button';
  }

  // Update progress
  updateProgress(state.position, state.duration);
}

function updateUIForNoPlayback() {
  const playBtn = document.getElementById('play');
  if (playBtn) {
    playBtn.className = 'fas fa-play play-button';
  }
  
  const currentTimeEl = document.getElementById('current-time');
  const progressEl = document.getElementById('progress');
  if (currentTimeEl) currentTimeEl.textContent = '0:00';
  if (progressEl) progressEl.style.width = '0%';
}

function updateProgress(position, duration) {
  const currentTimeEl = document.getElementById('current-time');
  const durationEl = document.getElementById('duration');
  const progressEl = document.getElementById('progress');

  if (currentTimeEl) currentTimeEl.textContent = formatTime(position / 1000);
  if (durationEl) durationEl.textContent = formatTime(duration / 1000);
  
  if (progressEl && duration > 0) {
    const progressPercent = (position / duration) * 100;
    progressEl.style.width = `${progressPercent}%`;
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function showSpotifyError(message) {
  console.error('Spotify Error:', message);
  
  // Show error in UI
  const errorEl = document.createElement('div');
  errorEl.className = 'spotify-error';
  errorEl.textContent = message;
  errorEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff4444;
    color: white;
    padding: 10px 15px;
    border-radius: 5px;
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(errorEl);
  
  // Remove after 5 seconds
  setTimeout(() => {
    if (errorEl.parentNode) {
      errorEl.remove();
    }
  }, 5000);
}

export { player, deviceId, isSpotifyReady };
