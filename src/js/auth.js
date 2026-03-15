// src/js/auth.js — Google Sign-In / Sign-Out via Firebase Authentication
// This file is loaded as a module (imports from firebase.js).

import { auth, googleProvider } from './firebase.js';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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
  // Handle redirect result (crucial for web reliability after returning from Google)
  getRedirectResult(auth).then((result) => {
    if (result) {
      console.log('Successfully received redirect result:', result.user.email);
    } else {
      console.log('No redirect result found (standard initialization).');
    }
  }).catch((err) => {
    console.error('CRITICAL: Redirect result error observed at breakpoint:', err.code, err.message);
    if (window.showToast) window.showToast(`Auth error: ${err.code}`, 'error');
  });

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
  const isNative = !!(window.Capacitor && window.Capacitor.isNative);
  
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
      // Force account picker to prevent stuck states
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      
      // Use Popup for Web (more reliable on localhost and standard web than Redirect)
      const result = await signInWithPopup(auth, googleProvider);
      console.log('Web Popup Sign-In Result:', result.user.email);
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
    const isNative = !!(window.Capacitor && window.Capacitor.isNative);
    
    // 1. Sign out from Firebase JS SDK
    await signOut(auth);

    // 2. Sign out from Native Google session to clear account picker state
    if (isNative) {
      const FirebaseAuthentication = window.Capacitor.Plugins.FirebaseAuthentication;
      if (FirebaseAuthentication) {
        await FirebaseAuthentication.signOut();
      }
    }

    FM.resetStorage();
    
    // UI state will be updated via the onAuthStateChanged listener in app.js
    
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
