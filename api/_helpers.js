// api/_helpers.js — Shared utilities for all Vercel serverless functions

/**
 * Sets CORS headers on all responses.
 * @param {object} res - Vercel response object
 */
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Handles CORS preflight OPTIONS requests.
 * @param {object} req - Vercel request object
 * @param {object} res - Vercel response object
 * @returns {boolean} true if it was an OPTIONS request and was handled
 */
function handleOptions(req, res) {
  setCORSHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

/**
 * Sends a JSON error response with proper CORS headers.
 * @param {object} res - Vercel response object
 * @param {number} status - HTTP status code
 * @param {string} message - Error message key
 */
function errorResponse(res, status, message) {
  setCORSHeaders(res);
  res.status(status).json({ error: true, message });
}

/**
 * Sends a JSON success response with proper CORS headers.
 * @param {object} res - Vercel response object
 * @param {object} data - Data to send
 */
function successResponse(res, data) {
  setCORSHeaders(res);
  res.status(200).json({ error: false, ...data });
}

/**
 * Parses a Spotify URL or URI and extracts the type and ID.
 * Handles all formats including query params like ?si=xxx
 * @param {string} url - Spotify URL or URI
 * @returns {{ type: string, id: string } | null}
 */
function extractSpotifyInfo(url) {
  if (!url || typeof url !== 'string') return null;

  // Strip trailing query params from the full URL string first
  const cleanUrl = url.split('?')[0].trim();

  // Match Spotify HTTP URLs: https://open.spotify.com/{type}/{id}
  const httpMatch = cleanUrl.match(
    /open\.spotify\.com\/(playlist|album|track)\/([A-Za-z0-9]+)/
  );
  if (httpMatch) {
    return { type: httpMatch[1], id: httpMatch[2] };
  }

  // Match Spotify URIs: spotify:{type}:{id}
  const uriMatch = cleanUrl.match(
    /^spotify:(playlist|album|track):([A-Za-z0-9]+)$/
  );
  if (uriMatch) {
    return { type: uriMatch[1], id: uriMatch[2] };
  }

  return null;
}

module.exports = {
  setCORSHeaders,
  handleOptions,
  errorResponse,
  successResponse,
  extractSpotifyInfo,
};
