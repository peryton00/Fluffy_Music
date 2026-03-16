// src/js/lyrics.js — Lyrics fetching and synced highlight
// ES module. Both APIs are CORS-friendly, called directly from browser.

let syncedInterval = null;

/**
 * Fetches lyrics for a track.
 * Tries lrclib.net first, then lyrics.ovh as fallback.
 * @param {object} track - { name, artist, album, duration }
 * @returns {Promise<{type: string, lyrics?: string, source?: string}>}
 */
export async function fetchLyrics(track) {
  try {
    // ── STEP 1: Try lrclib.net ──────────────────────────────────────────────
    const durationSec = track.duration
      ? Math.floor(track.duration / 1000)
      : null;

    let lrcUrl =
      'https://lrclib.net/api/get' +
      '?artist_name=' +
        encodeURIComponent(track.artist || '') +
      '&track_name=' +
        encodeURIComponent(track.name || '');

    if (track.album &&
        track.album !== 'YouTube Radio') {
      lrcUrl += '&album_name=' +
        encodeURIComponent(track.album);
    }
    if (durationSec) {
      lrcUrl += '&duration=' + durationSec;
    }

    try {
      const res = await fetch(lrcUrl, {
        headers: {
          'User-Agent':
            'Fluffy Music/1.0 ' +
            '(https://fluffy-music.vercel.app)'
        }
      });

      if (res.ok) {
        const data = await res.json();

        if (data.instrumental === true) {
          return { type: 'instrumental' };
        }

        if (data.syncedLyrics &&
            data.syncedLyrics.trim().length > 0) {
          return {
            type: 'synced',
            lyrics: data.syncedLyrics,
            source: 'lrclib'
          };
        }

        if (data.plainLyrics &&
            data.plainLyrics.trim().length > 0) {
          return {
            type: 'plain',
            lyrics: data.plainLyrics,
            source: 'lrclib'
          };
        }
        // Both null/empty — fall through to step 2
      }
      // 404 or other error — fall through to step 2
    } catch (e) {
      // Fall through to step 2
    }

    // ── STEP 2: Try lyrics.ovh ──────────────────────────────────────────────
    try {
      const artist =
        encodeURIComponent(track.artist || 'Unknown');
      const title =
        encodeURIComponent(track.name || 'Unknown');
      const ovhUrl =
        `https://api.lyrics.ovh/v1/` +
        `${artist}/${title}`;

      const res = await fetch(ovhUrl);

      if (res.ok) {
        const data = await res.json();
        if (data.lyrics &&
            data.lyrics.trim().length > 0) {
          return {
            type: 'plain',
            lyrics: data.lyrics,
            source: 'lyrics.ovh'
          };
        }
      }
    } catch (e) {
      // Fall through to step 3
    }

    // ── STEP 3: Both failed ─────────────────────────────────────────────────
    return { type: 'not_found' };

  } catch (e) {
    return { type: 'not_found' };
  }
}

/**
 * Parses LRC format string into array of timed line objects.
 * LRC format: "[mm:ss.xx] Line text"
 * @param {string} lrcString
 * @returns {Array<{timeMs: number, text: string}>}
 */
export function parseSyncedLyrics(lrcString) {
  const timeRegex =
    /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

  return lrcString
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .reduce((acc, line) => {
      const match = line.match(timeRegex);
      if (match) {
        const mins = parseInt(match[1], 10);
        const secs = parseInt(match[2], 10);
        const ms = parseInt(
          match[3].padEnd(3, '0'), 10);
        const timeMs =
          (mins * 60 + secs) * 1000 + ms;
        const text = match[4].trim();
        if (text.length > 0) {
          acc.push({ timeMs, text });
        }
      }
      return acc;
    }, [])
    .sort((a, b) => a.timeMs - b.timeMs);
}

/**
 * Starts a polling interval that highlights the current synced lyric line.
 * @param {Array<{timeMs: number, text: string}>} lines
 * @param {Function} getCurrentTimeMs - Returns current playback position in ms
 * @param {Function} onLineChange - Called with (index, text) on line change
 */
export function startSyncedHighlight(
  lines, getCurrentTimeMs, onLineChange) {

  let lastIndex = -1;
  clearInterval(syncedInterval);

  syncedInterval = setInterval(() => {
    const currentMs = getCurrentTimeMs();
    let activeIndex = -1;

    for (let i = lines.length - 1;
         i >= 0; i--) {
      if (currentMs >= lines[i].timeMs) {
        activeIndex = i;
        break;
      }
    }

    if (activeIndex !== lastIndex) {
      lastIndex = activeIndex;
      onLineChange(
        activeIndex,
        activeIndex >= 0
          ? lines[activeIndex].text : '');
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
