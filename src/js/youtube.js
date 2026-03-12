// src/js/youtube.js — YouTube IFrame Player management

import { FM } from './storage.js';
import {
  getFromCache,
  saveToCache,
  cleanExpiredEntries
} from './yt-cache.js';

let ytPlayer = null;
let currentVideoId = null;
let playerReady = false;
let pendingVideoId = null;
let quotaExceeded = false;
let resultQueue = [];
let currentResultIndex = 0;
let currentSearchQuery = '';

function isQuotaExceeded() {
  if (quotaExceeded) return true;
  const expiry = localStorage.getItem('fm_yt_quota_expiry');
  if (expiry) {
    if (Date.now() < parseInt(expiry)) {
      quotaExceeded = true;
      return true;
    } else {
      localStorage.removeItem('fm_yt_quota_expiry');
    }
  }
  return false;
}

function setQuotaExceeded() {
  quotaExceeded = true;
  // Set expiry to midnight
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  localStorage.setItem('fm_yt_quota_expiry', midnight.getTime().toString());
}


const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.garudalinux.org',
  'https://api.piped.projectsegfau.lt'
];

const INVIDIOUS_INSTANCES = [
  'https://invidious.snopyta.org',
  'https://invidious.kavin.rocks',
  'https://y.com.sb'
];

// Callbacks registered from player.js
let onTrackEndedCallback = null;
let onPlayerStateChangeCallback = null;

/**
 * Dynamically loads the YouTube IFrame API script.
 * The global window.onYouTubeIframeAPIReady is called when ready.
 */
export function initYouTubeAPI() {
  if (document.getElementById('yt-api-script')) return;

  // Clean expired cache entries on startup
  cleanExpiredEntries();

  window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

  const tag = document.createElement('script');
  tag.id = 'yt-api-script';
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

/**
 * Called automatically by the YouTube IFrame API when loaded.
 * Creates the hidden YT.Player instance.
 */
function onYouTubeIframeAPIReady() {
  const container = document.getElementById('yt-player-container');
  if (!container) {
    console.error('yt-player-container not found in DOM');
    return;
  }

  ytPlayer = new window.YT.Player('yt-player-container', {
    width: '100%',
    height: '100%',
    videoId: '',
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      modestbranding: 1,
      rel: 0,
      iv_load_policy: 3,
      fs: 0,
      origin: window.location.origin,
    },
    events: {
      onReady: () => {
        playerReady = true;
        // Restore saved volume (force 100% on mobile/tablet where slider is often hidden)
        const savedVol = window.innerWidth <= 1024 ? 100 : FM.getVolume();
        ytPlayer.setVolume(savedVol);
        // Play/Cue any video that was queued while player was loading
        if (pendingVideoId) {
          if (window._ytLoadMethod === 'cue') {
            ytPlayer.cueVideoById(pendingVideoId);
          } else {
            ytPlayer.loadVideoById(pendingVideoId);
          }
          pendingVideoId = null;
        }
      },
      onStateChange: (event) => {
        if (onPlayerStateChangeCallback) {
          onPlayerStateChangeCallback(event.data);
        }
        // YT.PlayerState.ENDED = 0
        if (event.data === window.YT.PlayerState.ENDED) {
          if (onTrackEndedCallback) onTrackEndedCallback();
        }
      },
      onError: (event) => {
        const errorCodes = {
          2: 'Invalid video ID',
          5: 'HTML5 player error',
          100: 'Video not found or private',
          101: 'Embedding disabled',
          150: 'Embedding disabled',
        };
        const msg = errorCodes[event.data] || `YT error ${event.data}`;
        console.warn('YouTube player error:', msg);
        // Trigger next track on unrecoverable errors
        if ([2, 5, 100, 101, 150].includes(event.data)) {
          // Try next result in queue before skipping track
          tryNextResult();
        }
      },
    },
  });
}

/**
 * Searches YouTube for the best matching video and plays it (or cues it).
 * @param {string} trackName
 * @param {string} artist
 * @param {object} options - { autoPlay: true }
 */
export async function searchAndPlay(trackName, artist, options = { autoPlay: true }) {
  // Step 1: Check client-side cache first
  const cached = getFromCache(trackName, artist);
  if (cached) {
    resultQueue = [cached];
    currentResultIndex = 0;
    currentVideoId = cached.videoId;
    if (options.autoPlay) {
      loadVideo(cached.videoId);
    } else {
      cueVideo(cached.videoId);
    }
    return cached;
  }

  // Step 2: Build search query
  const query = `${trackName} ${artist} audio`;
  currentSearchQuery = query;

  // Step 3: Fetch top 15 results
  const results = await fetchTop15Results(query);

  if (!results || results.length === 0) {
    if (window.showToast) {
      window.showToast(
        `Couldn't find "${trackName}", skipping...`,
        'error'
      );
    }
    if (onTrackEndedCallback) onTrackEndedCallback();
    return null;
  }

  // Step 4: Score and rank results
  const scored = scoreResults(results, trackName, artist);
  resultQueue = scored;
  currentResultIndex = 0;

  // Step 5: Play best result + cache it
  const best = resultQueue[0];
  currentVideoId = best.videoId;
  saveToCache(trackName, artist, best);
  if (options.autoPlay) {
    loadVideo(best.videoId);
  } else {
    cueVideo(best.videoId);
  }
  return best;
}

export function tryNextResult() {
  currentResultIndex++;
  if (currentResultIndex < resultQueue.length) {
    const next = resultQueue[currentResultIndex];
    currentVideoId = next.videoId;
    loadVideo(next.videoId);
  } else {
    // All results exhausted
    if (onTrackEndedCallback) onTrackEndedCallback();
  }
}

