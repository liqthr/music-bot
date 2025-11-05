import config from './config.js';
import { searchByMode } from './providers/index.js';
import { searchYouTube, findOnYouTube, initYouTubePlayer, playYouTubeVideo } from './youtubeSearch.js';
import { initiateSpotifyLogin, checkAuth, handleAuthCallback } from './auth.js';

// Import the Spotify player functions
import { 
    playSong, 
    togglePlayback, 
    nextTrack, 
    previousTrack, 
    setVolume, 
    seek,
    isPlayerReady,
    getCurrentState 
} from './spotifyPlayer.js';

let currentMode = 'spotify';
let currentSearchController = null; // AbortController for in-flight searches

// Updated switchMode function with better platform handling
function switchMode(mode) {
    currentMode = mode;
    const platformLogo = document.getElementById('platform-logo');
    const platformText = document.getElementById('platform-text');
    const searchBar = document.getElementById('search');

    if (mode === 'spotify') {
        if (platformLogo) platformLogo.src = 'spotify-logo.png';
        if (platformText) platformText.textContent = 'Spotify Search';
        // keep base styling and toggle a mode modifier class
        if (searchBar) {
            searchBar.classList.remove('mode-soundcloud', 'mode-youtube');
            searchBar.classList.add('mode-spotify');
        }
        document.getElementById('spotify-logo').classList.add('active');
        document.getElementById('soundcloud-logo').classList.remove('active');
        const ytBtn = document.getElementById('youtube-logo');
        if (ytBtn) ytBtn.classList.remove('active');
    } else if (mode === 'soundcloud') {
        if (platformLogo) platformLogo.src = 'soundcloud-logo.png';
        if (platformText) platformText.textContent = 'SoundCloud Search';
        if (searchBar) {
            searchBar.classList.remove('mode-spotify', 'mode-youtube');
            searchBar.classList.add('mode-soundcloud');
        }
        document.getElementById('spotify-logo').classList.remove('active');
        document.getElementById('soundcloud-logo').classList.add('active');
        const ytBtn = document.getElementById('youtube-logo');
        if (ytBtn) ytBtn.classList.remove('active');
    } else if (mode === 'youtube') {
        if (platformText) platformText.textContent = 'YouTube Search';
        if (searchBar) {
            searchBar.classList.remove('mode-spotify', 'mode-soundcloud');
            searchBar.classList.add('mode-youtube');
        }
        document.getElementById('spotify-logo').classList.remove('active');
        document.getElementById('soundcloud-logo').classList.remove('active');
        const ytBtn = document.getElementById('youtube-logo');
        if (ytBtn) ytBtn.classList.add('active');
    }

    document.getElementById('search-results').innerHTML = '';
    searchBar.value = '';
}

// Element references
const image = document.getElementById('cover'),
    title = document.getElementById('music-title'),
    artist = document.getElementById('music-artist'),
    currentTimeEl = document.getElementById('current-time'),
    durationEl = document.getElementById('duration'),
    progress = document.getElementById('progress'),
    playerProgress = document.getElementById('player-progress'),
    prevBtn = document.getElementById('prev'),
    nextBtn = document.getElementById('next'),
    playBtn = document.getElementById('play'),
    background = document.getElementById('bg-img'),
    searchInput = document.getElementById('search'),
    searchResults = document.getElementById('search-results'),
    volumeSlider = document.getElementById('volume-slider'),
    volumeIcon = document.querySelector('.volume-icon'),
    queueContainer = document.getElementById('queue-container'),
    upNextContainer = document.getElementById('up-next'),
    spotifyLoginBtn = document.getElementById('spotify-login-btn'),
    spotifyStatus = document.getElementById('spotify-status');

// State management
const music = new Audio();
let songs = [];
let musicIndex = 0;
let isPlaying = false;
let currentDuration = 0;
let progressInterval = null;
let queue = [];

// Set initial volume
music.volume = volumeSlider ? volumeSlider.value : 1;

