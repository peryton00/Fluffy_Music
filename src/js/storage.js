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

  resetStorage: () => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('fm_')) {
        localStorage.removeItem(key);
      }
    });
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

  getLastIndex: () => parseInt(localStorage.getItem('fm_last_index') || '0', 10),
  setLastIndex: (idx) => localStorage.setItem('fm_last_index', String(idx)),

  getLastPlayed: () => {
    try {
      return JSON.parse(localStorage.getItem('fm_last_played') || 'null');
    } catch {
      return null;
    }
  },
  setLastPlayed: (track) => {
    // Strip videoId and any other YouTube-specific identifiers to force re-discovery on restore
    const cleanTrack = { ...track };
    delete cleanTrack.videoId;
    if (cleanTrack.album === 'YouTube Radio') delete cleanTrack.id;
    localStorage.setItem('fm_last_played', JSON.stringify(cleanTrack));
  },

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

  // ── Data Mode ─────────────────────────────────────────────────────────────
  getDataMode: () => localStorage.getItem('fm_data_mode') || 'normal',
  setDataMode: (m) => localStorage.setItem('fm_data_mode', m),

  // ── Recently Played Tracks (2A) ────────────────────────────────────────────
  getRecentTracks: () => {
    try {
      return JSON.parse(localStorage.getItem('fm_recent_tracks') || '[]');
    } catch { return []; }
  },
  addRecentTrack: (track) => {
    try {
      const recent = JSON.parse(localStorage.getItem('fm_recent_tracks') || '[]');
      const filtered = recent.filter(t => t.id !== track.id);
      const updated = [{ ...track, playedAt: Date.now() }, ...filtered].slice(0, 20);
      localStorage.setItem('fm_recent_tracks', JSON.stringify(updated));
    } catch (e) {}
  },

  // ── Search History (2B) ───────────────────────────────────────────────────
  getSearchHistory: () => {
    try {
      return JSON.parse(localStorage.getItem('fm_search_history') || '[]');
    } catch { return []; }
  },
  addSearchHistory: (query) => {
    if (!query || query.trim().length < 2) return;
    try {
      const history = JSON.parse(localStorage.getItem('fm_search_history') || '[]');
      const filtered = history.filter(q => q !== query.trim());
      const updated = [query.trim(), ...filtered].slice(0, 10);
      localStorage.setItem('fm_search_history', JSON.stringify(updated));
    } catch (e) {}
  },
  clearSearchHistory: () => {
    localStorage.removeItem('fm_search_history');
  },
};
