/* src/js/player.js — Music player state and controls */

import * as YT from './youtube.js';
import { FM } from './storage.js';
import { isLoggedIn, getCurrentUser } from './auth.js';
import { updateLastPlayedCloud } from './sync.js';
import {
  updateMediaSession,
  setPlaybackState,
  updatePositionState,
  clearMediaSession
} from './media-session.js';

let currentTrack = null;
let currentQueue = [];
let currentIndex = 0;
let isShuffled = false;
let shuffledQueue = [];
let repeatMode = 'none'; // 'none' | 'all' | 'one'
let progressInterval = null;
let isDraggingProgress = false;

// ── Track Loading ─────────────────────────────────────────────────────────────

/**
 * Loads a track, updates player UI, and triggers YouTube search + play.
 * @param {object} track - Normalized track object
 * @param {Array} queue - Full track list
 * @param {number} index - Track's index in queue
 * @param {object} options - { autoPlay: true }
 */
export async function loadTrack(track, queue = [], index = 0, options = { autoPlay: true }) {
  const isNewQueue = queue && queue !== currentQueue && queue.length > 0;

  currentTrack = track;
  currentQueue = queue;
  currentIndex = index;

  if (isShuffled) {
    if (isNewQueue) {
      generateShuffledQueue(track);
    } else {
      // If same queue but a specific track was picked, 
      // we should probably make it the "current" in the existing shuffled queue
      const sIdx = shuffledQueue.findIndex(t => t.id === track.id);
      if (sIdx > -1) currentIndex = sIdx;
      else generateShuffledQueue(track);
    }
  }

  // Update player bar immediately (don't wait for YouTube)
  if (window.updatePlayerBar) window.updatePlayerBar(track);
  if (window.highlightCurrentTrack) window.highlightCurrentTrack(track.id);

  // Update document title
  document.title = `${track.name} – ${track.artist} | Fluffy Music`;

  // Update Media Session (notification bar, lock screen, earbuds)
  updateMediaSession(track);

  // Save last played (if autoPlaying, we update storage)
  if (options.autoPlay) {
    FM.setLastPlayed(track);
    FM.addRecentTrack(track);
    FM.setLastIndex(index);

    // Update Firestore last played if logged in
    if (isLoggedIn()) {
      const user = getCurrentUser();
      updateLastPlayedCloud(user.uid, track.spotifyId).catch(() => { });
    }
  }

  // Tell YouTube to search and play
  if (track.album === 'YouTube Radio') {
    if (options.autoPlay) YT.loadVideo(track.id);
    else YT.cueVideo(track.id);
  } else {
    // Pass current queue IDs to protect them from cache eviction
    const protectedIds = currentQueue.map(t => t.id).filter(Boolean);
    import('./yt-cache.js').then(Cache => {
      Cache.checkCacheSize(protectedIds);
    });

    const video = await YT.searchAndPlay(track.name, track.artist, { autoPlay: options.autoPlay });

    // Update track artwork from YouTube thumbnail if available
    if (video && video.thumbnail) {
      track.albumArt = video.thumbnail;
      if (window.updatePlayerBar) window.updatePlayerBar(track);
    }

    // Preload next track in background
    const queueForPreload = isShuffled ? shuffledQueue : currentQueue;
    const nextPreloadIndex = currentIndex + 1;
    if (nextPreloadIndex < queueForPreload.length) {
      const nextTrackObj = queueForPreload[nextPreloadIndex];
      if (nextTrackObj && nextTrackObj.album !== 'YouTube Radio') {
        import('./youtube.js').then(YTmod => {
          YTmod.preloadNextTrack(nextTrackObj.name, nextTrackObj.artist).catch(() => {});
        }).catch(() => {});
      }
    }
  }

  // Start progress updates
  startProgressInterval();
}

// ── Controls ──────────────────────────────────────────────────────────────────

/**
 * Toggles play/pause. Updates button UI.
 */
export function playPause() {
  const state = YT.getPlayerState();
  // YT.PlayerState: PLAYING = 1, PAUSED = 2, BUFFERING = 3
  if (state === 1 || state === 3) {
    YT.pause();
    setPlayButtonState(false);
    pauseMusicBars();
  } else {
    YT.play();
    setPlayButtonState(true);
    resumeMusicBars();
    console.log("Play button clicked");
  }
}

/**
 * Skips to the next track, respecting repeat and shuffle settings.
 */
export function nextTrack() {
  if (repeatMode === 'one') {
    YT.seekTo(0);
    YT.play();
    return;
  }

  const queue = isShuffled ? shuffledQueue : currentQueue;
  let nextIndex = currentIndex + 1;

  if (nextIndex >= queue.length) {
    if (repeatMode === 'all') {
      nextIndex = 0;
    } else {
      setPlayButtonState(false);
      pauseMusicBars();
      return;
    }
  }

  currentIndex = nextIndex;
  const track = queue[nextIndex];
  if (track) loadTrack(track, queue, nextIndex);
}

/**
 * Goes to the previous track, or restarts current if > 3 seconds in.
 */
export function prevTrack() {
  const currentTime = YT.getCurrentTime();
  if (currentTime > 3) {
    YT.seekTo(0);
    return;
  }

  const queue = isShuffled ? shuffledQueue : currentQueue;
  let prevIndex = currentIndex - 1;
  if (prevIndex < 0) prevIndex = repeatMode === 'all' ? queue.length - 1 : 0;

  currentIndex = prevIndex;
  const track = queue[prevIndex];
  if (track) loadTrack(track, queue, prevIndex);
}