// Updated performSearch function with improved error handling and platform support
async function performSearch(query) {
    if (!query || query.trim() === '') {
        searchResults.innerHTML = '';
        searchResults.style.display = 'none';
        return;
    }
    
    searchResults.innerHTML = '<p class="loading">Searching...</p>';

    try {
        // Abort any previous search to avoid race conditions
        if (currentSearchController) currentSearchController.abort();
        currentSearchController = new AbortController();
        const signal = currentSearchController.signal;
        // Unified provider search with internal redundancy per mode
        let results = [];
        let searchError = null;
        try {
            results = await searchByMode(currentMode, query, { signal });
        } catch (error) {
            searchError = error?.message || 'Search failed';
        }

        // Clear previous results
        searchResults.innerHTML = '';
        
        // Show fallback notice if applicable
        // The unified provider already attempted fallbacks; we no longer show a special notice
        if (false) {
            const fallbackNotice = document.createElement('p');
            fallbackNotice.className = 'notice';
            fallbackNotice.innerText = currentMode === 'spotify' 
                ? 'Showing SoundCloud results instead.' 
                : 'Showing Spotify results instead.';
            searchResults.appendChild(fallbackNotice);
        }

        // Append search results
        if (results && results.length > 0) {
            const fragment = document.createDocumentFragment();
            results.forEach((song, index) => {
                const songElement = document.createElement('div');
                songElement.classList.add('result-item');

                const img = document.createElement('img');
                const imageUrl = song?.album?.images?.[0]?.url || 'images/default.jpg';
                img.src = imageUrl;
                img.alt = song.name || 'Track artwork';

                const info = document.createElement('div');
                info.className = 'song-info';
                const titleEl = document.createElement('div');
                titleEl.className = 'song-title';
                titleEl.textContent = song.name || 'Unknown Title';
                const artistEl = document.createElement('div');
                artistEl.className = 'song-artist';
                artistEl.textContent = (song.artists && song.artists[0] ? song.artists[0].name : 'Unknown Artist');
                const badge = document.createElement('span');
                const platformClass = song.platform || 'spotify';
                badge.className = `platform-badge ${platformClass}`;
                badge.textContent = platformClass;
                artistEl.appendChild(badge);
                info.appendChild(titleEl);
                info.appendChild(artistEl);

                const actions = document.createElement('div');
                actions.className = 'song-actions';
                const playBtnEl = document.createElement('button');
                playBtnEl.className = 'play-now';
                playBtnEl.textContent = 'Play';
                const queueBtnEl = document.createElement('button');
                queueBtnEl.className = 'add-to-queue';
                queueBtnEl.textContent = '+ Queue';
                actions.appendChild(playBtnEl);
                actions.appendChild(queueBtnEl);

                songElement.appendChild(img);
                songElement.appendChild(info);
                songElement.appendChild(actions);

                playBtnEl.addEventListener('click', () => loadSong(index, results));
                queueBtnEl.addEventListener('click', () => addToQueue(results[index]));

                fragment.appendChild(songElement);
            });
            searchResults.appendChild(fragment);
            searchResults.style.display = 'block';
        } else if (searchError) {
            // Show error message if both primary and fallback search failed
            searchResults.innerHTML = `<p class="error">${searchError}</p>`;
            searchResults.style.display = 'block';
        } else {
            searchResults.innerHTML = '<p>No results found.</p>';
            searchResults.style.display = 'block';
        }
    } catch (error) {
        console.error("Search error:", error);
        searchResults.innerHTML = '<p class="error">Error occurred. Please try again.</p>';
    }
}

