// src/js/capacitor-bridge.js — Capacitor native plugin integration
// Gracefully does nothing when running on the web browser.
//
// ARCHITECTURE NOTE:
// This app loads from a remote Vercel URL. Dynamic npm imports (import('pkg'))
// don't work in that context — they 404. Instead, we access native Capacitor
// plugins directly via window.Capacitor.Plugins which is always injected
// into the WebView by the native runtime.

// ── Platform Detection ─────────────────────────────────────────────────────────
const isCapacitor = typeof window !== 'undefined' && window.Capacitor !== undefined;
const isAndroid = isCapacitor && window.Capacitor.getPlatform() === 'android';
const isIOS = isCapacitor && window.Capacitor.getPlatform() === 'ios';

// ── Music Controls State ───────────────────────────────────────────────────────
// Plugin is accessed via window.Capacitor.Plugins.CapacitorMusicControls
// (registered name from the native Android code)
let MusicControls = null;
let musicControlsInitialized = false;
let controlsListenerAttached = false;

// ── Public Exports ─────────────────────────────────────────────────────────────

export function isRunningInCapacitor() { return isCapacitor; }

export function getPlatform() {
  if (!isCapacitor) return 'web';
  return window.Capacitor.getPlatform();
}

/**
 * Initialize all Capacitor plugins.
 * Call this as the VERY FIRST thing in DOMContentLoaded.
 */
export async function initCapacitor() {
  if (!isCapacitor) return;

  // ── Status Bar ───────────────────────────────────────────────────────────────
  try {
    const SB = window.Capacitor.Plugins.StatusBar;
    if (SB) {
      await SB.setStyle({ style: 'DARK' });
      if (isAndroid) await SB.setBackgroundColor({ color: '#0A0A0F' });
    }
  } catch (err) {
    console.warn('StatusBar unavailable:', err.message);
  }

  // ── Splash Screen ────────────────────────────────────────────────────────────
  try {
    const SS = window.Capacitor.Plugins.SplashScreen;
    if (SS) await SS.hide();
  } catch (err) {
    console.warn('SplashScreen unavailable:', err.message);
  }

  // ── App Plugin (back button) ──────────────────────────────────────────────────
  try {
    const App = window.Capacitor.Plugins.App;
    if (App) {
      App.addListener('backButton', ({ canGoBack }) => {
        if (!canGoBack) App.exitApp();
        else window.history.back();
      });

      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          import('./media-session.js').then((ms) => {
            try {
              const raw = localStorage.getItem('fm_last_played');
              if (raw) ms.updateMediaSession(JSON.parse(raw));
            } catch (_) {}
          }).catch(() => {});
        }
      });
    }
  } catch (err) {
    console.warn('App plugin unavailable:', err.message);
  }

  // ── Music Controls ────────────────────────────────────────────────────────────
  // Note: notification permission is handled natively in MainActivity.java
  // on Android 13+ — no JS request needed.
  _initMusicControls();
}

// ── Music Controls Initialization ─────────────────────────────────────────────

function _initMusicControls() {
  if (!isCapacitor) return;
  try {
    // The plugin registers itself as 'CapacitorMusicControls' on the native bridge.
    // We access it directly — no npm import needed (which fails on remote URL).
    const plugin = window.Capacitor?.Plugins?.CapacitorMusicControls;
    if (plugin) {
      MusicControls = plugin;
      musicControlsInitialized = true;

      // The plugin fires events via bridge.triggerJSEvent() on 'document' —
      // NOT via Capacitor's notifyListeners. Listen for DOM events here at startup.
      document.addEventListener('controlsNotification', (event) => {
        try {
          const data = typeof event.detail === 'string'
            ? JSON.parse(event.detail)
            : event.detail;
          _handleMusicControlAction(data.message || data);
        } catch (e) {
          console.warn('[Fluffy] controlsNotification parse error:', e);
        }
      });
      controlsListenerAttached = true;

      console.log('[Fluffy] MusicControls ready via native bridge');
    } else {
      console.warn('[Fluffy] CapacitorMusicControls not found on Capacitor.Plugins');
    }
  } catch (e) {
    console.warn('[Fluffy] MusicControls init failed:', e);
  }
}

