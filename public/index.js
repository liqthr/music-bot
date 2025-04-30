// index.js - Main application logic
import { searchSpotify } from './spotifySearch.js';
import { searchSoundCloud, getSoundCloudStreamUrl } from './soundcloudSearch.js';

// Current state
let currentMode = 'spotify';
let songs = [];
let currentSong = null;
let musicIndex = 0;
let isPlaying = false;
let queue = [];
let progressInterval = null;

// DOM Elements
const image = document.getElementById('cover');
const bgImage = document.getElementById('bg-img');
const title = document.getElementById('music-title');
const artist = document.getElementById('music-artist');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const progress = document.getElementById('progress');
const playerProgress = document.getElementById('player-progress');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const playBtn = document.getElementById('play');
const searchInput = document.getElementById('search');
const searchResults = document.getElementById('search-results');
const volumeSlider = document.getElementById('volume-slider');
const queueContainer = document.getElementById('queue-container');
const upNextContainer = document.getElementById('up-next');

// Audio player
const music = new Audio();

// Initialize volume from local storage or default to 0.7
music.volume = parseFloat(localStorage.getItem('playerVolume') || 0.7);
volumeSlider.value = music.volume;

// Mode switching function
function switchMode(mode) {
    currentMode = mode;
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
    searchBar.focus();
}

// Search function
async function performSearch(query) {
    if (!query || query.trim() === '') {
        searchResults.innerHTML = '';
        return;
    }

    searchResults.innerHTML = '<p class="loading">Searching...</p>';

    try {
        let results = [];
        if (currentMode === 'spotify') {
            results = await searchSpotify(query);
        } else if (currentMode === 'soundcloud') {
            results = await searchSoundCloud(query);
        }

        searchResults.innerHTML = '';
        
        if (results && results.length > 0) {
            results.forEach((song, index) => {
                // Create a result item
                const songElement = document.createElement('div');
                songElement.classList.add('result-item');
                
                // Get appropriate artwork
                const artworkUrl = song.album?.images?.[0]?.url || 'default-artwork.png';
                
                // Create inner HTML structure
                songElement.innerHTML = `
                    <img src="${artworkUrl}" alt="${song.name}" onerror="this.src='default-artwork.png'">
                    <div class="song-info">
                        <div class="song-title">${song.name}</div>
                        <div class="song-artist">${song.artists?.[0]?.name || 'Unknown Artist'}</div>
                    </div>
                    <div class="song-actions">
                        <button class="play-now-btn" title="Play Now"><i class="fas fa-play"></i></button>
                        <button class="add-queue-btn" title="Add to Queue"><i class="fas fa-list"></i></button>
                    </div>
                `;
                
                // Add event listeners
                const playNowBtn = songElement.querySelector('.play-now-btn');
                const addQueueBtn = songElement.querySelector('.add-queue-btn');
                
                playNowBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    loadSong(index, results);
                });
                
                addQueueBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    addToQueue(results[index]);
                    showNotification(`"${results[index].name}" added to queue`);
                });
                
                // Also allow clicking the whole item to play
                songElement.addEventListener('click', () => loadSong(index, results));
                
                searchResults.appendChild(songElement);
            });
        } else {
            searchResults.innerHTML = '<p class="no-results">No results found.</p>';
        }
    } catch (error) {
        console.error("Search error:", error);
        searchResults.innerHTML = '<p class="error">Error occurred. Please try again.</p>';
    }
}

// Load song function
async function loadSong(index, searchResults) {
    try {
        musicIndex = index;
        songs = searchResults; // Update songs array with search results
        currentSong = songs[musicIndex];
        
        // Update UI elements
        title.innerText = currentSong.name;
        artist.innerText = currentSong.artists[0].name;
        
        // Set cover image
        const artworkUrl = currentSong.album?.images?.[0]?.url || 'default-artwork.png';
        image.src = artworkUrl;
        bgImage.src = artworkUrl;
        
        // Reset progress
        progress.style.width = '0%';
        currentTimeEl.textContent = '0:00';
        
        // Handle platform-specific playback
        if (currentSong.platform === 'soundcloud') {
            const streamUrl = await getSoundCloudStreamUrl(currentSong);
            if (streamUrl) {
                music.src = streamUrl;
            } else {
                showNotification('Failed to get playable stream', 'error');
                return;
            }
        } else {
            // For Spotify
            if (!currentSong.preview_url) {
                showNotification('Preview not available for this track', 'warning');
                music.src = ''; // Clear the source
                durationEl.textContent = '0:00';
            } else {
                music.src = currentSong.preview_url;
            }
        }
        
        // Wait for the audio to be loaded
        music.addEventListener('loadeddata', () => {
            durationEl.textContent = formatTime(music.duration);
        });
        
        // Hide search results
        searchResults.innerHTML = '';
        
        // Update queue display
        updateQueueDisplay();
        
        // Start playback if we have a valid source
        if (music.src) {
            playMusic();
        }
    } catch (error) {
        console.error('Error loading song:', error);
        showNotification('Failed to load song', 'error');
    }
}

