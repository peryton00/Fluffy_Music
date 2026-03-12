// src/js/app.js — Main entry point for app.html
// Coordinates all modules: auth, player, spotify, youtube, ui, sync.

import { initAuth, loginWithGoogle, logout, isLoggedIn, getCurrentUser } from './auth.js';
import { loadUserLibrary, saveLink, removeLink, isLinkSaved, getLocalLibrary } from './sync.js';
import { parseSpotifyLink, fetchSpotifyData, fetchAllTracks } from './spotify.js';
import { initYouTubeAPI, toggleMode, setVolume, getMode } from './youtube.js';
import {
  loadTrack, playPause, nextTrack, prevTrack,
  toggleShuffle, toggleRepeat, seekToPercent, setIsDraggingProgress
} from './player.js';
import {
  showToast, showModal, renderSavedLinks, renderTrackList,
  renderPlaylistHero, renderHomeView, renderLoadingProgress
} from './ui.js';
import { FM } from './storage.js';

// ── App State ─────────────────────────────────────────────────────────────────
let currentPlaylistData = null;
let allLoadedTracks = [];
let isLoadingSpotify = false;
let searchDebounceTimer = null;

// ── Initialization ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize YouTube IFrame API
  initYouTubeAPI();

  // 2. Initialize Firebase Auth listener
  initAuth(async (user) => {
    if (user) {
      await loadUserLibrary(user.uid);
    } else {
      const links = getLocalLibrary();
      renderAndBindSidebar(links);
    }
  });

  // 3. Render home view
  const recentLinks = FM.getSavedLinks().slice(0, 4);
  renderHomeView(recentLinks);

  // 4. Restore last played info in player bar (no autoplay)
  const lastPlayed = FM.getLastPlayed();
  if (lastPlayed && window.updatePlayerBar) {
    window.updatePlayerBar(lastPlayed);
  }

  // 5. Restore volume
  setVolume(FM.getVolume());

  // 6. Restore mode toggle UI
  initModeToggle();

  // 7. Attach all event listeners
  attachEventListeners();

  // 8. Load initial sidebar
  const savedLinks = FM.getSavedLinks();
  renderAndBindSidebar(savedLinks);

  // 9. Check URL params (for index.html redirect with ?url=...)
  const urlParam = new URLSearchParams(window.location.search).get('url');
  if (urlParam) {
    handleSpotifyLink(decodeURIComponent(urlParam));
  }

  // 10. Check offline status
  if (!navigator.onLine) showOfflineBanner();
  window.addEventListener('offline', showOfflineBanner);
  window.addEventListener('online', hideOfflineBanner);
});

// ── Sidebar ───────────────────────────────────────────────────────────────────

function renderAndBindSidebar(links) {
  window._onLinkClick = (link) => handleSpotifyLink(link.url);
  window._onLinkRemove = (spotifyId) => removeLink(spotifyId);
  renderSavedLinks(links, window._onLinkClick, window._onLinkRemove);
}

// ── Spotify Link Handling ─────────────────────────────────────────────────────

/**
 * Main handler for any Spotify URL pasted or clicked.
 * Fetches metadata, renders hero, then fetches all tracks.
 * @param {string} url
 */
