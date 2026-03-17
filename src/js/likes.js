// src/js/likes.js — Liked Songs feature (Feature 1)
// Manages liked songs in localStorage and Firestore.

import { isLoggedIn, getCurrentUser } from './auth.js';

const LS_KEY = 'fm_liked_songs';

// ── Local Storage Helpers ─────────────────────────────────────────────────────

/**
 * Returns all liked songs sorted by likedAt descending.
 * @returns {Array}
 */
export function getLikedSongs() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = JSON.parse(raw || '[]');
    return arr.sort((a, b) => (b.likedAt || 0) - (a.likedAt || 0));
  } catch {
    return [];
  }
}

/**
 * Returns true if the trackId is in the liked songs list.
 * @param {string} trackId
 * @returns {boolean}
 */
export function isLiked(trackId) {
  const liked = getLikedSongs();
  return liked.some((t) => t.id === String(trackId));
}

// ── Like / Unlike ─────────────────────────────────────────────────────────────

/**
 * Toggles the like state for a track. Updates UI and Firestore.
 * @param {object} track - Normalized track object
 * @returns {Promise<boolean>} New liked state (true = liked)
 */
export async function toggleLike(track) {
  const wasLiked = isLiked(track.id);

  if (wasLiked) {
    unlikeTrack(track.id);
    if (window.showToast) window.showToast('Removed from Liked Songs', 'info');
  } else {
    likeTrack(track);
    if (window.showToast) window.showToast('Added to Liked Songs ♥', 'success');
  }

  // Update all heart buttons for this track on the page
  updateAllHeartButtons(track.id);

  return !wasLiked;
}

/**
 * Adds a track to liked songs in localStorage and optionally Firestore.
 * @param {object} track
 */
export function likeTrack(track) {
  const entry = {
    id: String(track.id),
    name: track.name || track.title || 'Unknown Track',
    artist: track.artist || track.channelName || 'Unknown Artist',
    artists: track.artists || track.artist || track.channelName || 'Unknown Artist',
    album: track.album || '',
    albumArt: track.albumArt || track.thumbnail || '',
    duration: track.duration || 0,
    spotifyId: track.spotifyId || null,
    likedAt: Date.now(),
  };

  const current = getLikedSongs();
  // Prevent duplicates
  if (current.some((t) => t.id === entry.id)) return;

  const updated = [entry, ...current];
  localStorage.setItem(LS_KEY, JSON.stringify(updated));

  // Update sidebar liked count badge
  updateLikedCountBadge();

  if (isLoggedIn()) {
    const user = getCurrentUser();
    saveToFirestore(user.uid, entry);
  }
}

/**
 * Removes a track from liked songs in localStorage and optionally Firestore.
 * @param {string} trackId
 */
export function unlikeTrack(trackId) {
  const current = getLikedSongs();
  const updated = current.filter((t) => t.id !== String(trackId));
  localStorage.setItem(LS_KEY, JSON.stringify(updated));

  // Update sidebar liked count badge
  updateLikedCountBadge();

  if (isLoggedIn()) {
    const user = getCurrentUser();
    deleteFromFirestore(user.uid, trackId);
  }
}

// ── Firestore ─────────────────────────────────────────────────────────────────

/**
 * Saves a liked track to Firestore.
 * @param {string} uid
 * @param {object} track
 */
async function saveToFirestore(uid, track) {
  try {
    const { db } = await import('./firebase.js');
    const { doc, setDoc } =
      await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const ref = doc(db, 'users', uid, 'liked', track.id);
    await setDoc(ref, track);
  } catch (err) {
    // Silent failure — localStorage is the source of truth
    console.warn('saveToFirestore (liked) error:', err.message);
  }
}

/**
 * Deletes a liked track from Firestore.
 * @param {string} uid
 * @param {string} trackId
 */
async function deleteFromFirestore(uid, trackId) {
  try {
    const { db } = await import('./firebase.js');
    const { doc, deleteDoc } =
      await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const ref = doc(db, 'users', uid, 'liked', String(trackId));
    await deleteDoc(ref);
  } catch (err) {
    console.warn('deleteFromFirestore (liked) error:', err.message);
  }
}

/**
 * Loads liked songs from Firestore, merges into localStorage, and returns them.
 * @param {string} uid
 * @returns {Promise<Array>}
 */
export async function loadLikedFromFirestore(uid) {
  try {
    const { db } = await import('./firebase.js');
    const { collection, getDocs, query, orderBy } =
      await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const ref = collection(db, 'users', uid, 'liked');
    const q = query(ref, orderBy('likedAt', 'desc'));
    const snapshot = await getDocs(q);

    const liked = [];
    snapshot.forEach((docSnap) => liked.push({ ...docSnap.data(), id: docSnap.id }));

    localStorage.setItem(LS_KEY, JSON.stringify(liked));
    updateLikedCountBadge();
    return liked;
  } catch (err) {
    console.warn('loadLikedFromFirestore error:', err.message);
    return getLikedSongs();
  }
}

// ── UI Helpers ────────────────────────────────────────────────────────────────

/**
 * Updates all heart buttons on the page for a given trackId.
 * @param {string} trackId
 */
export function updateAllHeartButtons(trackId) {
  const liked = isLiked(trackId);
  const btns = document.querySelectorAll(`.like-btn[data-track-id="${trackId}"]`);
  btns.forEach((btn) => {
    btn.innerHTML = `<i data-lucide="heart"></i>`;
    btn.title = liked ? 'Remove from Liked Songs' : 'Add to Liked Songs';
    btn.setAttribute('aria-label', liked ? 'Remove from Liked Songs' : 'Add to Liked Songs');
    if (liked) {
      btn.classList.add('liked');
    } else {
      btn.classList.remove('liked');
    }
  });
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Updates the liked songs count badge in the sidebar.
 */
export function updateLikedCountBadge() {
  const badge = document.getElementById('liked-songs-count');
  if (badge) {
    const count = getLikedSongs().length;
    badge.textContent = count > 0 ? String(count) : '';
    badge.style.display = count > 0 ? '' : 'none';
  }
}

// Register on window for cross-module access
window.updateLikedCountBadge = updateLikedCountBadge;
