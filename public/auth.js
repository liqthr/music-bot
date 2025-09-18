import config from './config.js';

export function initiateSpotifyLogin() {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${config.spotifyClientId}&response_type=token&redirect_uri=${encodeURIComponent(config.spotifyRedirectUri)}&scope=${encodeURIComponent(config.spotifyScopes)}`;
    window.location.href = authUrl;
}

export function handleAuthCallback() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    
    if (accessToken) {
        localStorage.setItem('spotify_access_token', accessToken);
        window.location.href = '/'; // Redirect to main page
    } else {
        console.error('No access token received');
        window.location.href = '/'; // Redirect to main page
    }
}