// Play music function
function playMusic() {
    if (!music.src) {
        showNotification('No audio source available', 'warning');
        return;
    }
    
    isPlaying = true;
    playBtn.classList.replace('fa-play', 'fa-pause');
    playBtn.title = 'Pause';
    image.classList.add('active');
    
    // Play and start tracking progress
    music.play().catch(error => {
        console.error('Play error:', error);
        showNotification('Playback failed', 'error');
        pauseMusic();
    });
    
    startProgressInterval();
}

// Pause music function
function pauseMusic() {
    isPlaying = false;
    playBtn.classList.replace('fa-pause', 'fa-play');
    playBtn.title = 'Play';
    image.classList.remove('active');
    music.pause();
    clearInterval(progressInterval);
}

// Previous song function
function prevSong() {
    if (music.currentTime > 5) {
        // If more than 5 seconds have passed, restart the current song
        music.currentTime = 0;
        return;
    }
    
    if (songs.length === 0) return;
    
    musicIndex--;
    if (musicIndex < 0) {
        musicIndex = songs.length - 1;
    }
    loadSong(musicIndex, songs);
}

// Play next song from queue or playlist
function playNextSong() {
    if (queue.length > 0) {
        // Play the next song from the queue
        const nextSong = queue.shift(); // Remove from queue
        currentSong = nextSong;
        
        // Find if the song exists in our search results
        const songIndex = songs.findIndex(s => s.id === nextSong.id);
        if (songIndex !== -1) {
            musicIndex = songIndex;
        }
        
        // Update UI
        title.innerText = nextSong.name;
        artist.innerText = nextSong.artists[0].name;
        
        // Set images
        const artworkUrl = nextSong.album?.images?.[0]?.url || 'default-artwork.png';
        image.src = artworkUrl;
        bgImage.src = artworkUrl;
        
        // Handle platform-specific playback
        if (nextSong.platform === 'soundcloud') {
            getSoundCloudStreamUrl(nextSong).then(streamUrl => {
                if (streamUrl) {
                    music.src = streamUrl;
                    playMusic();
                } else {
                    showNotification('Failed to get playable stream', 'error');
                    playNextSong(); // Skip to next
                }
            });
        } else {
            // For Spotify
            if (!nextSong.preview_url) {
                showNotification('Preview not available, skipping', 'warning');
                playNextSong(); // Recursively try next song
                return;
            }
            music.src = nextSong.preview_url;
            playMusic();
        }
    } else if (songs.length > 0) {
        // Play next song from playlist
        musicIndex++;
        if (musicIndex >= songs.length) {
            musicIndex = 0;
        }
        loadSong(musicIndex, songs);
    }
    
    updateQueueDisplay();
}

// Add song to queue
function addToQueue(song) {
    queue.push(song);
    updateQueueDisplay();
}

// Update queue display
function updateQueueDisplay() {
    queueContainer.innerHTML = '';

    if (queue.length === 0) {
        queueContainer.innerHTML = '<div class="empty-queue">Queue is empty</div>';
    } else {
        queue.forEach((song, index) => {
            const queueItem = document.createElement('div');
            queueItem.classList.add('queue-item');
            
            const artworkUrl = song.album?.images?.[0]?.url || 'default-artwork.png';
            
            queueItem.innerHTML = `
                <img src="${artworkUrl}" alt="${song.name}" onerror="this.src='default-artwork.png'">
                <div class="queue-info">
                    <div class="queue-title">${song.name}</div>
                    <div class="queue-artist">${song.artists[0].name}</div>
                </div>
                <button class="remove-queue-btn" title="Remove from queue"><i class="fas fa-times"></i></button>
            `;
            
            // Add remove from queue functionality
            const removeBtn = queueItem.querySelector('.remove-queue-btn');
            removeBtn.addEventListener('click', () => {
                queue.splice(index, 1);
                updateQueueDisplay();
                showNotification('Removed from queue');
            });
            
            queueContainer.appendChild(queueItem);
        });
    }
    
    // Update up next display
    if (queue.length > 0) {
        const nextSong = queue[0];
        upNextContainer.innerHTML = `
            <h2>Up Next</h2>
            <div class="next-song-info">
                <img src="${nextSong.album.images[0].url}" alt="${nextSong.name}" class="next-song-img" onerror="this.src='default-artwork.png'">
                <div class="next-song-details">
                    <div class="next-song-title">${nextSong.name}</div>
                    <div class="next-song-artist">${nextSong.artists[0].name}</div>
                </div>
            </div>
        `;
    } else {
        upNextContainer.innerHTML = '<h2>Up Next</h2><div class="empty-next">Queue is empty</div>';
    }
}

