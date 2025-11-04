// Define the global callback the Spotify SDK expects in a CSP-safe module.
// When the SDK script loads, it will call this function.
window.onSpotifyWebPlaybackSDKReady = () => {
    window.dispatchEvent(new Event('spotify-sdk-ready'));
};


