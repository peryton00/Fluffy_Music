// src/js/capacitor-bridge.js — Capacitor native plugin integration
// Gracefully does nothing when running on the web browser.
// All native plugin imports are dynamic so the web build is never affected.

// ── Platform Detection ─────────────────────────────────────────────────────────
const isCapacitor = typeof window !== 'undefined' && window.Capacitor !== undefined;
const isAndroid = isCapacitor && window.Capacitor.getPlatform() === 'android';
const isIOS = isCapacitor && window.Capacitor.getPlatform() === 'ios';

// ── Music Controls State ───────────────────────────────────────────────────────
let MusicControls = null;
let musicControlsInitialized = false;
let musicControlsSubscription = null;

// ── Public Exports ─────────────────────────────────────────────────────────────

/**
 * Returns true when running inside the Capacitor native app container.
 */
export function isRunningInCapacitor() {
  return isCapacitor;
}

/**
 * Returns 'web', 'android', or 'ios'.
 */
export function getPlatform() {
  if (!isCapacitor) return 'web';
  return window.Capacitor.getPlatform();
}

/**
 * Initialize all Capacitor plugins.
 * Call this as the VERY FIRST thing in DOMContentLoaded.
 * On web: returns immediately without doing anything.
 */
export async function initCapacitor() {
  if (!isCapacitor) return;

  // ── Status Bar ───────────────────────────────────────────────────────────────
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    if (isAndroid) {
      await StatusBar.setBackgroundColor({ color: '#0A0A0F' });
    }
  } catch (err) {
    console.warn('StatusBar plugin unavailable:', err.message);
  }

  // ── Splash Screen ────────────────────────────────────────────────────────────
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch (err) {
    console.warn('SplashScreen plugin unavailable:', err.message);
  }

  // ── App Plugin (back button + app state changes) ──────────────────────────────
  try {
    const { App } = await import('@capacitor/app');

    // Android hardware back button: exit app when on home screen
    App.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        App.exitApp();
      } else {
        window.history.back();
      }
    });

    // App resumed from background: refresh Media Session metadata
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        import('./media-session.js').then((ms) => {
          try {
            const raw = localStorage.getItem('fm_last_played');
            if (raw) {
              const track = JSON.parse(raw);
              ms.updateMediaSession(track);
            }
          } catch (_) {}
        }).catch(() => {});
      }
    });
  } catch (err) {
    console.warn('App plugin unavailable:', err.message);
  }

  // ── Notification Permission (Android 13+) ─────────────────────────────────────
  if (isAndroid) {
    await requestNotificationPermission();
  }

  // ── Music Controls Plugin ─────────────────────────────────────────────────────
  await initMusicControls();
}

// ── Notification Permission ───────────────────────────────────────────────────

async function requestNotificationPermission() {
  // Only runs on Android 13+ (API 33+). Uses Web Notifications API as fallback.

  // Check if already granted via Web Notifications API
  if ('Notification' in window) {
    if (Notification.permission === 'granted') return;
  }

  // Try Capacitor Permissions plugin first
  try {
    const { Permissions } = await import('@capacitor/core');
    const status = await Permissions.query({ name: 'notifications' });

    if (status.state === 'granted') return;

    if (status.state === 'prompt') {
      const result = await Permissions.request({ name: 'notifications' });
      if (result.state === 'granted') {
        console.log('Notification permission granted');
      } else {
        console.warn('Notification permission denied');
        _showNotificationPermissionGuide();
      }
    }
  } catch (_) {
    // Fallback to Web Notifications API
    try {
      if ('Notification' in window && Notification.permission !== 'denied') {
        const result = await Notification.requestPermission();
        if (result !== 'granted') {
          _showNotificationPermissionGuide();
        }
      }
    } catch (e) {
      console.warn('Notification permission request failed:', e);
    }
  }
}

function _showNotificationPermissionGuide() {
  // Show only once per install
  if (localStorage.getItem('fm_notif_guide_shown')) return;
  localStorage.setItem('fm_notif_guide_shown', '1');

  const msg = 'Enable notifications in Settings for playback controls';
  if (typeof window.showToast === 'function') {
    window.showToast(msg, 'info');
  } else {
    console.info(msg);
  }
}

// ── Music Controls Initialization ─────────────────────────────────────────────

async function initMusicControls() {
  if (!isCapacitor) return;
  try {
    const module = await import('capacitor-music-controls-plugin');
    MusicControls = module.MusicControls;
    musicControlsInitialized = true;
    console.log('MusicControls plugin initialized');
  } catch (e) {
    console.warn('MusicControls plugin not available (app will still work):', e);
    musicControlsInitialized = false;
  }
}

// ── Music Controls API ────────────────────────────────────────────────────────

/**
 * Creates/updates the persistent notification with track info and controls.
 * Safe to call on web — returns immediately without doing anything.
 * @param {object} track  - Normalized track object
 * @param {boolean} isPlaying
 */
export async function updateMusicControls(track, isPlaying) {
  if (!isCapacitor) return;
  if (!musicControlsInitialized || !MusicControls || !track) return;

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

    // Subscribe to control events only once
    if (!musicControlsSubscription) {
      musicControlsSubscription = await MusicControls.subscribe();
      musicControlsSubscription.subscribe((action) => {
        _handleMusicControlAction(action.message || action);
      });
    }
  } catch (e) {
    console.warn('MusicControls.create error:', e);
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
    console.warn('MusicControls.updateIsPlaying error:', e);
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
    console.warn('MusicControls.destroy error:', e);
  }
}

// ── Media Button / Action Handler ─────────────────────────────────────────────

function _handleMusicControlAction(action) {
  import('./player.js').then((player) => {
    switch (action) {
      case 'music-controls-next':
        player.nextTrack();
        break;
      case 'music-controls-previous':
        player.prevTrack();
        break;
      case 'music-controls-play':
        player.playPause();
        updateMusicControlsState(true).catch(() => {});
        break;
      case 'music-controls-pause':
        player.playPause();
        updateMusicControlsState(false).catch(() => {});
        break;
      case 'music-controls-destroy':
        destroyMusicControls().catch(() => {});
        break;
      case 'music-controls-media-button':
        // TWS earbuds single-button press
        player.playPause();
        break;
      case 'music-controls-headset-unplugged':
        // Pause when headphones are unplugged
        import('./youtube.js').then((YT) => {
          if (YT.getPlayerState() === 1) {
            player.playPause();
          }
        }).catch(() => {});
        break;
      default:
        console.debug('Unhandled music control action:', action);
    }
  }).catch(() => {});
}

// ── Haptics ───────────────────────────────────────────────────────────────────

/**
 * Trigger a light haptic impact.
 * On web: does nothing.
 */
export async function triggerHaptic() {
  if (!isCapacitor) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (_) {
    // Silently ignore — haptics are optional
  }
}
