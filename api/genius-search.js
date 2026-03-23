// api/genius-search.js — Vercel serverless proxy for Genius API
// This proxy is needed because calling Genius directly from the browser
// is blocked by CORS restrictions.
//
// SETUP: Set GENIUS_TOKEN as an environment variable in your Vercel project.
//   → https://vercel.com/docs/projects/environment-variables
//   Variable name: GENIUS_TOKEN
//   Value: your Genius Client Access Token from https://genius.com/api-clients

const { handleOptions, errorResponse: sendError, setCORSHeaders } = require('./_helpers.js');

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCORSHeaders(res);

  const { q } = req.query;
  if (!q) return sendError(res, 400, 'Missing query param: q');

  const token = process.env.GENIUS_TOKEN;
  if (!token) return sendError(res, 503, 'GENIUS_TOKEN env var not set');

  try {
    const apiUrl = `https://api.genius.com/search?q=${encodeURIComponent(q)}`;
    const apiRes = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!apiRes.ok) {
      return sendError(res, apiRes.status, 'Genius API error');
    }

    const data = await apiRes.json();
    res.status(200).json(data);
  } catch (err) {
    return sendError(res, 500, err.message || 'Internal error');
  }
};
