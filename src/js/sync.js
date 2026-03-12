// src/js/sync.js — Firestore read/write for cross-device library sync

import { db } from './firebase.js';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { FM } from './storage.js';
import { isLoggedIn, getCurrentUser } from './auth.js';

// ── Firestore Operations ──────────────────────────────────────────────────────

/**
 * Loads all saved links for a user from Firestore.
 * Syncs to localStorage and triggers UI re-render.
 * @param {string} uid - Firebase user UID
 * @returns {Array} Array of link objects
 */
export async function loadUserLibrary(uid) {
  try {
    const libRef = collection(db, 'users', uid, 'library');
    const q = query(libRef, orderBy('addedAt', 'desc'));
    const snapshot = await getDocs(q);

    const links = [];
    snapshot.forEach((docSnap) => {
      links.push({ ...docSnap.data(), spotifyId: docSnap.id });
    });

    // Sync to localStorage
    FM.setSavedLinks(links);

    // Re-render the sidebar
    if (window.renderSavedLinks) {
      window.renderSavedLinks(links);
    }

    return links;
  } catch (err) {
    console.error('loadUserLibrary error:', err.message);
    // Transparent fallback — use localStorage silently
    return FM.getSavedLinks();
  }
}

/**
 * Saves a link to Firestore (merge: creates or updates).
 * @param {string} uid
 * @param {object} linkData
 */
export async function saveToCloud(uid, linkData) {
  try {
    const docRef = doc(db, 'users', uid, 'library', linkData.spotifyId);
    await setDoc(
      docRef,
      {
        ...linkData,
        addedAt: linkData.addedAt || serverTimestamp(),
        lastPlayedAt: linkData.lastPlayedAt || null,
      },
      { merge: true }
    );
  } catch (err) {
    console.error('saveToCloud error:', err.message);
    // Silent failure — localStorage already has the data
  }
}

/**
 * Removes a link from Firestore.
 * @param {string} uid
 * @param {string} spotifyId
 */
export async function removeFromCloud(uid, spotifyId) {
  try {
    const docRef = doc(db, 'users', uid, 'library', spotifyId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('removeFromCloud error:', err.message);
  }
}

/**
 * Updates the lastPlayedAt timestamp in Firestore.
 * @param {string} uid
 * @param {string} spotifyId
 */
export async function updateLastPlayedCloud(uid, spotifyId) {
  try {
    const docRef = doc(db, 'users', uid, 'library', spotifyId);
    await updateDoc(docRef, { lastPlayedAt: serverTimestamp() });
  } catch (err) {
    // Not critical — ignore silently
  }
}

// ── localStorage Operations ───────────────────────────────────────────────────

/**
 * Saves a link to localStorage. Prevents duplicate spotifyId.
 * @param {object} linkData
 * @returns {boolean} true if saved, false if duplicate
 */
export function saveToLocal(linkData) {
  const links = FM.getSavedLinks();
  const exists = links.some((l) => l.spotifyId === linkData.spotifyId);
  if (exists) return false;

  const updated = [{ ...linkData, addedAt: Date.now() }, ...links].slice(0, 50);
  FM.setSavedLinks(updated);
  return true;
}

/**
 * Removes a link from localStorage by spotifyId.
 * @param {string} spotifyId
 */
export function removeFromLocal(spotifyId) {
  const links = FM.getSavedLinks().filter((l) => l.spotifyId !== spotifyId);
  FM.setSavedLinks(links);
}

/** @returns {Array} Library from localStorage */
export function getLocalLibrary() {
  return FM.getSavedLinks();
}

// ── Combined Operations (cloud + local) ──────────────────────────────────────

/**
 * Saves a link to both localStorage and Firestore (if logged in).
 * Shows a toast notification.
 * @param {object} linkData
 */
export async function saveLink(linkData) {
  const saved = saveToLocal(linkData);
  if (!saved) {
    if (window.showToast) window.showToast('Already in your library.', 'info');
    return;
  }

  // Re-render sidebar
  if (window.renderSavedLinks) {
    window.renderSavedLinks(FM.getSavedLinks());
  }

  if (isLoggedIn()) {
    const user = getCurrentUser();
    await saveToCloud(user.uid, linkData);
  }

  if (window.showToast) window.showToast('Saved to your library ✓', 'success');
}

/**
 * Removes a link from localStorage and Firestore (if logged in).
 * @param {string} spotifyId
 */
export async function removeLink(spotifyId) {
  removeFromLocal(spotifyId);

  // Re-render sidebar
  if (window.renderSavedLinks) {
    window.renderSavedLinks(FM.getSavedLinks());
  }

  if (isLoggedIn()) {
    const user = getCurrentUser();
    await removeFromCloud(user.uid, spotifyId);
  }

  if (window.showToast) window.showToast('Removed from library', 'info');
}

/**
 * Checks if a spotifyId is already saved in the local library.
 * @param {string} spotifyId
 * @returns {boolean}
 */
export function isLinkSaved(spotifyId) {
  return FM.getSavedLinks().some((l) => l.spotifyId === spotifyId);
}