// Enhanced loadSong function with Spotify Web Playback SDK support
async function loadSong(index, searchResults) {
    if (!searchResults || !searchResults[index]) {
        console.error("Invalid song data");
        return;
    }

    const song = searchResults[index];
    console.log('Loading song:', song);

    // Update current song info
    songs = searchResults;
    musicIndex = index;

    // Check if this is a Spotify track with full playback capability
    if (song.platform === 'spotify' && song.uri) {
        console.log('Using Spotify Web Playback SDK for:', song.name);
        
        // Check if Spotify player is ready
        if (!isPlayerReady()) {
            displayErrorMessage("Spotify player not ready. Please wait or log in to Spotify.");
            return;
        }

        // Stop any current HTML5 audio playback
        if (music.src) {
            music.pause();
            music.src = '';
            clearInterval(progressInterval);
        }

        // Update UI immediately (Spotify SDK will update it again when playback starts)
        updateUIForSong(song);

        // Play using Spotify Web Playback SDK
        const success = await playSong(song.uri);
        if (success) {
            isPlaying = true;
            playBtn.className = 'fas fa-pause play-button';
            console.log('Successfully started Spotify playback');
        } else {
            console.log('Spotify playback failed, attempting YouTube fallback...');
            try {
                const yt = await findOnYouTube(song);
                if (yt && yt.id) {
                    // Update UI for YouTube metadata
                    updateUIForSong({
                        name: yt.title,
                        artists: [{ name: yt.channelTitle }],
                        album: { images: [{ url: yt.thumbnailUrl }] },
                        platform: 'youtube'
                    });
                    await initYouTubePlayer();
                    playYouTubeVideo(yt.id);
                    return;
                }
            } catch (e) {
                console.warn('YouTube fallback failed', e);
            }
            // Final fallback
            if (song.preview_url) {
                loadPreviewTrack(song);
            } else {
                displayErrorMessage("Unable to play this track. No preview available.");
            }
        }
    } else if (song.platform === 'youtube' && song.videoId) {
        // Play YouTube video directly
        updateUIForSong(song);
        await initYouTubePlayer();
        playYouTubeVideo(song.videoId);
    } else {
        // Use HTML5 audio for non-Spotify tracks or tracks without URI
        console.log('Using HTML5 audio for:', song.name);
        loadPreviewTrack(song);
    }
}

// Load track using HTML5 audio (for previews)
function loadPreviewTrack(song) {
    // Check if preview_url exists
    if (!song.preview_url) {
        console.warn("No preview URL available for this song");
        displayErrorMessage("No preview available for this song");
        
        // Try to find another playable song
        let foundPlayable = false;
        for (let i = 0; i < songs.length; i++) {
            if (songs[i].preview_url || (songs[i].platform === 'spotify' && songs[i].uri)) {
                console.log(`Found playable alternative at index ${i}`);
                loadSong(i, songs);
                foundPlayable = true;
                break;
            }
        }
        
        if (!foundPlayable) {
            console.error("No playable songs found in results");
        }
        
        return;
    }

    try {
        // Reset the audio element before setting a new source
        music.pause();
        music.currentTime = 0;
        music.src = '';
        
        // Set the new source
        music.src = song.preview_url;
        
        // Update UI
        updateUIForSong(song);

        // Set up duration once the metadata is loaded
        music.addEventListener('loadedmetadata', () => {
            currentDuration = music.duration;
            durationEl.textContent = formatTime(currentDuration);
        });
        
        updateQueueDisplay();
        playMusic();
    } catch (error) {
        console.error("Error loading song:", error);
        displayErrorMessage("Failed to load song");
    }
}

// Update UI elements for a song
function updateUIForSong(song) {
    // Handle artwork safely
    if (song.album && song.album.images && song.album.images[0]) {
        image.src = song.album.images[0].url;
        background.src = song.album.images[0].url;
    } else {
        image.src = 'images/default.jpg';
        background.src = 'images/default.jpg';
    }
    
    // Set track info
    title.innerText = song.name || 'Unknown Title';
    
    // Clear previous artist content and set new artist
    artist.innerHTML = '';
    const artistName = song.artists && song.artists[0] ? song.artists[0].name : 'Unknown Artist';
    artist.innerText = artistName;

    // Add platform indicator
    const platformIndicator = document.createElement('span');
    const platform = song.platform || 'spotify';
    platformIndicator.className = `platform-indicator ${platform}`;
    platformIndicator.textContent = platform === 'soundcloud' ? 'SoundCloud' : (platform === 'youtube' ? 'YouTube' : 'Spotify');
    platformIndicator.style.cssText = `
        margin-left: 10px;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 0.8em;
        background: ${platform === 'soundcloud' ? '#ff5500' : (platform === 'youtube' ? '#ff0000' : '#1db954')};
        color: white;
    `;
    artist.appendChild(platformIndicator);
}