// ── Music Controls API ────────────────────────────────────────────────────────

/**
 * Creates/updates the persistent notification with track info and controls.
 */
export async function updateMusicControls(track, isPlaying) {
  if (!isCapacitor || !musicControlsInitialized || !MusicControls || !track) return;

  try {
    await MusicControls.create({
      track:   track.name   || 'Unknown',
      artist:  track.artist || 'Unknown',
      album:   track.album  || 'Fluffy Music',
      cover:   track.albumArt || 'https://fluffy-music.vercel.app/src/img/icon-512.png',
      isPlaying,
      dismissable: false,
      hasPrev:         true,
      hasNext:         true,
      hasClose:        false,
      hasSkipForward:  false,
      hasSkipBackward: false,
      ticker: `Now playing: ${track.name}`,
      playIcon:         'media_play',
      pauseIcon:        'media_pause',
      prevIcon:         'media_prev',
      nextIcon:         'media_next',
      closeIcon:        'media_close',
      notificationIcon: 'mr_notification',
    });

    // The plugin fires control events via bridge.triggerJSEvent() on 'document',
    // NOT via Capacitor's notifyListeners/addListener. Listen to DOM events.
    if (!controlsListenerAttached) {
      controlsListenerAttached = true;
      document.addEventListener('controlsNotification', (event) => {
        try {
          // event.detail is a JSON string like {"message":"music-controls-next"}
          const data = typeof event.detail === 'string'
            ? JSON.parse(event.detail)
            : event.detail;
          _handleMusicControlAction(data.message || data);
        } catch (e) {
          console.warn('[Fluffy] controlsNotification parse error:', e);
        }
      });
    }
  } catch (e) {
    console.warn('[Fluffy] MusicControls.create error:', e);
  }
}

/**
 * Updates only the playing state in the existing notification.
 */
export async function updateMusicControlsState(isPlaying) {
  if (!musicControlsInitialized || !MusicControls) return;
  try {
    await MusicControls.updateIsPlaying({ isPlaying });
  } catch (e) {
    console.warn('[Fluffy] MusicControls.updateIsPlaying error:', e);
  }
}

/**
 * Destroys the music controls notification.
 */
export async function destroyMusicControls() {
  if (!musicControlsInitialized || !MusicControls) return;
  try {
    await MusicControls.destroy();
  } catch (e) {
    console.warn('[Fluffy] MusicControls.destroy error:', e);
  }
}

// ── Media Button / Action Handler ─────────────────────────────────────────────

function _handleMusicControlAction(action) {
  import('./player.js').then((player) => {
    switch (action) {
      case 'music-controls-next':
        player.nextTrack(); break;
      case 'music-controls-previous':
        player.prevTrack(); break;
      case 'music-controls-play':
        player.playPause();
        updateMusicControlsState(true).catch(() => {});
        break;
      case 'music-controls-pause':
        player.playPause();
        updateMusicControlsState(false).catch(() => {});
        break;
      case 'music-controls-destroy':
        destroyMusicControls().catch(() => {}); break;
      case 'music-controls-media-button':
        // TWS earbuds single press
        player.playPause(); break;
      case 'music-controls-headset-unplugged':
        import('./youtube.js').then((YT) => {
          if (YT.getPlayerState() === 1) player.playPause();
        }).catch(() => {});
        break;
      default:
        console.debug('[Fluffy] Unhandled music action:', action);
    }
  }).catch(() => {});
}

// ── Haptics ───────────────────────────────────────────────────────────────────

export async function triggerHaptic() {
  if (!isCapacitor) return;
  try {
    const Haptics = window.Capacitor?.Plugins?.Haptics;
    if (Haptics) await Haptics.impact({ style: 'LIGHT' });
  } catch (_) {}
}
