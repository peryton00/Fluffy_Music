// src/js/auth.js — Google Sign-In / Sign-Out via Firebase Authentication
// This file is loaded as a module (imports from firebase.js).

import { auth, googleProvider } from './firebase.js';
import {
  onAuthStateChanged,
  signInWithRedirect,
  signOut,
  GoogleAuthProvider,
  signInWithCredential
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

export async function loginWithGoogle() {
  const isNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
  
  try {
    if (isNative) {
      // Native Google Login via Capawesome Firebase Auth
      // We use the global Capacitor object to avoid breaking web build/CDN imports
      const FirebaseAuthentication = window.Capacitor.Plugins.FirebaseAuthentication;
      if (!FirebaseAuthentication) {
        throw new Error('FirebaseAuthentication plugin not found.');
      }

      const result = await FirebaseAuthentication.signInWithGoogle();
      console.log('Native Sign-In Result:', result);

      if (!result.credential || !result.credential.idToken) {
        throw new Error('No ID Token returned from native Google Sign-In.');
      }

      const credential = GoogleAuthProvider.credential(result.credential.idToken);
      await signInWithCredential(auth, credential);
    } else {
      // Standard Web Redirect (Reliable for Web, but fails in WebView)
      await signInWithRedirect(auth, googleProvider);
    }
    // Auth state change handler does the rest
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user' && err.message !== 'Sign in canceled') {
      console.error('Full Google login error object:', err);
      const errorMsg = err.message || err.code || 'Unknown error';
      console.error('Google login error message:', errorMsg);
      
      if (window.showToast) {
        window.showToast(`Login failed: ${errorMsg}`, 'error');
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
    FM.resetStorage();
    
    // Clear UI state
    if (window.renderSavedLinks) window.renderSavedLinks([]);
    if (window.updateLikedCountBadge) {
      // We need to import likes.js or expose it on window
      import('./likes.js').then(m => m.updateLikedCountBadge());
    }
    // Also reset home view to clear recently saved grid
    if (window.renderHomeView) window.renderHomeView([]);
    
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
  const sidebarLoginCard = document.getElementById('sidebar-login-card');
  const sidebarUserInfo = document.getElementById('sidebar-user-info');
  const sidebarUserAvatar = document.getElementById('sidebar-user-avatar');
  const sidebarUserName = document.getElementById('sidebar-user-name');

  if (user) {
    if (sidebarLoginCard) sidebarLoginCard.classList.add('hidden');
    if (sidebarUserInfo) sidebarUserInfo.classList.remove('hidden');
    if (sidebarUserAvatar && user.photoURL) {
      sidebarUserAvatar.src = user.photoURL;
      sidebarUserAvatar.alt = user.displayName || '';
    }
    if (sidebarUserName) sidebarUserName.textContent = user.displayName || 'User';
  } else {
    if (sidebarLoginCard) sidebarLoginCard.classList.remove('hidden');
    if (sidebarUserInfo) sidebarUserInfo.classList.add('hidden');
  }
}