async function handleSpotifyLink(url) {
  if (isLoadingSpotify) return;

  const parsed = parseSpotifyLink(url);
  if (!parsed) {
    showToast('Invalid Spotify link. Please paste a valid URL.', 'error');
    markInputInvalid();
    return;
  }

  const { type, id } = parsed;
  isLoadingSpotify = true;

  // Show loading state — structure with hero-section AND track-list-container
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    mainContent.innerHTML = `
      <div id="playlist-view">
        <div id="hero-section">
          <div class="hero-skeleton">
            <div class="skeleton skeleton-hero-art"></div>
            <div class="skeleton-hero-info">
              <div class="skeleton skeleton-hero-title"></div>
              <div class="skeleton skeleton-hero-sub"></div>
              <div class="skeleton skeleton-hero-btns"></div>
            </div>
          </div>
        </div>
        <div id="track-list-container"></div>
      </div>`;
  }

  // Show skeleton track list
  const { showSkeleton } = await import('./ui.js');
  showSkeleton('track-list-container', 10);

  try {
    // Fetch first page (also gets metadata)
    const firstPage = await fetchSpotifyData(type, id, 0);
    currentPlaylistData = firstPage;
    allLoadedTracks = [...firstPage.tracks];

    const isSaved = isLinkSaved(id);

    // Render hero immediately
    renderPlaylistHero(
      { ...firstPage, type },
      (shuffle) => {
        if (shuffle) {
          loadTrack(allLoadedTracks[Math.floor(Math.random() * allLoadedTracks.length)], allLoadedTracks, 0);
          toggleShuffle();
        } else {
          loadTrack(allLoadedTracks[0], allLoadedTracks, 0);
        }
      },
      () => saveCurrentToLibrary(url, type, firstPage),
      isSaved
    );

    // Render what we have so far
    renderTrackList(allLoadedTracks, 'track-list-container', (track, queue, idx) => {
      loadTrack(track, queue, idx);
    });

    // Auto-play first track
    if (allLoadedTracks.length > 0) {
      loadTrack(allLoadedTracks[0], allLoadedTracks, 0);
    }

    // Fetch remaining tracks in background
    if (firstPage.hasMore) {
      fetchAllTracks(type, id, (loaded, total) => {
        renderLoadingProgress(loaded, total);
      }).then(({ tracks }) => {
        allLoadedTracks = tracks;
        renderTrackList(allLoadedTracks, 'track-list-container', (track, queue, idx) => {
          loadTrack(track, queue, idx);
        });
        // Highlight currently playing track again
        const current = FM.getLastPlayed();
        if (current && window.highlightCurrentTrack) window.highlightCurrentTrack(current.id);
      }).catch((err) => {
        console.error('Background track fetch error:', err.message);
      });
    }

  } catch (err) {
    showToast(err.message || 'Failed to load. Please try again.', 'error');
    renderHomeView(FM.getSavedLinks().slice(0, 4));
  } finally {
    isLoadingSpotify = false;
  }
}

async function saveCurrentToLibrary(url, type, data) {
  const linkData = {
    id: data.id,
    url,
    type,
    spotifyId: data.id,
    name: data.name,
    coverArt: data.coverArt || '',
    trackCount: data.totalTracks || 0,
    addedAt: Date.now(),
    lastPlayedAt: null,
  };
  await saveLink(linkData);

  // Update hero save button
  const saveBtn = document.getElementById('hero-save');
  if (saveBtn) {
    saveBtn.textContent = 'Saved ✓';
    saveBtn.classList.add('btn-saved');
    saveBtn.disabled = true;
  }

  renderAndBindSidebar(FM.getSavedLinks());
}

// ── YouTube Direct Search ─────────────────────────────────────────────────────