/**
 * Toggles shuffle mode on/off.
 */
export function toggleShuffle() {
  isShuffled = !isShuffled;

  if (isShuffled) {
    generateShuffledQueue(currentTrack);
  }

  const shuffleBtn = document.getElementById('btn-shuffle');
  if (shuffleBtn) {
    shuffleBtn.classList.toggle('active', isShuffled);
    shuffleBtn.setAttribute('title', isShuffled ? 'Shuffle: On' : 'Shuffle: Off');
  }
}

/**
 * Generates a new shuffled queue starting with the current track.
 * @param {object} startTrack
 */
function generateShuffledQueue(startTrack) {
  shuffledQueue = [...currentQueue];
  // Fisher-Yates shuffle
  for (let i = shuffledQueue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledQueue[i], shuffledQueue[j]] = [shuffledQueue[j], shuffledQueue[i]];
  }
  // Keep start track first
  if (startTrack) {
    const currIdx = shuffledQueue.findIndex((t) => t.id === startTrack.id);
    if (currIdx > -1) {
      shuffledQueue.splice(currIdx, 1);
      shuffledQueue.unshift(startTrack);
    }
  }
  currentIndex = 0;
}

/**
 * Cycles repeat mode: none → all → one → none.
 */
export function toggleRepeat() {
  const modes = ['none', 'all', 'one'];
  repeatMode = modes[(modes.indexOf(repeatMode) + 1) % modes.length];

  const repeatBtn = document.getElementById('btn-repeat');
  if (repeatBtn) {
    repeatBtn.classList.toggle('active', repeatMode !== 'none');
    repeatBtn.setAttribute('data-mode', repeatMode);

    const iconName = repeatMode === 'one' ? 'repeat-1' : 'repeat';
    repeatBtn.innerHTML = `<i data-lucide="${iconName}" style="width:18px;height:18px;"></i>`;
    if (window.lucide) window.lucide.createIcons();

    repeatBtn.setAttribute('title', `Repeat: ${repeatMode}`);
  }
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

/**
 * Starts the interval that updates the progress bar every 500ms.
 */
export function startProgressInterval() {
  if (progressInterval) clearInterval(progressInterval);
  progressInterval = setInterval(updateProgressBar, 500);
}

/**
 * Updates the progress bar fill and time displays.
 */
export function updateProgressBar() {
  if (isDraggingProgress) return;

  const current = YT.getCurrentTime();
  const duration = YT.getDuration();

  const progressFill = document.getElementById('progress-fill');
  const progressThumb = document.getElementById('progress-thumb');
  const timeCurrentEl = document.getElementById('time-current');
  const timeTotalEl = document.getElementById('time-total');

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  if (progressFill) progressFill.style.width = `${pct}%`;
  if (progressThumb) progressThumb.style.left = `${pct}%`;
  if (timeCurrentEl) timeCurrentEl.textContent = formatTime(current * 1000);
  if (timeTotalEl) timeTotalEl.textContent = formatTime(duration * 1000);
}

/**
 * Seeks to a percentage of the track duration.
 * Called when user clicks/drags the progress bar.
 * @param {number} pct - 0 to 100
 */
export function seekToPercent(pct) {
  const duration = YT.getDuration();
  if (duration > 0) {
    YT.seekTo((pct / 100) * duration);
  }

  const progressFill = document.getElementById('progress-fill');
  const progressThumb = document.getElementById('progress-thumb');
  if (progressFill) progressFill.style.width = `${pct}%`;
  if (progressThumb) progressThumb.style.left = `${pct}%`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Converts milliseconds to "m:ss" format.
 * @param {number} ms
 * @returns {string}
 */
export function formatTime(ms) {
  if (!ms || isNaN(ms)) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Updates the play/pause button icon. */
function setPlayButtonState(isPlaying) {
  const btn = document.getElementById('btn-play');
  if (!btn) return;
  const iconName = isPlaying ? 'pause' : 'play';
  btn.innerHTML = `<i data-lucide="${iconName}" style="width:20px;height:20px;"></i>`;
  if (window.lucide) window.lucide.createIcons();
  btn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  console.log("Play button state changed to: ", isPlaying);
}

/** Pauses the music bars animation. */
function pauseMusicBars() {
  document.querySelectorAll('.music-bars').forEach((el) => el.classList.add('paused'));
}

/** Resumes the music bars animation. */
function resumeMusicBars() {
  document.querySelectorAll('.music-bars').forEach((el) => el.classList.remove('paused'));
}

// Register YT callbacks
YT.onTrackEnded(nextTrack);
YT.onStateChange((state) => {
  // 1 = playing, 2 = paused, 3 = buffering, 5 = cued
  const isPlaying = state === 1 || state === 3;
  setPlayButtonState(isPlaying);
  if (isPlaying) {
    resumeMusicBars();
    setPlaybackState('playing');
    updatePositionState();
  } else {
    pauseMusicBars();
    setPlaybackState('paused');
  }
});

// Exported getters for app.js
export function getCurrentTrack() { return currentTrack; }
export function getQueue() { return currentQueue; }
export function getIndex() { return currentIndex; }
export function getRepeatMode() { return repeatMode; }
export function getIsShuffled() { return isShuffled; }
export function setIsDraggingProgress(val) { isDraggingProgress = val; }
