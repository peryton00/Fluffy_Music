// api/jiosaavn-search.js — Vercel serverless proxy for JioSaavn lyrics
// Called by lyrics.js to avoid CORS issues with third-party JioSaavn APIs.
// No API key required.

const { handleOptions, errorResponse, setCORSHeaders } = require('./_helpers.js');

const SAAVN_HOSTS = [
  'https://saavn.dev',
  'https://saavn-api.vercel.app',
];

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCORSHeaders(res);

  const { artist = '', title = '' } = req.query;
  if (!title) return errorResponse(res, 400, 'Missing title param');

  const query = encodeURIComponent(`${title} ${artist}`.trim());

  for (const host of SAAVN_HOSTS) {
    try {
      const searchRes = await fetch(
        `${host}/api/search/songs?query=${query}&page=1&limit=5`,
        { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(6000) }
      );
      if (!searchRes.ok) continue;

      const searchData = await searchRes.json();
      const songs = searchData?.data?.results;
      if (!songs || songs.length === 0) continue;

      // Pick best match
      const titleLower = title.toLowerCase();
      const artistLower = artist.toLowerCase();
      let best = songs[0];
      for (const song of songs) {
        const snLower = (song.name || '').toLowerCase();
        const saArtist = (song.artists?.primary?.[0]?.name || '').toLowerCase();
        if (snLower.includes(titleLower.slice(0, 10)) &&
            (artistLower === '' || saArtist.includes(artistLower.split(' ')[0]))) {
          best = song;
          break;
        }
      }

      if (!best?.id) continue;

      const detailRes = await fetch(
        `${host}/api/songs/${best.id}`,
        { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(6000) }
      );
      if (!detailRes.ok) continue;

      const detailData = await detailRes.json();
      const lyrics = detailData?.data?.[0]?.lyrics;
      if (lyrics && lyrics.trim().length > 0) {
        return res.status(200).json({ lyrics });
      }
    } catch (e) {
      // Try next host
    }
  }

  return res.status(404).json({ error: 'Not found' });
};
