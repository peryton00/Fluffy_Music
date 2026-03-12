// src/js/storage.js — All localStorage operations, prefixed with 'fm_'

export const FM = {
  // ── User (set by Firebase Auth) ──────────────────────────────────────────
  getUserName: () => localStorage.getItem('fm_user_name'),
  getUserEmail: () => localStorage.getItem('fm_user_email'),
  getUserAvatar: () => localStorage.getItem('fm_user_avatar'),
  getUserUid: () => localStorage.getItem('fm_user_uid'),

  setUser: (user) => {
    localStorage.setItem('fm_user_name', user.displayName || '');
    localStorage.setItem('fm_user_email', user.email || '');
    localStorage.setItem('fm_user_avatar', user.photoURL || '');
    localStorage.setItem('fm_user_uid', user.uid || '');
  },

  clearUser: () => {
    ['fm_user_name', 'fm_user_email', 'fm_user_avatar', 'fm_user_uid'].forEach((k) =>
      localStorage.removeItem(k)
    );
  },

  // ── Library (also managed by sync.js) ────────────────────────────────────
  getSavedLinks: () => {
    try {
      return JSON.parse(localStorage.getItem('fm_saved_links') || '[]');
    } catch {
      return [];
    }
  },
  setSavedLinks: (arr) =>
    localStorage.setItem('fm_saved_links', JSON.stringify(arr)),

  // ── Player Preferences ────────────────────────────────────────────────────
  getVolume: () => parseInt(localStorage.getItem('fm_volume') || '80', 10),
  setVolume: (level) => localStorage.setItem('fm_volume', String(level)),

  getMode: () => localStorage.getItem('fm_mode') || 'audio',
  setMode: (mode) => localStorage.setItem('fm_mode', mode),

  getLastPlayed: () => {
    try {
      return JSON.parse(localStorage.getItem('fm_last_played') || 'null');
    } catch {
      return null;
    }
  },
  setLastPlayed: (track) =>
    localStorage.setItem('fm_last_played', JSON.stringify(track)),

  // ── Current Session ───────────────────────────────────────────────────────
  setCurrentPlaylist: (data) =>
    localStorage.setItem('fm_current_playlist', JSON.stringify(data)),

  getCurrentPlaylist: () => {
    try {
      return JSON.parse(localStorage.getItem('fm_current_playlist') || 'null');
    } catch {
      return null;
    }
  },
};
