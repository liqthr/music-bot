// config.js - Client-side configuration

const config = {
    spotifyClientId: 'YOUR_SPOTIFY_CLIENT_ID', // Will be replaced by server-side env variable
    spotifyClientSecret: 'YOUR_SPOTIFY_CLIENT_SECRET', // Will be replaced by server-side env variable
    soundCloudClientId: 'YOUR_SOUNDCLOUD_CLIENT_ID', // Will be replaced by server-side env variable
    baseUrl: 'http://localhost:3000',
    defaultArtwork: 'images/default.jpg',
    debounceTime: 500, // ms to wait before searching after typing
  };
  
  /**
   * Switch between music platforms (Spotify/SoundCloud)
   * @param {string} mode - The platform to switch to ('spotify' or 'soundcloud')
   */
  export function switchMode(mode) {
    if (mode !== 'spotify' && mode !== 'soundcloud') {
      console.error('Invalid mode:', mode);
      return;
    }
    
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
  
    // Clear any previous search results
    document.getElementById('search-results').innerHTML = '';
    
    // Don't clear search text - this allows seamless switching between platforms
    // searchBar.value = '';
    
    // Trigger a CustomEvent that other modules can listen for
    const event = new CustomEvent('platformChanged', { detail: { mode } });
    document.dispatchEvent(event);
  }
  
  /**
   * Format time in minutes and seconds
   * @param {number} time - Time in seconds
   * @returns {string} - Formatted time (MM:SS)
   */
  export function formatTime(time) {
    if (!time || isNaN(time) || time < 0) return '00:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    
    return `${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
  }
  
  /**
   * Simple debounce function for search input
   * @param {Function} func - The function to debounce
   * @param {number} wait - The debounce delay in milliseconds
   * @returns {Function} - The debounced function
   */
  export function debounce(func, wait = config.debounceTime) {
    let timeout;
    
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }
  
  /**
   * Display an error message to the user
   * @param {string} message - Error message to display
   * @param {string} elementId - ID of element to display error in
   */
  export function showError(message, elementId = 'search-results') {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = `<div class="error">${message}</div>`;
    } else {
      console.error(message);
    }
  }
  
  export default config;