async function searchYouTube(query) {
  const mode = getMode();
  try {
    const res = await fetch(`/api/search-youtube?q=${encodeURIComponent(query)}&mode=${mode}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      showToast(data.message === 'youtube_quota_exceeded'
        ? 'YouTube search limit reached. Try again tomorrow.'
        : 'No results found.', 'error');
      return;
    }

    // Play directly
    const syntheticTrack = {
      id: data.videoId,
      name: data.title,
      artist: data.channelName,
      artists: data.channelName,
      album: '',
      albumArt: data.thumbnail || '',
      duration: 0,
      spotifyId: data.videoId,
    };

    const { loadVideo } = await import('./youtube.js');
    loadVideo(data.videoId);
    if (window.updatePlayerBar) window.updatePlayerBar(syntheticTrack);
  } catch (err) {
    showToast('Search failed. Please try again.', 'error');
  }
}

// ── Event Listeners ───────────────────────────────────────────────────────────

function attachEventListeners() {
  // ── Search Bar (top navbar) ──
  const searchInput = document.getElementById('top-search');
  if (searchInput) {
    // Only search on Enter to save server load and API quota

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchDebounceTimer);
        const val = searchInput.value.trim();
        if (!val) return;
        if (parseSpotifyLink(val)) handleSpotifyLink(val);
        else searchYouTube(val);
      }
    });
  }

  // ── Home view events (delegated on document since home-content is replaced) ──
  document.addEventListener('input', (e) => {
    if (e.target.id === 'home-url-input') {
      const val = e.target.value.trim();
      const box = document.getElementById('home-input-box');
      if (!val) { box?.classList.remove('valid', 'invalid'); return; }
      const valid = !!parseSpotifyLink(val);
      box?.classList.toggle('valid', valid);
      box?.classList.toggle('invalid', !valid);
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target.id === 'home-play-btn' || e.target.closest('#home-play-btn')) {
      const input = document.getElementById('home-url-input');
      if (input?.value.trim()) handleSpotifyLink(input.value.trim());
    }
    if (e.target.closest('.recent-card')) {
      const card = e.target.closest('.recent-card');
      const url = card.dataset.url;
      if (url) handleSpotifyLink(url);
    }
  });

  document.addEventListener('paste', (e) => {
    if (e.target.id === 'home-url-input') {
      setTimeout(() => {
        const val = e.target.value.trim();
        if (val && parseSpotifyLink(val)) {
          handleSpotifyLink(val);
        }
      }, 50);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.id === 'home-url-input' && e.key === 'Enter') {
      const val = e.target.value.trim();
      if (val) handleSpotifyLink(val);
    }
  });

  // ── Player Controls ──
  document.getElementById('btn-play')?.addEventListener('click', playPause);
  document.getElementById('btn-next')?.addEventListener('click', nextTrack);
  document.getElementById('btn-prev')?.addEventListener('click', prevTrack);
  document.getElementById('btn-shuffle')?.addEventListener('click', toggleShuffle);
  document.getElementById('btn-repeat')?.addEventListener('click', toggleRepeat);

  // ── Progress Bar ──
  const progressBar = document.getElementById('progress-bar');
  if (progressBar) {
    progressBar.addEventListener('click', (e) => {
      const rect = progressBar.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      seekToPercent(Math.max(0, Math.min(100, pct)));
    });

    let isDragging = false;
    progressBar.addEventListener('mousedown', () => { isDragging = true; setIsDraggingProgress(true); });
    document.addEventListener('mouseup', () => {
      if (isDragging) { isDragging = false; setIsDraggingProgress(false); }
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const rect = progressBar.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      seekToPercent(Math.max(0, Math.min(100, pct)));
    });
  }

  // ── Volume Slider ──
  const volumeSlider = document.getElementById('volume-slider');
  if (volumeSlider) {
    volumeSlider.value = FM.getVolume();
    volumeSlider.addEventListener('input', () => {
      setVolume(parseInt(volumeSlider.value, 10));
    });
  }

  // ── Mode Toggle ──
  document.getElementById('mode-audio')?.addEventListener('click', () => toggleMode('audio'));
  document.getElementById('mode-video')?.addEventListener('click', () => toggleMode('video'));

  // ── Auth ──
  document.getElementById('login-btn')?.addEventListener('click', loginWithGoogle);
  document.getElementById('logout-btn')?.addEventListener('click', logout);
  document.getElementById('sidebar-login-btn')?.addEventListener('click', loginWithGoogle);

  // ── Mobile Sidebar Toggle ──
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  hamburger?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    sidebarOverlay?.classList.toggle('visible');
  });
  sidebarOverlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('visible');
  });

  // ── Video Panel Close ──
  document.getElementById('video-close-btn')?.addEventListener('click', () => {
    toggleMode('audio');
    const audioBtn = document.getElementById('mode-audio');
    const videoBtn = document.getElementById('mode-video');
    if (audioBtn) audioBtn.classList.add('active');
    if (videoBtn) videoBtn.classList.remove('active');
  });
}

// ── Mode Toggle Init ──────────────────────────────────────────────────────────

function initModeToggle() {
  const savedMode = FM.getMode();
  const audioBtn = document.getElementById('mode-audio');
  const videoBtn = document.getElementById('mode-video');
  const slider = document.getElementById('mode-slider');

  if (audioBtn) audioBtn.classList.toggle('active', savedMode === 'audio');
  if (videoBtn) videoBtn.classList.toggle('active', savedMode === 'video');
  if (slider) slider.style.transform = savedMode === 'video' ? 'translateX(100%)' : 'translateX(0)';
}

// ── Input Validation Helpers ──────────────────────────────────────────────────

function markInputInvalid() {
  const box = document.getElementById('home-input-box');
  if (box) {
    box.classList.add('invalid');
    setTimeout(() => box.classList.remove('invalid'), 2000);
  }
}

// ── Offline Banner ────────────────────────────────────────────────────────────

function showOfflineBanner() {
  let banner = document.getElementById('offline-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'offline-banner';
    banner.textContent = "You're offline. Some features may not work.";
    document.body.prepend(banner);
  }
  banner.classList.add('visible');
}

function hideOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (banner) banner.classList.remove('visible');
}