// Enhanced playMusic function with better error handling
function playMusic() {
    isPlaying = true;
    playBtn.classList.replace('fa-play', 'fa-pause');
    image.classList.add('active');
    
    // Play the audio with proper error handling
    const playPromise = music.play();
    
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.error("Playback error:", error);
            
            // Handle user interaction requirement for autoplay
            if (error.name === 'NotAllowedError') {
                displayErrorMessage("Playback requires user interaction - click Play again");
            } else {
                displayErrorMessage("Unable to play this track: " + error.message);
            }
            
            pauseMusic();
        });
    }
    
    startProgressInterval();
}

// Pause Music
function pauseMusic() {
    isPlaying = false;
    playBtn.classList.replace('fa-pause', 'fa-play');
    image.classList.remove('active');
    music.pause();
    clearInterval(progressInterval);
}

// Previous Song
function prevSong() {
    musicIndex--;
    if (musicIndex < 0) {
        musicIndex = songs.length - 1;
    }
    loadSong(musicIndex, songs);
}

// Next Song with improved queue handling
function nextSong() {
    if (queue.length > 0) {
        // Play the next song from the queue
        const nextSongFromQueue = queue.shift();
        
        // Find this song in the songs array if it exists, or add it
        let songIndex = songs.findIndex(s => s.id === nextSongFromQueue.id);
        if (songIndex === -1) {
            songs.push(nextSongFromQueue);
            songIndex = songs.length - 1;
        }
        
        musicIndex = songIndex;
        loadSong(musicIndex, songs);
    } else {
        // If no songs in queue, play next song in the original list
        musicIndex++;
        if (musicIndex >= songs.length) {
            musicIndex = 0;
        }
        loadSong(musicIndex, songs);
    }
    
    updateQueueDisplay();
}

// Add a song to the queue
function addToQueue(song) {
    if (!song) {
        console.error("Cannot add invalid song to queue");
        return;
    }
    
    queue.push(song);
    updateQueueDisplay();
    
    // Show confirmation message
    const message = document.createElement('div');
    message.className = 'queue-notification';
    message.textContent = `Added "${song.name}" to queue`;
    document.body.appendChild(message);
    
    setTimeout(() => {
        message.remove();
    }, 2000);
}

// Remove a song from the queue
function removeFromQueue(index) {
    if (index >= 0 && index < queue.length) {
        queue.splice(index, 1);
        updateQueueDisplay();
    }
}

