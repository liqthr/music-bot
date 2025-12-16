pm
let _clientConfig = null;
async function loadClientConfig() {
  if (_clientConfig) return _clientConfig;
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('Failed to load client config');
  _clientConfig = await res.json();
  return _clientConfig;
}

export async function initiateSpotifyLogin() {
  try {
    const cfg = await loadClientConfig();
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${cfg.spotifyClientId}&response_type=token&redirect_uri=${encodeURIComponent(cfg.spotifyRedirectUri)}&scope=${encodeURIComponent(cfg.spotifyScopes)}`;
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
    const expiresIn = params.get('expires_in');

    if (error) {
      console.error('Authentication error:', error);
      window.location.href = '/?error=' + encodeURIComponent(error);
      return;
    }

    if (accessToken) {
      localStorage.setItem('spotify_access_token', accessToken);
      if (expiresIn) {
        const expiresAt = Date.now() + parseInt(expiresIn, 10) * 1000;
        localStorage.setItem('spotify_token_expires_at', String(expiresAt));
      }
      window.location.href = '/';
    } else {
      console.error('No access token received');
      window.location.href = '/?error=no_token';
    }
  } catch (err) {
    console.error('Auth callback error:', err);
    window.location.href = '/?error=callback_failed';
  }
}

export function checkAuth() {
  const token = localStorage.getItem('spotify_access_token');
  const expiresAt = localStorage.getItem('spotify_token_expires_at');
  if (!token) return false;
  if (expiresAt && Date.now() > Number(expiresAt)) {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_token_expires_at');
    return false;
  }
  return true;
}