// Start progress interval
function startProgressInterval() {
    clearInterval(progressInterval); // Clear existing interval
    progressInterval = setInterval(() => {
        if (isPlaying && music.duration) {
            updateProgress();
        }
    }, 1000);
}

// Update progress display
function updateProgress() {
    const currentTime = music.currentTime;
    const duration = music.duration || 0;
    
    if (duration > 0) {
        const progressPercent = (currentTime / duration) * 100;
        progress.style.width = `${progressPercent}%`;
        currentTimeEl.textContent = formatTime(currentTime);
        
        // Auto play next song when current one ends
        if (currentTime >= duration - 0.5) {
            playNextSong();
        }
    }
}

// Set progress when clicking on progress bar
function setProgress(e) {
    const width = playerProgress.clientWidth;
    const clickX = e.offsetX;
    const duration = music.duration;

    if (duration) {
        music.currentTime = (clickX / width) * duration;
        updateProgress();
    }
}

// Format time helper (converts seconds to MM:SS format)
function formatTime(time) {
    if (isNaN(time) || time === Infinity) return '0:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        document.body.appendChild(notification);
    }
    
    // Set content and style based on type
    notification.textContent = message;
    notification.className = `notification ${type}`;
    
    // Show notification
    notification.classList.add('show');
    
    // Hide after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Event Listeners
playBtn.addEventListener('click', () => isPlaying ? pauseMusic() : playMusic());
prevBtn.addEventListener('click', prevSong);
nextBtn.addEventListener('click', playNextSong);
playerProgress.addEventListener('click', setProgress);
music.addEventListener('ended', playNextSong);

// Search input handler with debounce
let searchTimeout;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        performSearch(e.target.value);
    }, 500); // 500ms debounce
});

// Volume control
volumeSlider.addEventListener('input', (e) => {
    const volume = parseFloat(e.target.value);
    music.volume = volume;
    localStorage.setItem('playerVolume', volume);
    
    // Update volume icon
    const volumeIcon = document.querySelector('.volume-icon');
    if (volume === 0) {
        volumeIcon.classList.remove('fa-volume-up', 'fa-volume-down');
        volumeIcon.classList.add('fa-volume-mute');
    } else if (volume < 0.5) {
        volumeIcon.classList.remove('fa-volume-up', 'fa-volume-mute');
        volumeIcon.classList.add('fa-volume-down');
    } else {
        volumeIcon.classList.remove('fa-volume-down', 'fa-volume-mute');
        volumeIcon.classList.add('fa-volume-up');
    }
});

// Volume icon click to toggle mute
document.querySelector('.volume-icon').addEventListener('click', () => {
    if (music.volume > 0) {
        // Store the current volume before muting
        localStorage.setItem('previousVolume', music.volume);
        music.volume = 0;
        volumeSlider.value = 0;
        document.querySelector('.volume-icon').classList.remove('fa-volume-up', 'fa-volume-down');
        document.querySelector('.volume-icon').classList.add('fa-volume-mute');
    } else {
        // Restore previous volume
        const previousVolume = parseFloat(localStorage.getItem('previousVolume') || 0.7);
        music.volume = previousVolume;
        volumeSlider.value = previousVolume;
        
        if (previousVolume < 0.5) {
            document.querySelector('.volume-icon').classList.add('fa-volume-down');
        } else {
            document.querySelector('.volume-icon').classList.add('fa-volume-up');
        }
        document.querySelector('.volume-icon').classList.remove('fa-volume-mute');
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.target === searchInput) return; // Don't trigger shortcuts when typing in search
    
    switch (e.code) {
        case 'Space':
            e.preventDefault();
            isPlaying ? pauseMusic() : playMusic();
            break;
        case 'ArrowRight':
            playNextSong();
            break;
        case 'ArrowLeft':
            prevSong();
            break;
        case 'ArrowUp':
            // Increase volume
            music.volume = Math.min(1, music.volume + 0.1);
            volumeSlider.value = music.volume;
            localStorage.setItem('playerVolume', music.volume);
            break;
        case 'ArrowDown':
            // Decrease volume
            music.volume = Math.max(0, music.volume - 0.1);
            volumeSlider.value = music.volume;
            localStorage.setItem('playerVolume', music.volume);
            break;
    }
});

// Initialize
window.switchMode = switchMode; // Expose function to global scope for HTML onclick
switchMode('spotify'); // Start with Spotify mode