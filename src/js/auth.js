// src/js/auth.js — Google Sign-In / Sign-Out via Firebase Authentication
// This file is loaded as a module (imports from firebase.js).

import { auth, googleProvider } from './firebase.js';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { FM } from './storage.js';

let currentUser = null;

/**
 * Initializes the Firebase Auth state listener.
 * Called once on app startup.
 * @param {Function} onUserChange - callback(user | null)
 */
export function initAuth(onUserChange) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      FM.setUser(user);
      updateAuthUI(user);
      if (onUserChange) onUserChange(user);
    } else {
      currentUser = null;
      FM.clearUser();
      updateAuthUI(null);
      if (onUserChange) onUserChange(null);
    }
  });
}

/**
 * Opens the Google sign-in popup.
 * onAuthStateChanged handles the rest automatically.
 */
export async function loginWithGoogle() {
  try {
    await signInWithPopup(auth, googleProvider);
    // Auth state change handler does the rest
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      console.error('Google login error:', err.code, err.message);
      if (window.showToast) {
        window.showToast('Login failed. Please try again.', 'error');
      }
    }
  }
}

/**
 * Signs the user out after showing a confirmation dialog.
 */
export async function logout() {
  const confirmed = await new Promise((resolve) => {
    if (window.showModal) {
      window.showModal(
        'Sign Out',
        'Sign out of Fluffy Music? Your library will still be available offline.',
        () => resolve(true),
        () => resolve(false)
      );
    } else {
      resolve(window.confirm('Sign out of Fluffy Music?'));
    }
  });

  if (!confirmed) return;

  try {
    await signOut(auth);
    FM.clearUser();
    if (window.showToast) {
      window.showToast('Signed out successfully.', 'info');
    }
  } catch (err) {
    console.error('Logout error:', err.message);
    if (window.showToast) {
      window.showToast('Sign out failed. Please try again.', 'error');
    }
  }
}

/** @returns {boolean} Whether a user is currently signed in */
export function isLoggedIn() {
  return !!currentUser;
}

/** @returns {object|null} The current Firebase user object */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Updates the header auth UI based on user state.
 * @param {object|null} user
 */
export function updateAuthUI(user) {
  const loginBtn = document.getElementById('login-btn');
  const userMenu = document.getElementById('user-menu');
  const userAvatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');
  const sidebarLoginCard = document.getElementById('sidebar-login-card');
  const sidebarUserInfo = document.getElementById('sidebar-user-info');
  const sidebarUserAvatar = document.getElementById('sidebar-user-avatar');
  const sidebarUserName = document.getElementById('sidebar-user-name');

  if (user) {
    if (loginBtn) loginBtn.classList.add('hidden');
    if (userMenu) userMenu.classList.remove('hidden');
    if (userAvatar && user.photoURL) {
      userAvatar.src = user.photoURL;
      userAvatar.alt = user.displayName || 'User';
    }
    if (userName) userName.textContent = user.displayName ? user.displayName.split(' ')[0] : 'User';

    if (sidebarLoginCard) sidebarLoginCard.classList.add('hidden');
    if (sidebarUserInfo) sidebarUserInfo.classList.remove('hidden');
    if (sidebarUserAvatar && user.photoURL) {
      sidebarUserAvatar.src = user.photoURL;
      sidebarUserAvatar.alt = user.displayName || '';
    }
    if (sidebarUserName) sidebarUserName.textContent = user.displayName || 'User';
  } else {
    if (loginBtn) loginBtn.classList.remove('hidden');
    if (userMenu) userMenu.classList.add('hidden');
    if (sidebarLoginCard) sidebarLoginCard.classList.remove('hidden');
    if (sidebarUserInfo) sidebarUserInfo.classList.add('hidden');
  }
}
