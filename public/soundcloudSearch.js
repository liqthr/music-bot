// soundcloudSearch.js
console.log('SoundCloudSearch module loaded');

import config from './config.js';

const soundCloudClientId = config.soundCloudClientId;
const baseUrl = config.baseUrl || 'http://localhost:3000';

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
        console.log('Raw search response:', JSON.stringify(data, null, 2));

        // Map the data to a common format
        const formattedTracks = data
            .filter(item => item.artwork_url && item.title && item.user?.username)
            .map(item => ({
                id: item.id,
                artists: [{
                    name: item.user.username
                }],
                name: item.title,
                album: {
                    images: [{
                        url: item.artwork_url || 'default-artwork.png'
                    }]
                },
                preview_url: item.stream_url ? `${item.stream_url}?client_id=${soundCloudClientId}` : null
            }));

        console.log('Formatted tracks:', formattedTracks);
        return formattedTracks;
    } catch (error) {
        console.error("SoundCloud Search Error:", error);
        return [];
    }
}