async function fetchTop15Results(query) {
  const encoded = encodeURIComponent(query);

  // Try Piped first (via backend proxy)
  try {
    const res = await fetch(
      `/api/search-youtube?q=${encoded}&source=piped`
    );
    if (res.ok) {
      const data = await res.json();
      if (!data.error && data.results?.length > 0) {
        return data.results;
      }
    }
  } catch (e) {
    console.warn('Piped search failed:', e.message);
  }

  // Try Invidious (via backend proxy)
  try {
    const res = await fetch(
      `/api/search-youtube?q=${encoded}&source=invidious`
    );
    if (res.ok) {
      const data = await res.json();
      if (!data.error && data.results?.length > 0) {
        return data.results;
      }
    }
  } catch (e) {
    console.warn('Invidious search failed:', e.message);
  }

  // Fall back to YouTube Data API v3 if not already exceeded
  if (!isQuotaExceeded()) {
    try {
      const res = await fetch(
        `/api/search-youtube?q=${encoded}&source=youtube`
      );
      if (res.status === 429) {
        setQuotaExceeded();
        // Silent transition - don't show toast, try ytsearch next
      } else if (res.ok) {
        const data = await res.json();
        if (!data.error && data.results?.length > 0) {
          return data.results;
        }
      }
    } catch (e) {
      console.warn('YouTube API search failed:', e.message);
    }
  }

  // Final silent fallback: Free scraper (yt-search)
  try {
    const res = await fetch(
      `/api/search-youtube?q=${encoded}&source=ytsearch`
    );
    if (res.ok) {
      const data = await res.json();
      if (!data.error && data.results?.length > 0) {
        return data.results;
      }
    }
  } catch (e) {
    console.error('Final search fallback failed:', e.message);
  }

  return [];
}

function scoreResults(results, trackName, artist) {
  const trackLower = trackName.toLowerCase();
  const artistLower = artist.toLowerCase();

  const scored = results.map(item => {
    const titleLower = item.title.toLowerCase();
    const channelLower = item.channelName.toLowerCase();
    let score = 0;

    // Title matching (max 40 points)
    if (titleLower.includes(trackLower) &&
        titleLower.includes(artistLower)) {
      score += 40;
    } else if (titleLower.includes(trackLower)) {
      score += 25;
    } else if (titleLower.includes(artistLower)) {
      score += 10;
    }

    // Channel matching (max 20 points)
    if (channelLower.includes(artistLower)) {
      score += 20;
    } else if (channelLower.includes('vevo') ||
               channelLower.includes('official')) {
      score += 10;
    }

    // Title quality (max 20 points)
    if (titleLower.includes('audio') ||
        titleLower.includes('lyrics')) {
      score += 20;
    }
    if (titleLower.includes('cover')) score -= 20;
    if (titleLower.includes('karaoke')) score -= 20;
    if (titleLower.includes('remix') &&
        !trackLower.includes('remix')) score -= 20;
    if (titleLower.includes(' live')) score -= 15;
    if (titleLower.includes('reaction')) score -= 10;
    if (titleLower.includes('tutorial')) score -= 10;

    // Duration scoring (max 20 points)
    const dur = item.duration || 0;
    if (dur > 0) {
      if (dur >= 120 && dur <= 480) score += 20;
      else if (dur >= 60 && dur <= 600) score += 10;
      else if (dur < 60) score -= 10;
      else if (dur > 600) score -= 10;
    }

    return { ...item, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * Loads a video into the YouTube player by ID (starts playback).
 * @param {string} videoId
 */
export function loadVideo(videoId) {
  currentVideoId = videoId;
  if (playerReady && ytPlayer) {
    ytPlayer.loadVideoById(videoId);
  } else {
    pendingVideoId = videoId;
    // Set internal state to load when ready
    window._ytLoadMethod = 'load';
  }
}

/**
 * Cues a video into the YouTube player by ID (pre-loads without playing).
 * @param {string} videoId
 */
export function cueVideo(videoId) {
  currentVideoId = videoId;
  if (playerReady && ytPlayer) {
    ytPlayer.cueVideoById(videoId);
  } else {
    pendingVideoId = videoId;
    window._ytLoadMethod = 'cue';
  }
}





// ── Player Control Wrappers ───────────────────────────────────────────────────

/** @returns {number} YouTube player state (-1 if not ready) */
export function getPlayerState() {
  return playerReady && ytPlayer ? ytPlayer.getPlayerState() : -1;
}

/** @returns {number} Current playback time in seconds */
export function getCurrentTime() {
  return playerReady && ytPlayer ? ytPlayer.getCurrentTime() : 0;
}

/** @returns {number} Total video duration in seconds */
export function getDuration() {
  return playerReady && ytPlayer ? ytPlayer.getDuration() : 0;
}

/** Seek to a specific time. */
export function seekTo(seconds) {
  if (playerReady && ytPlayer) ytPlayer.seekTo(seconds, true);
}

/**
 * Sets the player volume and saves preference.
 * On mobile/tablet screens (<= 1024px), forces 100% internal volume 
 * so users can rely on hardware volume buttons instead.
 * @param {number} level - 0-100
 */
export function setVolume(level) {
  const actualLevel = window.innerWidth <= 1024 ? 100 : level;
  if (playerReady && ytPlayer) ytPlayer.setVolume(actualLevel);
  FM.setVolume(level);
}

export function play() {
  if (playerReady && ytPlayer) ytPlayer.playVideo();
}

export function pause() {
  if (playerReady && ytPlayer) ytPlayer.pauseVideo();
}

/** Register callbacks from player.js */
export function onTrackEnded(cb) { onTrackEndedCallback = cb; }
export function onStateChange(cb) { onPlayerStateChangeCallback = cb; }

/** Expose current mode (always 'audio') */
export function getMode() { return 'audio'; }
