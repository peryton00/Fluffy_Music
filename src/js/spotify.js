// src/js/spotify.js — Spotify API calls from the frontend (via Vercel /api/ proxy)

/**
 * Parses a Spotify URL or URI and returns { type, id }.
 * Mirrors the logic in api/_helpers.js for use on the frontend.
 * Strips ?si= and other query params before parsing.
 * @param {string} url
 * @returns {{ type: string, id: string } | null}
 */
export function parseSpotifyLink(url) {
  if (!url || typeof url !== 'string') return null;

  const cleanUrl = url.split('?')[0].trim();

  // HTTP URL: https://open.spotify.com/{type}/{id}
  const httpMatch = cleanUrl.match(
    /open\.spotify\.com\/(playlist|album|track)\/([A-Za-z0-9]+)/
  );
  if (httpMatch) return { type: httpMatch[1], id: httpMatch[2] };

  // URI: spotify:{type}:{id}
  const uriMatch = cleanUrl.match(
    /^spotify:(playlist|album|track):([A-Za-z0-9]+)$/
  );
  if (uriMatch) return { type: uriMatch[1], id: uriMatch[2] };

  return null;
}

/**
 * Fetches one page of Spotify data via the serverless API proxy.
 * @param {string} type - 'playlist' | 'album' | 'track'
 * @param {string} id - Spotify content ID
 * @param {number} offset - Pagination offset
 * @returns {Promise<object>} API response data
 */
export async function fetchSpotifyData(type, id, offset = 0) {
  const params = new URLSearchParams({ type, id, offset: String(offset), limit: '50' });
  const res = await fetch(`/api/spotify-data?${params.toString()}`);
  const data = await res.json();

  if (!res.ok || data.error) {
    if (res.status === 404) {
      throw new Error('This playlist is private or does not exist.');
    }
    if (res.status === 400) {
      throw new Error('Invalid Spotify link.');
    }
    throw new Error(data.message || 'Failed to load tracks.');
  }

  return data;
}

/**
 * Fetches all tracks for a playlist/album/track, paginating as needed.
 * Caps at 500 tracks and calls onProgress after each page.
 * @param {string} type
 * @param {string} id
 * @param {Function} onProgress - (loaded: number, total: number) => void
 * @returns {Promise<Array>} All fetched tracks
 */
export async function fetchAllTracks(type, id, onProgress) {
  const MAX_TRACKS = 500;

  // First page
  const firstPage = await fetchSpotifyData(type, id, 0);
  let allTracks = [...firstPage.tracks];
  const total = firstPage.totalTracks;

  if (onProgress) onProgress(allTracks.length, total);

  // If only one page or single track, return immediately
  if (!firstPage.hasMore || type === 'track') {
    return { tracks: allTracks, meta: firstPage };
  }

  // Fetch subsequent pages sequentially
  let offset = firstPage.nextOffset;
  let cappedAt500 = false;

  while (offset < total && allTracks.length < MAX_TRACKS) {
    try {
      const page = await fetchSpotifyData(type, id, offset);
      allTracks = [...allTracks, ...page.tracks];
      offset = page.nextOffset;

      if (onProgress) onProgress(Math.min(allTracks.length, MAX_TRACKS), total);

      if (!page.hasMore) break;

      // Cap at 500
      if (allTracks.length >= MAX_TRACKS) {
        allTracks = allTracks.slice(0, MAX_TRACKS);
        cappedAt500 = true;
        break;
      }
    } catch (err) {
      console.error('fetchAllTracks pagination error:', err.message);
      break;
    }
  }

  if (cappedAt500 && window.showToast) {
    window.showToast('Showing first 500 tracks', 'info');
  }

  return { tracks: allTracks, meta: firstPage };
}
