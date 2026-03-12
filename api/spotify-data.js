// api/spotify-data.js — Fetch tracks from any public Spotify playlist, album, or track

const { handleOptions, errorResponse, successResponse } = require('./_helpers');

/**
 * Internally fetches a Spotify access token from the spotify-token module.
 * This avoids an extra HTTP round-trip within the same Vercel instance.
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

/**
 * Normalize a Spotify track object to a consistent shape.
 * @param {object} trackObj - Spotify track API object (or item.track for playlists)
 * @param {object} albumOverride - Optional album data for album tracks (lacks full album)
 * @returns {object} Normalized track
 */
function normalizeTrack(trackObj, albumOverride = null) {
  if (!trackObj || trackObj.type === 'episode') return null;

  const album = albumOverride || trackObj.album || {};
  const albumArt =
    (album.images && album.images[0] && album.images[0].url) || '';

  const artistsArr = (trackObj.artists || []).map((a) => a.name);

  return {
    id: trackObj.id,
    name: trackObj.name,
    artist: artistsArr[0] || 'Unknown Artist',
    artists: artistsArr.join(', '),
    album: album.name || '',
    albumArt,
    duration: trackObj.duration_ms || 0,
    spotifyId: trackObj.id,
  };
}

/**
 * Fetch a single page of Spotify playlist tracks.
 */
async function fetchPlaylistTracksPage(playlistId, token, offset, limit) {
  const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&fields=items(track(id,name,artists,album,duration_ms)),total,next`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 404) throw Object.assign(new Error('not_found'), { status: 404 });
    throw new Error(`playlist_tracks_failed_${res.status}`);
  }
  return res.json();
}

/**
 * Fetch a single page of Spotify album tracks.
 */
async function fetchAlbumTracksPage(albumId, token, offset, limit) {
  const url = `https://api.spotify.com/v1/albums/${albumId}/tracks?limit=${limit}&offset=${offset}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 404) throw Object.assign(new Error('not_found'), { status: 404 });
    throw new Error(`album_tracks_failed_${res.status}`);
  }
  return res.json();
}

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (handleOptions(req, res)) return;

  const { type, id, offset: rawOffset, limit: rawLimit } = req.query;

  const offset = parseInt(rawOffset, 10) || 0;
  const limit = Math.min(parseInt(rawLimit, 10) || 50, 50);

  // Validate params
  if (!type || !['playlist', 'album', 'track'].includes(type)) {
    return errorResponse(res, 400, 'invalid_type');
  }
  if (!id || !/^[A-Za-z0-9]+$/.test(id)) {
    return errorResponse(res, 400, 'invalid_id');
  }

  let token;
  try {
    token = await getSpotifyToken();
  } catch (err) {
    return errorResponse(res, 500, err.message || 'token_failed');
  }

  const headers = { Authorization: `Bearer ${token}` };

  try {
    if (type === 'track') {
      // --- Single Track ---
      const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${id}`, { headers });
      if (!trackRes.ok) {
        if (trackRes.status === 404) return errorResponse(res, 404, 'not_found_or_private');
        return errorResponse(res, trackRes.status, 'track_fetch_failed');
      }
      const trackData = await trackRes.json();
      const normalized = normalizeTrack(trackData);
      if (!normalized) return errorResponse(res, 404, 'not_found_or_private');

      return successResponse(res, {
        type,
        id,
        name: normalized.name,
        description: `By ${normalized.artists}`,
        coverArt: normalized.albumArt,
        totalTracks: 1,
        tracks: [normalized],
        hasMore: false,
        nextOffset: 0,
      });
    }

    if (type === 'playlist') {
      // --- Playlist ---
      // Fetch playlist metadata
      const metaRes = await fetch(
        `https://api.spotify.com/v1/playlists/${id}?fields=id,name,description,images,owner,followers,tracks(total)`,
        { headers }
      );
      if (!metaRes.ok) {
        if (metaRes.status === 404) return errorResponse(res, 404, 'not_found_or_private');
        return errorResponse(res, metaRes.status, 'playlist_meta_failed');
      }
      const meta = await metaRes.json();

      // Fetch one page of tracks
      const tracksPage = await fetchPlaylistTracksPage(id, token, offset, limit);

      const normalizedTracks = (tracksPage.items || [])
        .map((item) => item && item.track ? normalizeTrack(item.track) : null)
        .filter(Boolean);

      const totalTracks = tracksPage.total || 0;
      const nextOffset = offset + normalizedTracks.length;
      const hasMore = nextOffset < totalTracks;

      const coverArt =
        meta.images && meta.images[0] ? meta.images[0].url : '';

      return successResponse(res, {
        type,
        id,
        name: meta.name || 'Unnamed Playlist',
        description: meta.description || '',
        coverArt,
        totalTracks,
        tracks: normalizedTracks,
        hasMore,
        nextOffset,
      });
    }

    if (type === 'album') {
      // --- Album ---
      // Fetch album metadata (includes first page of tracks embedded)
      const metaRes = await fetch(`https://api.spotify.com/v1/albums/${id}`, { headers });
      if (!metaRes.ok) {
        if (metaRes.status === 404) return errorResponse(res, 404, 'not_found_or_private');
        return errorResponse(res, metaRes.status, 'album_meta_failed');
      }
      const meta = await metaRes.json();

      const albumInfo = {
        name: meta.name,
        images: meta.images,
      };

      if (offset === 0 && meta.tracks && meta.tracks.items) {
        // Use the embedded tracks from the album metadata for first page
        const embeddedItems = meta.tracks.items.slice(0, limit);
        const normalizedTracks = embeddedItems
          .map((t) => normalizeTrack(t, albumInfo))
          .filter(Boolean);

        const totalTracks = meta.tracks.total || normalizedTracks.length;
        const nextOffset = normalizedTracks.length;
        const hasMore = nextOffset < totalTracks;

        const coverArt = meta.images && meta.images[0] ? meta.images[0].url : '';

        return successResponse(res, {
          type,
          id,
          name: meta.name || 'Unnamed Album',
          description: `By ${(meta.artists || []).map((a) => a.name).join(', ')} · ${meta.release_date ? meta.release_date.substring(0, 4) : ''}`,
          coverArt,
          totalTracks,
          tracks: normalizedTracks,
          hasMore,
          nextOffset,
        });
      } else {
        // Subsequent pages: fetch from album tracks endpoint
        const tracksPage = await fetchAlbumTracksPage(id, token, offset, limit);
        const normalizedTracks = (tracksPage.items || [])
          .map((t) => normalizeTrack(t, albumInfo))
          .filter(Boolean);

        const totalTracks = tracksPage.total || 0;
        const nextOffset = offset + normalizedTracks.length;
        const hasMore = nextOffset < totalTracks;

        const coverArt = meta.images && meta.images[0] ? meta.images[0].url : '';

        return successResponse(res, {
          type,
          id,
          name: meta.name || 'Unnamed Album',
          description: `By ${(meta.artists || []).map((a) => a.name).join(', ')} · ${meta.release_date ? meta.release_date.substring(0, 4) : ''}`,
          coverArt,
          totalTracks,
          tracks: normalizedTracks,
          hasMore,
          nextOffset,
        });
      }
    }
  } catch (err) {
    if (err.status === 404) {
      return errorResponse(res, 404, 'not_found_or_private');
    }
    console.error('spotify-data handler error:', err.message);
    return errorResponse(res, 500, 'fetch_failed');
  }
};
