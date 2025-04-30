import config from './config.js';
import { searchSpotify } from './spotifySearch.js';
import { searchSoundCloud } from './soundcloudSearch.js';

let currentMode = 'spotify';

// Updated switchMode function with better platform handling
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
    volumeIcon = document.querySelector('.volume-icon');

// State management
const music = new Audio();
let songs = [];
let musicIndex = 0;
let isPlaying = false;
let player = null;
let currentVideoId = null;
let queue = [];
let currentDuration = 0;
let progressInterval = null;

// Updated search functionality
async function performSearch(query) {
    const searchResults = document.getElementById('search-results');
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
                const songElement = document.createElement('div');
                songElement.classList.add('result-item');
                songElement.innerHTML = `
                    <img src="${song.album.images[0].url}" alt="${song.name}">
                    <div class="song-info">
                        ${song.name}
                        ${song.artists?.[0]?.name || song.artist}
                    </div>
                `;
                songElement.addEventListener('click', () => loadSong(index, results));
                searchResults.appendChild(songElement);
            });
        } else {
            searchResults.innerHTML = '<p>No results found.</p>';
        }
    } catch (error) {
        console.error("Search error:", error);
searchResults.innerHTML = 'Error occurred. Please try again.';
    }
}
// Load song
function loadSong(index, searchResults) {
    musicIndex = index;
    songs = searchResults; // Update songs array with search results
    const song = songs[musicIndex];

    music.src = song.preview_url;
    image.src = song.album.images[0].url;
    background.src = song.album.images[0].url;
    title.innerText = song.name;
    artist.innerText = song.artists[0].name;

    music.addEventListener('loadeddata', () => {
        currentDuration = music.duration;
        durationEl.textContent = formatTime(currentDuration);
    });
    updateQueueDisplay();
    playMusic();
}

// Play Music
function playMusic() {
    isPlaying = true;
    playBtn.classList.replace('fa-play', 'fa-pause');
    image.classList.add('active');
    music.play();
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

// Play or Pause Event
playBtn.addEventListener('click', () => {
    isPlaying ? pauseMusic() : playMusic();
});

// Previous Song
function prevSong() {
    musicIndex--;
    if (musicIndex < 0) {
        musicIndex = songs.length - 1;
    }
    loadSong(musicIndex, songs);
    playMusic();
}

// Next Song
function nextSong() {
    musicIndex++;
    if (musicIndex > songs.length - 1) {
        musicIndex = 0;
    }
    loadSong(musicIndex, songs);
    playMusic();
}
// Next Song
function playNextSong() {
    if (queue.length > 0) {
        // Play the next song from the queue
        const nextSong = queue.shift(); // Remove the first song from the queue
        music.src = nextSong.preview_url;
        image.src = nextSong.album.images[0].url;
        background.src = nextSong.album.images[0].url;
        title.innerText = nextSong.name;
        artist.innerText = nextSong.artists[0].name;
        music.addEventListener('loadeddata', () => {
            currentDuration = music.duration;
            durationEl.textContent = formatTime(currentDuration);
        });
        playMusic();
    } else {
        // If the queue is empty, play the next song from the original list
        nextSong();
    }
    updateQueueDisplay();
}
// Add a song to the queue
function addToQueue(song) {
    queue.push(song);
    updateQueueDisplay(); // Update the display after adding to the queue
}

// Update queue display
function updateQueueDisplay() {
    const queueContainer = document.getElementById('queue-container');
    queueContainer.innerHTML = ''; // Clear the current display

    queue.forEach((song, index) => {
        const queueItem = document.createElement('div');
        queueItem.classList.add('queue-item');
        queueItem.innerHTML = `
            <img src="${song.album.images[0].url}" alt="${song.name}">
            ${song.name} - ${song.artists[0].name}
        `;
        queueContainer.appendChild(queueItem);
    });
    displayNextSong();
}
function displayNextSong() {
    const upNextContainer = document.getElementById('up-next');
    if (queue.length > 0) {
        const nextSong = queue[0]; // Get the first song in the queue
        upNextContainer.innerHTML = `
            <h2>Up Next</h2>
            ${nextSong.name} - ${nextSong.artists[0].name}
        `;
    } else {
        // If there are no songs in the queue, display a default message
upNextContainer.innerHTML = '<h2>Up Next</h2>\nQueue is empty';
    }
}
// Previous & Next song events
prevBtn.addEventListener('click', prevSong);
nextBtn.addEventListener('click', playNextSong);

// Update progress bar as the song plays
function updateProgress(e) {
    if (isPlaying) {
        const { duration, currentTime } = e.srcElement;
        const progressPercent = (currentTime / duration) * 100;
        progress.style.width = `${progressPercent}%`;
        currentTimeEl.textContent = formatTime(currentTime);
    }
}

// Set progress bar
function setProgress(e) {
    const width = this.clientWidth;
    const clickX = e.offsetX;
    const duration = music.duration;

    music.currentTime = (clickX / width) * duration;
}

// Format time in minutes and seconds
function formatTime(time) {
    let minutes = Math.floor(time / 60);
    minutes = (minutes < 10) ? `0${minutes}` : minutes;
    let seconds = Math.floor(time % 60);
    seconds = (seconds < 10) ? `0${seconds}` : seconds;
    return `${minutes}:${seconds}`;
}
// Start updating the progress bar every second
function startProgressInterval() {
    progressInterval = setInterval(() => {
        if (isPlaying) {
            updateProgress({ srcElement: music });
        }
    }, 1000);
}

// Song End
music.addEventListener('ended', nextSong);

// Progress Bar Event Listener
playerProgress.addEventListener('click', setProgress);

searchInput.addEventListener('input', (e) => performSearch(e.target.value));
volumeSlider.addEventListener('input', (e) => {
    music.volume = e.target.value;
});

// Initialize
switchMode('spotify');
window.switchMode = switchMode;   