import config from './config.js';

export function initiateSpotifyLogin() {
    try {
        const authUrl = `https://accounts.spotify.com/authorize?client_id=${config.spotifyClientId}&response_type=token&redirect_uri=${encodeURIComponent(config.spotifyRedirectUri)}&scope=${encodeURIComponent(config.spotifyScopes)}`;
        window.location.href = authUrl;
    } catch (error) {
        console.error('Login initialization failed:', error);
    }
}

export function handleAuthCallback() {
    try {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const error = params.get('error');
        
        if (error) {
            console.error('Authentication error:', error);
            window.location.href = '/?error=' + encodeURIComponent(error);
            return;
        }
        
        if (accessToken) {
            localStorage.setItem('spotify_access_token', accessToken);
            window.location.href = '/';
        } else {
            console.error('No access token received');
            window.location.href = '/?error=no_token';
        }
    } catch (error) {
        console.error('Auth callback error:', error);
        window.location.href = '/?error=callback_failed';
    }
}

export function checkAuth() {
    const token = localStorage.getItem('spotify_access_token');
    return !!token;
}