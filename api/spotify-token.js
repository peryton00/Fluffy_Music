// api/spotify-token.js — Get Spotify app token via Client Credentials flow
// No user login required. Works for all public Spotify content.

const { handleOptions, errorResponse, successResponse } = require('./_helpers');

// In-memory token cache (survives multiple requests on the same Vercel instance)
let cachedToken = null;
let tokenExpiry = 0;

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (handleOptions(req, res)) return;

  try {
    // Return cached token if still valid
    if (cachedToken && Date.now() < tokenExpiry) {
      return successResponse(res, {
        access_token: cachedToken,
        expires_in: Math.round((tokenExpiry - Date.now()) / 1000),
        cached: true,
      });
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return errorResponse(res, 500, 'spotify_credentials_missing');
    }

    // Base64 encode credentials for Basic Auth header
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
      const errText = await tokenRes.text();
      console.error('Spotify token error:', tokenRes.status, errText);
      return errorResponse(res, 500, 'spotify_token_failed');
    }

    const tokenData = await tokenRes.json();
    const { access_token, expires_in } = tokenData;

    // Cache the token, expire 60 seconds early to be safe
    cachedToken = access_token;
    tokenExpiry = Date.now() + (expires_in - 60) * 1000;

    return successResponse(res, { access_token, expires_in });
  } catch (err) {
    console.error('spotify-token handler error:', err.message);
    return errorResponse(res, 500, 'spotify_token_failed');
  }
};
