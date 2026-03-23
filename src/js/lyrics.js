// src/js/lyrics.js — Lyrics fetching and synced highlight
// ES module. Fallback chain: lrclib.net → JioSaavn (via /api proxy) → Genius (via /api proxy)

let syncedInterval = null;

/**
 * Fetches lyrics for a track.
 * Fallback chain: lrclib.net → JioSaavn (saavn.dev) → Genius (metadata link)
 * @param {object} track - { name, artist, album, duration }
 * @returns {Promise<{type: string, lyrics?: string, source?: string, url?: string}>}
 */
export async function fetchLyrics(track) {
  try {

    // ── STEP 1: Try lrclib.net (synced + plain) ──────────────────────────────
    const durationSec = track.duration
      ? Math.floor(track.duration / 1000)
      : null;

    let lrcUrl =
      'https://lrclib.net/api/get' +
      '?artist_name=' + encodeURIComponent(track.artist || '') +
      '&track_name=' + encodeURIComponent(track.name || '');

    if (track.album && track.album !== 'YouTube Radio') {
      lrcUrl += '&album_name=' + encodeURIComponent(track.album);
    }
    if (durationSec) {
      lrcUrl += '&duration=' + durationSec;
    }

    try {
      const res = await fetch(lrcUrl, {
        headers: { 'User-Agent': 'Fluffy Music/1.0 (https://fluffy-music.vercel.app)' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.instrumental === true) return { type: 'instrumental' };
        if (data.syncedLyrics && data.syncedLyrics.trim().length > 0) {
          return { type: 'synced', lyrics: data.syncedLyrics, source: 'lrclib' };
        }
        if (data.plainLyrics && data.plainLyrics.trim().length > 0) {
          return { type: 'plain', lyrics: data.plainLyrics, source: 'lrclib' };
        }
      }
    } catch (e) { /* fall through */ }

    // ── STEP 1b: Retry lrclib with cleaned name (strips YouTube title junk) ──
    const cleanName = cleanTrackName(track.name);
    if (cleanName !== track.name) {
      let lrcUrlClean =
        'https://lrclib.net/api/get' +
        '?artist_name=' + encodeURIComponent(track.artist || '') +
        '&track_name=' + encodeURIComponent(cleanName);
      if (durationSec) lrcUrlClean += '&duration=' + durationSec;
      try {
        const res2 = await fetch(lrcUrlClean, {
          headers: { 'User-Agent': 'Fluffy Music/1.0 (https://fluffy-music.vercel.app)' }
        });
        if (res2.ok) {
          const data2 = await res2.json();
          if (data2.instrumental === true) return { type: 'instrumental' };
          if (data2.syncedLyrics?.trim().length > 0)
            return { type: 'synced', lyrics: data2.syncedLyrics, source: 'lrclib' };
          if (data2.plainLyrics?.trim().length > 0)
            return { type: 'plain', lyrics: data2.plainLyrics, source: 'lrclib' };
        }
      } catch (e) { /* fall through */ }
    }

    // ── STEP 2: Try JioSaavn via /api/jiosaavn-search proxy ──────────────────
    try {
      const saavnResult = await fetchJioSaavnLyrics(track);
      if (saavnResult) return saavnResult;
    } catch (e) { /* fall through */ }

    // ── STEP 3: Try Genius via /api/genius-search proxy ──────────────────────
    try {
      const geniusResult = await fetchGeniusLink(track);
      if (geniusResult) return geniusResult;
    } catch (e) { /* fall through */ }

    // ── All sources failed ───────────────────────────────────────────────────
    return { type: 'not_found' };

  } catch (e) {
    return { type: 'not_found' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Clean track name for better search results
// Strips YouTube-style suffixes like "(Official Video)", "| Artist", etc.
// ─────────────────────────────────────────────────────────────────────────────
function cleanTrackName(name) {
  return (name || '')
    .replace(/\s*[\|\–\-]\s*.*/g, '')           // strip " | foo" or " – foo" onwards
    .replace(/\s*\(official\s*(video|audio|lyric(s)?|music video)\s*\)/gi, '')
    .replace(/\s*\[official\s*(video|audio|lyric(s)?|music video)\s*\]/gi, '')
    .replace(/\s*\(feat\..*?\)/gi, '')
    .replace(/\s*\(ft\..*?\)/gi, '')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: JioSaavn via /api/jiosaavn-search proxy (avoids CORS)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchJioSaavnLyrics(track) {
  const cleanName = cleanTrackName(track.name);
  const artist = encodeURIComponent(track.artist || '');
  const title = encodeURIComponent(cleanName);

  try {
    const res = await fetch(`/api/jiosaavn-search?title=${title}&artist=${artist}`, {
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.lyrics && data.lyrics.trim().length > 0) {
      return { type: 'plain', lyrics: data.lyrics, source: 'jiosaavn' };
    }
  } catch (e) { /* fall through */ }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Genius via /api/genius-search proxy (avoids CORS)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchGeniusLink(track) {
  const cleanName = cleanTrackName(track.name);
  const q = encodeURIComponent(`${cleanName} ${track.artist || ''}`);

  try {
    const res = await fetch(`/api/genius-search?q=${q}`, {
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.response?.hits?.[0]?.result;
    if (!hit) return null;
    return {
      type: 'genius_link',
      title: hit.full_title,
      url: hit.url,
      thumbnail: hit.song_art_image_thumbnail_url,
      source: 'genius'
    };
  } catch (e) {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LRC Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses LRC format string into array of timed line objects.
 * @param {string} lrcString
 * @returns {Array<{timeMs: number, text: string}>}
 */
export function parseSyncedLyrics(lrcString) {
  const timeRegex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

  return lrcString
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .reduce((acc, line) => {
      const match = line.match(timeRegex);
      if (match) {
        const mins = parseInt(match[1], 10);
        const secs = parseInt(match[2], 10);
        const ms = parseInt(match[3].padEnd(3, '0'), 10);
        const timeMs = (mins * 60 + secs) * 1000 + ms;
        const text = match[4].trim();
        if (text.length > 0) acc.push({ timeMs, text });
      }
      return acc;
    }, [])
    .sort((a, b) => a.timeMs - b.timeMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// Synced Highlight
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Starts a polling interval that highlights the current synced lyric line.
 * @param {Array<{timeMs: number, text: string}>} lines
 * @param {Function} getCurrentTimeMs
 * @param {Function} onLineChange
 */
export function startSyncedHighlight(lines, getCurrentTimeMs, onLineChange) {
  let lastIndex = -1;
  clearInterval(syncedInterval);

  syncedInterval = setInterval(() => {
    const currentMs = getCurrentTimeMs();
    let activeIndex = -1;

    for (let i = lines.length - 1; i >= 0; i--) {
      if (currentMs >= lines[i].timeMs) {
        activeIndex = i;
        break;
      }
    }

    if (activeIndex !== lastIndex) {
      lastIndex = activeIndex;
      onLineChange(
        activeIndex,
        activeIndex >= 0 ? lines[activeIndex].text : ''
      );
    }
  }, 200);
}

/**
 * Stops the synced highlight interval.
 */
export function stopSyncedHighlight() {
  clearInterval(syncedInterval);
  syncedInterval = null;
}
