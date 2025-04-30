// soundcloudSearch.js
console.log('SoundCloudSearch module loaded');

const baseUrl = window.location.origin || 'http://localhost:3000';

// Function to get SoundCloud client ID from the server
async function getSoundCloudClientId() {
    try {
        const response = await fetch(`${baseUrl}/soundcloud-client-id`);
        if (!response.ok) {
            throw new Error('Failed to get SoundCloud client ID');
        }
        const data = await response.json();
        return data.clientId;
    } catch (error) {
        console.error("Failed to get SoundCloud client ID:", error);
        return null;
    }
}

export async function searchSoundCloud(query) {
    console.log('searchSoundCloud called with query:', query);
    if (!query) {
        console.warn('Empty search query');
        return [];
    }

    try {
        const response = await fetch(
            `${baseUrl}/soundcloud-search?q=${encodeURIComponent(query)}`,
            {
                headers: {
                    'Cache-Control': 'no-cache'
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Search response error:', errorText);
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        console.log('SoundCloud search results count:', data.length);

        // Map the data to a common format compatible with Spotify results
        const formattedTracks = data
            .filter(item => item && item.title)
            .map(item => ({
                id: item.id,
                name: item.title,
                artists: [{
                    name: item.user?.username || 'Unknown Artist'
                }],
                album: {
                    images: [{
                        url: item.artwork_url?.replace('-large', '-t500x500') || 
                              item.user?.avatar_url?.replace('-large', '-t500x500') || 
                              'default-artwork.png'
                    }]
                },
                duration_ms: item.duration,
                preview_url: item.stream_url || null,
                platform: 'soundcloud',
                stream_url: item.stream_url,
                permalink_url: item.permalink_url
            }));

        return formattedTracks;
    } catch (error) {
        console.error("SoundCloud Search Error:", error);
        return [];
    }
}

// Function to get a playable stream URL with client ID
export async function getSoundCloudStreamUrl(track) {
    if (!track || !track.stream_url) {
        console.error('Invalid track or missing stream URL');
        return null;
    }
    
    try {
        const response = await fetch(`${baseUrl}/soundcloud-stream?url=${encodeURIComponent(track.stream_url)}`);
        if (!response.ok) {
            throw new Error('Failed to resolve stream URL');
        }
        
        const data = await response.json();
        return data.stream_url;
    } catch (error) {
        console.error('Error resolving SoundCloud stream URL:', error);
        return null;
    }
}