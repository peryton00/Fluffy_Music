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

/**
 * Native scraping fallback using the public Spotify Embed Widget.
 * Bypasses the need for any API keys or Premium accounts.
 * Note: The embed widget returns ALL tracks at once (max ~100 for most playlists).
 * For playlists > 100 tracks, this is a known limitation.
 */
async function fetchSpotifyScrape(type, id, offset, limit) {
  const url = `https://open.spotify.com/embed/${type}/${id}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36' }
  });
  
  if (!res.ok) {
    throw new Error('scrape_failed');
  }

  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  
  if (!match) {
    throw new Error('scrape_parse_failed');
  }

  const data = JSON.parse(match[1]);
  const entity = data.props?.pageProps?.state?.data?.entity;
  
  if (!entity) {
    throw new Error('scrape_no_entity');
  }

  // Get the best cover art from the entity's visual identity
  const visualImages = entity.visualIdentity?.image || 
                       data.props?.pageProps?.state?.data?.visualIdentity?.image || [];
  const coverArt = entity.coverArt?.sources?.slice(-1)[0]?.url ||  // largest coverArt
                   visualImages.slice(-1)[0]?.url ||               // largest visual
                   entity.coverArt?.sources?.[0]?.url || '';

  if (type === 'track') {
    const artist = entity.artists && entity.artists.length > 0 ? entity.artists[0].name : 'Unknown Artist';
    const artists = entity.artists ? entity.artists.map(a => a.name).join(', ') : artist;
    // For a track, the cover art is the album art
    const albumArt = coverArt;

    const normalized = {
      id: entity.id,
      name: entity.title || entity.name,
      artist,
      artists,
      album: entity.album?.name || '',
      albumArt,
      duration: entity.duration || 0,
      spotifyId: entity.id,
    };

    return {
      type,
      id,
      name: normalized.name,
      description: `By ${normalized.artists}`,
      coverArt: albumArt,
      totalTracks: 1,
      tracks: [normalized],
      hasMore: false,
      nextOffset: 0,
    };
  }

  // Playlist or Album — trackList contains ALL tracks from the embed (up to ~100)
  const trackList = entity.trackList || [];
  const totalTracksFromEmbed = trackList.length;
  
  // The entity might also tell us the actual total on Spotify
  // (for playlists > 100, the embed widget truncates at 100)
  const totalTracks = totalTracksFromEmbed;
  
  // Paginate from what we have in-memory
  const pageTracks = trackList.slice(offset, offset + limit);
  
  const normalizedTracks = pageTracks.map(t => {
    // subtitle is the artist name(s) for playlist tracks
    const artists = t.subtitle || 'Unknown Artist';
    const artist = artists.split(',')[0].trim();
    
    // Get track-level cover art using the Spotify CDN image URL.
    // Spotify track thumbnails follow: https://i.scdn.co/image/{image_hash}
    // The embed doesn't give us per-track images for playlist items, so
    // we derive it from the audioPreview URL which contains the same image hash
    // pattern sometimes — but the most reliable fallback is the playlist cover.
    // For album tracks, all share the album art (coverArt).
    let albumArt = coverArt; // default to playlist/album cover
    if (t.coverArt?.sources?.length > 0) {
      albumArt = t.coverArt.sources.slice(-1)[0]?.url || t.coverArt.sources[0]?.url || coverArt;
    }
    
    // Extract the Spotify track ID from the URI (spotify:track:XXXX)
    const spotifyId = t.uri?.split(':').pop() || '';
    
    return {
      id: t.uid || spotifyId || t.id,
      name: t.title,
      artist,
      artists,
      album: type === 'album' ? (entity.name || entity.title) : '',
      albumArt,
      duration: t.duration || 0,
      spotifyId,
    };
  });

  const nextOffset = offset + normalizedTracks.length;
  const hasMore = nextOffset < totalTracks;
  const description = type === 'album' 
    ? `By ${entity.subtitle || ''}` 
    : (entity.description || entity.attributes?.find(a => a.key === 'episode_description')?.value || '');

  return {
    type,
    id,
    name: entity.title || entity.name || 'Unnamed',
    description,
    coverArt,
    totalTracks,
    tracks: normalizedTracks,
    hasMore,
    nextOffset,
  };
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

  let token = null;
  try {
    token = await getSpotifyToken();
  } catch (err) {
    // If getting token fails (e.g. missing credentials), we will just proceed without token to fallback
  }

  try {
    if (!token) {
      throw new Error('no_token');
    }

    const headers = { Authorization: `Bearer ${token}` };

    if (type === 'track') {
      // --- Single Track ---
      const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${id}`, { headers });
      if (!trackRes.ok) {
        if (trackRes.status === 404) return errorResponse(res, 404, 'not_found_or_private');
        throw new Error('track_fetch_failed');
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
        throw new Error('playlist_meta_failed');
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
        throw new Error('album_meta_failed');
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
    if (err.message === 'not_found_or_private') {
      return errorResponse(res, 404, 'not_found_or_private');
    }
    console.warn(`Standard API failed (${err.message}). Falling back to Embedded API...`);
    
    try {
      const scrapedData = await fetchSpotifyScrape(type, id, offset, limit);
      return successResponse(res, scrapedData);
    } catch (scrapeErr) {
      console.error('Scrape fallback error:', scrapeErr.message);
      return errorResponse(res, 500, 'fetch_failed_completely');
    }
  }
};
