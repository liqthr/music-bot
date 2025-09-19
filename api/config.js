module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  // Cache briefly at edge
  res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=59');

  res.status(200).json({
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID || '',
    spotifyRedirectUri: process.env.NODE_ENV === 'production'
      ? 'https://music-bot-brown-nine.vercel.app/callback.html'
      : 'http://localhost:3000/callback.html',
    spotifyScopes: [
      'streaming',
      'user-read-email',
      'user-read-private',
      'user-read-playback-state',
      'user-modify-playback-state'
    ].join(' ')
  });
};