// Update queue display
function updateQueueDisplay() {
    if (!queueContainer) return;
    
    queueContainer.innerHTML = ''; // Clear the current display

    if (queue.length === 0) {
        queueContainer.innerHTML = '<div class="empty-queue">Queue is empty</div>';
    } else {
        queue.forEach((song, index) => {
            const queueItem = document.createElement('div');
            queueItem.classList.add('queue-item');
            
            // Check if album and images exist before accessing them
            const imageUrl = song.album && song.album.images && song.album.images[0] 
                ? song.album.images[0].url 
                : 'images/default.jpg';
                
            const artistName = song.artists && song.artists[0] 
                ? song.artists[0].name 
                : 'Unknown Artist';
                
            queueItem.innerHTML = `
                <img src="${imageUrl}" alt="${song.name}">
                <div class="queue-item-info">
                    <div class="queue-item-title">${song.name}</div>
                    <div class="queue-item-artist">${artistName}</div>
                </div>
                <button class="remove-queue-item" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            queueContainer.appendChild(queueItem);
            
            // Add event listener to remove button
            queueItem.querySelector('.remove-queue-item').addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                removeFromQueue(idx);
            });
        });
    }
    
    updateUpNextDisplay();
}

// Update "Up Next" display
function updateUpNextDisplay() {
    if (!upNextContainer) return;
    
    upNextContainer.innerHTML = '<h2>Up Next</h2>';
    
    if (queue.length > 0) {
        const nextSong = queue[0]; // Get the first song in the queue
        
        // Check if album and images exist before accessing them
        const imageUrl = nextSong.album && nextSong.album.images && nextSong.album.images[0] 
            ? nextSong.album.images[0].url 
            : 'images/default.jpg';
            
        const artistName = nextSong.artists && nextSong.artists[0] 
            ? nextSong.artists[0].name 
            : 'Unknown Artist';
            
        const nextItem = document.createElement('div');
        nextItem.className = 'next-song-item';
        nextItem.innerHTML = `
            <img src="${imageUrl}" alt="${nextSong.name}" id="next-cover">
            <div>
                <div id="next-title">${nextSong.name}</div>
                <div id="next-artist">${artistName}</div>
            </div>
        `;
        
        upNextContainer.appendChild(nextItem);
    } else {
        upNextContainer.innerHTML += '<div class="empty-next">No songs in queue</div>';
    }
}

// Format time in minutes and seconds
function formatTime(time) {
    if (isNaN(time) || time === Infinity) return "00:00";
    
    let minutes = Math.floor(time / 60);
    minutes = (minutes < 10) ? `0${minutes}` : minutes;
    let seconds = Math.floor(time % 60);
    seconds = (seconds < 10) ? `0${seconds}` : seconds;
    return `${minutes}:${seconds}`;
}

// Display error message to user
function displayErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    // Remove error message after 3 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 3000);
}

// Update progress bar as the song plays
function updateProgress() {
    if (isPlaying && !music.paused) {
        const currentTime = music.currentTime;
        const duration = music.duration || 0;
        
        if (isNaN(duration) || duration === 0) return;
        
        const progressPercent = (currentTime / duration) * 100;
        progress.style.width = `${progressPercent}%`;
        currentTimeEl.textContent = formatTime(currentTime);
        
        // Auto-play next song when this one ends
        if (currentTime >= duration - 0.5) {
            nextSong();
        }
    }
}

// Set progress bar with Spotify Web Playback SDK support
async function setProgress(e) {
    const width = playerProgress.clientWidth;
    const clickX = e.offsetX;
    
    // Check if we're using Spotify Web Playback SDK
    const currentState = getCurrentState();
    if (currentState) {
        // Using Spotify Web Playback SDK
        const duration = currentState.duration;
        if (duration > 0) {
            const positionMs = (clickX / width) * duration;
            await seek(positionMs);
        }
    } else {
        // Using HTML5 audio
        const duration = music.duration;
        if (isNaN(duration) || duration === 0) return;
        
        music.currentTime = (clickX / width) * duration;
        updateProgress();
    }
}

// Start updating the progress bar every second
function startProgressInterval() {
    clearInterval(progressInterval); // Clear any existing interval first
    progressInterval = setInterval(updateProgress, 1000);
}

// Event Listeners with Spotify Web Playback SDK support
playBtn.addEventListener('click', async () => {
    // Check if we're using Spotify Web Playback SDK
    const currentState = getCurrentState();
    if (currentState) {
        // Using Spotify Web Playback SDK
        await togglePlayback();
    } else {
        // Using HTML5 audio
        isPlaying ? pauseMusic() : playMusic();
    }
});

prevBtn.addEventListener('click', async () => {
    const currentState = getCurrentState();
    if (currentState) {
        // Using Spotify Web Playback SDK
        await previousTrack();
    } else {
        // Using HTML5 audio
        prevSong();
    }
});

nextBtn.addEventListener('click', async () => {
    const currentState = getCurrentState();
    if (currentState) {
        // Using Spotify Web Playback SDK
        await nextTrack();
    } else {
        // Using HTML5 audio
        nextSong();
    }
});
playerProgress.addEventListener('click', setProgress);
music.addEventListener('ended', nextSong);

// Volume control with Spotify Web Playback SDK support
volumeSlider.addEventListener('input', async (e) => {
    const volume = parseFloat(e.target.value);
    
    // Set volume for HTML5 audio
    music.volume = volume;
    
    // Set volume for Spotify Web Playback SDK if active
    const currentState = getCurrentState();
    if (currentState) {
        await setVolume(volume);
    }
    
    // Update volume icon based on volume level
    if (volume === 0) {
        volumeIcon.className = 'fas fa-volume-mute volume-icon';
    } else if (volume < 0.5) {
        volumeIcon.className = 'fas fa-volume-down volume-icon';
    } else {
        volumeIcon.className = 'fas fa-volume-up volume-icon';
    }
});

// Toggle mute when clicking the volume icon
volumeIcon.addEventListener('click', () => {
    if (music.volume > 0) {
        // Store the current volume before muting
        volumeIcon.dataset.previousVolume = music.volume;
        music.volume = 0;
        volumeSlider.value = 0;
        volumeIcon.className = 'fas fa-volume-mute volume-icon';
    } else {
        // Restore previous volume or default to 0.5
        music.volume = volumeIcon.dataset.previousVolume || 0.5;
        volumeSlider.value = music.volume;
        volumeIcon.className = music.volume < 0.5 ? 'fas fa-volume-down volume-icon' : 'fas fa-volume-up volume-icon';
    }
});

// Search input event
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    // Clear previous timeout
    if (window.searchTimeout) {
        clearTimeout(window.searchTimeout);
    }
    
    // Set a timeout to avoid too many requests
    window.searchTimeout = setTimeout(() => {
        performSearch(query);
    }, 500);
});

// Clear search results when clicking outside
document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.innerHTML = '';
        searchResults.style.display = 'none';
    }
});

// Initialize
function init() {
    // Set defaults
    image.src = 'images/default.jpg';
    background.src = 'images/default.jpg';
    title.innerText = 'Music Player';
    artist.innerText = 'Choose a song to play';
    
    // Ensure the queue container is displayed properly at startup
    updateQueueDisplay();
    
    // Initialize Spotify authentication
    initSpotifyAuth();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            isPlaying ? pauseMusic() : playMusic();
        } else if (e.code === 'ArrowRight') {
            nextSong();
        } else if (e.code === 'ArrowLeft') {
            prevSong();
        }
    });

    // Wire platform buttons (CSP-safe)
    const btnSpotify = document.getElementById('spotify-logo');
    const btnSoundCloud = document.getElementById('soundcloud-logo');
    const btnYouTube = document.getElementById('youtube-logo');
    if (btnSpotify) btnSpotify.addEventListener('click', () => switchMode('spotify'));
    if (btnSoundCloud) btnSoundCloud.addEventListener('click', () => switchMode('soundcloud'));
    if (btnYouTube) btnYouTube.addEventListener('click', () => switchMode('youtube'));
}

// Initialize Spotify authentication
function initSpotifyAuth() {
    // Check if we're on the callback page
    if (window.location.pathname === '/callback') {
        handleAuthCallback();
        return;
    }
    
    // Check current auth status
    updateAuthUI();
    
    // Add login button event listener
    if (spotifyLoginBtn) {
        spotifyLoginBtn.addEventListener('click', () => {
            if (checkAuth()) {
                // Already logged in, maybe show logout option
                localStorage.removeItem('spotify_access_token');
                localStorage.removeItem('spotify_token_expires_at');
                updateAuthUI();
            } else {
                // Initiate login
                initiateSpotifyLogin();
            }
        });
    }
    
    // Listen for Spotify player ready event
    window.addEventListener('spotify-player-ready', () => {
        updateAuthUI();
    });
}

// Update authentication UI
function updateAuthUI() {
    if (!spotifyLoginBtn || !spotifyStatus) return;
    
    const isAuthenticated = checkAuth();
    const playerReady = isPlayerReady();
    
    if (isAuthenticated) {
        if (playerReady) {
            spotifyLoginBtn.innerHTML = '<i class="fab fa-spotify"></i> Spotify Connected';
            spotifyLoginBtn.className = 'auth-button logged-in';
            spotifyStatus.innerHTML = '<span class="success">✓ Ready for full song playback</span>';
            spotifyStatus.className = 'auth-status success';
        } else {
            spotifyLoginBtn.innerHTML = '<i class="fab fa-spotify"></i> Spotify Connecting...';
            spotifyLoginBtn.className = 'auth-button';
            spotifyStatus.innerHTML = 'Initializing Spotify player...';
            spotifyStatus.className = 'auth-status';
        }
    } else {
        spotifyLoginBtn.innerHTML = '<i class="fab fa-spotify"></i> Login to Spotify for Full Playback';
        spotifyLoginBtn.className = 'auth-button';
        spotifyStatus.innerHTML = 'Login required for full song playback (not just previews)';
        spotifyStatus.className = 'auth-status';
    }
}

// Initialize the player
init();

// Export for global access
window.switchMode = switchMode;
window.addToQueue = addToQueue;
window.removeFromQueue = removeFromQueue;
window.playMusic = playMusic;
window.pauseMusic = pauseMusic;
window.nextSong = nextSong;
window.prevSong = prevSong;