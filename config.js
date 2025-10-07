export default {
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    soundCloudClientId: process.env.SOUNDCLOUD_CLIENT_ID,
    baseUrl: 'https://music-bot-brown-nine.vercel.app/'
  };
  
  export function switchMode(mode) {
    const platformLogo = document.getElementById('platform-logo');
    const platformText = document.getElementById('platform-text');
    const searchBar = document.getElementById('search');
  
    if (mode === 'spotify') {
      platformLogo.src = 'spotify-logo.png';
      platformText.textContent = 'Spotify Search';
      searchBar.className = 'spotify';
      document.getElementById('spotify-logo').classList.add('active');
      document.getElementById('soundcloud-logo').classList.remove('active');
    } else if (mode === 'soundcloud') {
      platformLogo.src = 'soundcloud-logo.png';
      platformText.textContent = 'SoundCloud Search';
      searchBar.className = 'soundcloud';
      document.getElementById('spotify-logo').classList.remove('active');
      document.getElementById('soundcloud-logo').classList.add('active');
    }
  
    document.getElementById('search-results').innerHTML = '';
    searchBar.value = '';
  }
  
  export const myConfigValue = "someValue";
  
  export function myFunction() {
    // Your function implementation here
  }
  