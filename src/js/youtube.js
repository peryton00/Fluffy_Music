// src/js/youtube.js — YouTube IFrame Player management

import { FM } from './storage.js';

let ytPlayer = null;
let currentVideoId = null;
let playerReady = false;
let currentMode = FM.getMode();
let pendingVideoId = null;
let quotaExceeded = false;

// Callbacks registered from player.js
let onTrackEndedCallback = null;
let onPlayerStateChangeCallback = null;

/**
 * Dynamically loads the YouTube IFrame API script.
 * The global window.onYouTubeIframeAPIReady is called when ready.
 */
export function initYouTubeAPI() {
  if (document.getElementById('yt-api-script')) return;

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
    host: 'https://www.youtube-nocookie.com',
    events: {
      onReady: () => {
        playerReady = true;
        // Restore saved volume (force 100% on mobile/tablet where slider is often hidden)
        const savedVol = window.innerWidth <= 1024 ? 100 : FM.getVolume();
        ytPlayer.setVolume(savedVol);
        // Play any video that was queued while player was loading
        if (pendingVideoId) {
          ytPlayer.loadVideoById(pendingVideoId);
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
        if ([100, 101, 150].includes(event.data)) {
          if (onTrackEndedCallback) onTrackEndedCallback();
        }
      },
    },
  });
}

/**
 * Searches YouTube for the best matching video and plays it.
 * @param {string} trackName
 * @param {string} artist
 * @param {boolean} fallbackNoArtist - internal flag to retry without artist
 */
export async function searchAndPlay(trackName, artist, fallbackNoArtist = false) {
  if (quotaExceeded) {
    if (window.showToast) window.showToast('YouTube search limit reached. Try again tomorrow.', 'error');
    return;
  }

  const query = fallbackNoArtist
    ? encodeURIComponent(trackName)
    : encodeURIComponent(`${trackName} ${artist}`);

  const mode = FM.getMode();

  try {
    const res = await fetch(`/api/search-youtube?q=${query}&mode=${mode}`);
    const data = await res.json();

    if (res.status === 429) {
      quotaExceeded = true;
      if (window.showToast) window.showToast('YouTube search limit reached. Try again tomorrow.', 'error');
      return;
    }

    if (res.status === 404 || data.error) {
      if (!fallbackNoArtist) {
        // Retry without the artist name
        return searchAndPlay(trackName, artist, true);
      }
      if (window.showToast) {
        window.showToast(`Couldn't find "${trackName}", skipping...`, 'error');
      }
      if (onTrackEndedCallback) onTrackEndedCallback();
      return;
    }

    currentVideoId = data.videoId;
    loadVideo(data.videoId);
  } catch (err) {
    console.error('searchAndPlay error:', err.message);
    if (!fallbackNoArtist) {
      return searchAndPlay(trackName, artist, true);
    }
  }
}

/**
 * Loads a video into the YouTube player by ID.
 * Queues it if the player isn't ready yet.
 * @param {string} videoId
 */
export function loadVideo(videoId) {
  currentVideoId = videoId;
  if (playerReady && ytPlayer) {
    ytPlayer.loadVideoById(videoId);
  } else {
    pendingVideoId = videoId;
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
