// src/js/media-session.js — Media Session API for notification/lock screen controls
// Works on web, Android, and iOS via the browser's Media Session API.
// All APIs are gated behind feature detection so it fails silently on unsupported browsers.

import { playPause, nextTrack, prevTrack, seekToPercent } from './player.js';
import { getCurrentTime, getDuration } from './youtube.js';

let silentAudio = null;
let audioContext = null;
let silentBufferSource = null;
let wakeLock = null;
const silentAudioSrc = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";

const isSupported = 'mediaSession' in navigator;

/**
 * Initialize Media Session API action handlers.
 * Call once when the app loads. Enables notification bar/lock screen controls
 * and TWS earbuds gesture support (play/pause, next, previous).
 */
export function initMediaSession() {
  if (!isSupported) return;

  // Play
  navigator.mediaSession.setActionHandler('play', () => {
    playPause();
    setPlaybackState('playing');
  });

  // Pause
  navigator.mediaSession.setActionHandler('pause', () => {
    playPause();
    setPlaybackState('paused');
  });

  // Next track (double-tap on most TWS earbuds)
  navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());

  // Previous track (triple-tap on most TWS earbuds)
  navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());

  // Seek to position (e.g. scrubbing in notification shade)
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    const duration = getDuration();
    if (duration > 0 && details.seekTime !== undefined) {
      const pct = (details.seekTime / duration) * 100;
      seekToPercent(pct);
      updatePositionState();
    }
  });

  // Seek backward (10s by default, or device-defined offset)
  navigator.mediaSession.setActionHandler('seekbackward', (details) => {
    const skipTime = details.seekOffset || 10;
    const current = getCurrentTime();
    const duration = getDuration();
    if (duration > 0) {
      const pct = (Math.max(0, current - skipTime) / duration) * 100;
      seekToPercent(pct);
      updatePositionState();
    }
  });

  // Seek forward
  navigator.mediaSession.setActionHandler('seekforward', (details) => {
    const skipTime = details.seekOffset || 10;
    const current = getCurrentTime();
    const duration = getDuration();
    if (duration > 0) {
      const pct = (Math.min(duration, current + skipTime) / duration) * 100;
      seekToPercent(pct);
      updatePositionState();
    }
  });

  // SILENT AUDIO HACK: Create a silent audio element to "anchor" the media session
  // This is required on Android to show notifications for iframe-based players (YT).
  if (!silentAudio) {
    silentAudio = new Audio(silentAudioSrc);
    silentAudio.loop = true;
    silentAudio.volume = 0.001; // Near-silent but active session anchor
  }
}

/**
 * Re-attaches or restarts the Web Audio heartbeat to prevent tab suspension.
 */
function startAudioHeartbeat() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    if (!silentBufferSource) {
      // Create a 1-second silent buffer
      const buffer = audioContext.createBuffer(1, audioContext.sampleRate, audioContext.sampleRate);
      silentBufferSource = audioContext.createBufferSource();
      silentBufferSource.buffer = buffer;
      silentBufferSource.loop = true;
      
      // Connect to destination but at 0 volume (gain node for extra safety)
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.001; 
      
      silentBufferSource.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      silentBufferSource.start();
    }
  } catch (err) {
    console.warn('[MediaSession] Heartbeat failed:', err.message);
  }
}

/**
 * Update the Media Session metadata with the currently playing track.
 * Called every time a new track loads.
 * @param {object} track - { name, artist, album, albumArt }
 */
export function updateMediaSession(track) {
  if (!isSupported) return;
  if (!track) return;

  // Build artwork array — use album art if available, fall back to app icon
  let artwork = [];
  if (track.albumArt) {
    artwork = [
      { src: track.albumArt, sizes: '96x96',   type: 'image/jpeg' },
      { src: track.albumArt, sizes: '128x128',  type: 'image/jpeg' },
      { src: track.albumArt, sizes: '192x192',  type: 'image/jpeg' },
      { src: track.albumArt, sizes: '256x256',  type: 'image/jpeg' },
      { src: track.albumArt, sizes: '512x512',  type: 'image/jpeg' },
    ];
  } else {
    artwork = [
      { src: '/src/img/icon-512.png', sizes: '512x512', type: 'image/png' },
    ];
  }

  navigator.mediaSession.metadata = new MediaMetadata({
    title:  track.name   || 'Unknown Track',
    artist: track.artist || 'Unknown Artist',
    album:  track.album  || 'Fluffy Music',
    artwork,
  });

  navigator.mediaSession.playbackState = 'playing';
  updatePositionState();

  // Persist last played track so Capacitor's appStateChange can restore it
  try {
    localStorage.setItem('fm_last_played', JSON.stringify(track));
  } catch (_) {}
}

/**
 * Set the playback state shown in the notification shade.
 * @param {'playing' | 'paused' | 'none'} state
 */
export async function setPlaybackState(state) {
  if (!isSupported) return;
  navigator.mediaSession.playbackState = state;
  
  // Keep silent audio in sync to maintain notification visibility
  if (silentAudio) {
    if (state === 'playing') {
      silentAudio.play().catch(() => {});
      startAudioHeartbeat(); // Start Web Audio heartbeat
      requestWakeLock();
    } else if (state === 'none' || state === 'paused') {
      // Pause silent audio and release wake lock
      silentAudio.pause();
      releaseWakeLock();
    }
  }
}

/** 
 * Request a Screen Wake Lock to prevent the browser from throttling 
 * the tab's CPU/Network when in the background.
 */
async function requestWakeLock() {
  if (wakeLock || !('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch (err) {
    console.warn('[MediaSession] Wake Lock failed:', err.message);
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

/**
 * Update the position state (duration + current time shown on scrubber).
 * Wrapped in try/catch because older implementations may not support it.
 */
export function updatePositionState() {
  if (!isSupported) return;
  const duration = getDuration();
  if (duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate: 1,
      position: Math.min(getCurrentTime(), duration),
    });
  } catch (_) {
    // Silently ignore browsers that don't support setPositionState
  }
}

/**
 * Clear Media Session metadata and reset playback state.
 * Called when playback stops completely.
 */
export function clearMediaSession() {
  if (!isSupported) return;
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = 'none';
}
