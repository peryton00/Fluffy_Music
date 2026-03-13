// src/js/capacitor-bridge.js — Capacitor native plugin integration
// Gracefully does nothing when running on the web browser.
// All native plugin imports are dynamic so the web build is never affected.

// ── Platform Detection ─────────────────────────────────────────────────────────
const isCapacitor = typeof window !== 'undefined' && window.Capacitor !== undefined;
const isAndroid = isCapacitor && window.Capacitor.getPlatform() === 'android';
const isIOS = isCapacitor && window.Capacitor.getPlatform() === 'ios';

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
        // Re-hydrate Media Session when app comes back to foreground
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
}

/**
 * Trigger a light haptic impact.
 * On web: does nothing.
 * On native: provides tactile feedback for button presses (e.g. like button).
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
