// src/js/data-mode.js — Feature 3: Data Mode Switch
// Controls YouTube playback quality and data usage preferences.

const LS_KEY = 'fm_data_mode';

export const DATA_MODES = {
  data_saver: {
    label: 'Data Saver 🌿',
    description: 'Lower quality, uses less data',
    ytQuality: '144p',
    imageQuality: 'small',
  },
  normal: {
    label: 'Normal 🎵',
    description: 'Balanced quality and data usage',
    ytQuality: '360p',
    imageQuality: 'normal',
  },
  standard: {
    label: 'Standard ✨',
    description: 'Better quality, uses more data',
    ytQuality: '720p',
    imageQuality: 'normal',
  },
};

/**
 * Returns the current data mode from localStorage.
 * @returns {'data_saver'|'normal'|'standard'}
 */
export function getDataMode() {
  const stored = localStorage.getItem(LS_KEY);
  return (stored && DATA_MODES[stored]) ? stored : 'normal';
}

/**
 * Sets the data mode, persists it, and applies it immediately.
 * @param {'data_saver'|'normal'|'standard'} mode
 */
export function setDataMode(mode) {
  if (!DATA_MODES[mode]) return;
  localStorage.setItem(LS_KEY, mode);
  applyDataMode(mode);
  if (window.showToast) {
    window.showToast(`Switched to ${DATA_MODES[mode].label}`, 'success');
  }
}

/**
 * Applies the data mode: sets body attribute for CSS targeting and
 * attempts to set YouTube playback quality if the player is ready.
 * Called on page load and on every mode switch.
 * @param {'data_saver'|'normal'|'standard'} mode
 */
export function applyDataMode(mode) {
  const config = DATA_MODES[mode];
  if (!config) return;

  // Set body data attribute for CSS targeting
  document.body.setAttribute('data-mode', mode);

  // Apply YouTube quality suggestion if player is available
  try {
    if (window.ytPlayer && typeof window.ytPlayer.setPlaybackQuality === 'function') {
      window.ytPlayer.setPlaybackQuality(config.ytQuality);
    }
  } catch (e) {
    // Player may not be ready — ignore silently
  }
}

/**
 * Returns the YouTube playback quality for the current data mode.
 * @returns {string}
 */
export function getYTQuality() {
  return DATA_MODES[getDataMode()].ytQuality;
}

/**
 * Returns true if the current mode is data_saver.
 * @returns {boolean}
 */
export function isDataSaver() {
  return getDataMode() === 'data_saver';
}
