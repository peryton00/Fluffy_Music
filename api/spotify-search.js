// api/spotify-search.js — Search for Spotify playlists from the server
// Bypasses browser-side 403 Forbidden issues.

const { handleOptions, errorResponse, successResponse } = require('./_helpers');

/**
 * Internally fetches a Spotify access token.
 */
async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('spotify_credentials_missing');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!tokenRes.ok) {
    throw new Error('spotify_token_failed');
  }

  const data = await tokenRes.json();
  return data.access_token;
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;

  const { q, limit = 8 } = req.query;
  if (!q) return errorResponse(res, 400, 'missing_query');

  try {
    const token = await getSpotifyToken();
    const encoded = encodeURIComponent(q);
    
    // Always use market=IN as the app is targeted for Indian content by default in CATALOGUE
    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encoded}&type=playlist&limit=${limit}&market=IN`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      console.error(`Spotify Search API error: ${searchRes.status}`, errText);
      return res.status(searchRes.status).json({ error: true, message: 'spotify_search_failed', spotifyError: errText });
    }

    const data = await searchRes.json();
    const items = (data.playlists && data.playlists.items) ? data.playlists.items : [];
    
    const results = items
      .filter(item => item != null)
      .map(item => ({
        spotifyId: item.id,
        name: item.name || '',
        description: item.description || '',
        coverArt: item.images && item.images[0] ? item.images[0].url : '',
        trackCount: item.tracks ? item.tracks.total : 0,
        url: 'https://open.spotify.com/playlist/' + item.id
      }));

    return successResponse(res, { results });

  } catch (err) {
    console.error('spotify-search handler error:', err.message);
    return errorResponse(res, 500, 'spotify_search_failed');
  }
};
