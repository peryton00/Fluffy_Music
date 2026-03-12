// src/js/app.js — Main entry point for app.html
// Coordinates all modules: auth, player, spotify, youtube, ui, sync.

import { initAuth, loginWithGoogle, logout, isLoggedIn, getCurrentUser } from './auth.js';
import { loadUserLibrary, saveLink, removeLink, isLinkSaved, getLocalLibrary } from './sync.js';
import { parseSpotifyLink, fetchSpotifyData, fetchAllTracks } from './spotify.js';
import { initYouTubeAPI, setVolume } from './youtube.js';
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
  try {
    const encoded = encodeURIComponent(query);
    // Try Piped first, fall back to YouTube
    let data = null;
    res = await fetch(
      `/api/search-youtube?q=${encoded}&source=piped`
    );
    if (res.ok) data = await res.json();

    // Fallback order: Invidious -> YouTube API (if not blocked) -> ytSearch (scraper)
    if (!data || data.error || !data.results?.length) {
      res = await fetch(`/api/search-youtube?q=${encoded}&source=invidious`);
      if (res.ok) data = await res.json();
    }

    // Try YouTube API only if not persistently blocked today
    const quotaExpiry = localStorage.getItem('fm_yt_quota_expiry');
    const isBlocked = quotaExpiry && Date.now() < parseInt(quotaExpiry);

    if (!isBlocked && (!data || data.error || !data.results?.length)) {
      res = await fetch(`/api/search-youtube?q=${encoded}&source=youtube`);
      if (res.ok) {
        data = await res.json();
      } else if (res.status === 429) {
        // Mark as blocked for today
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);
        localStorage.setItem('fm_yt_quota_expiry', midnight.getTime().toString());
      }
    }

    // Final free fallback: Scraper
    if (!data || data.error || !data.results?.length) {
      res = await fetch(`/api/search-youtube?q=${encoded}&source=ytsearch`);
      if (res.ok) data = await res.json();
    }

    if (!data || data.error || !data.results?.length) {
      showToast('No results found.', 'error');
      return;
    }

    // Convert results to internal track format
    const syntheticQueue = data.results.map(t => ({
      id: t.videoId,
      name: t.title,
      artist: t.channelName,
      artists: t.channelName,
      album: 'YouTube Radio',
      albumArt: t.thumbnail || '',
      duration: (t.duration || 0) * 1000,
      spotifyId: t.videoId,
    }));

    loadTrack(syntheticQueue[0], syntheticQueue, 0);

  } catch (err) {
    showToast('Search failed. Please try again.',
      'error');
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

  // ── Auth Buttons ──
  document.getElementById('login-btn')?.addEventListener('click', loginWithGoogle);
  document.getElementById('sidebar-login-btn')?.addEventListener('click', loginWithGoogle);
  document.getElementById('logout-btn')?.addEventListener('click', logout);

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

  // ── Keyboard Shortcuts ──
  document.addEventListener('keydown', handleGlobalKeyboardShortcuts);
}

// ── Keyboard Shortcuts Handling ────────────────────────────────────────────────

function handleGlobalKeyboardShortcuts(e) {
  // Ignore if user is typing in an input field
  const targetTag = e.target.tagName?.toLowerCase();
  if (targetTag === 'input' || targetTag === 'textarea' || e.target.isContentEditable) return;

  // Spacebar: Play/Pause
  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault(); // prevent page scroll
    playPause();
  }

  // Right Arrow: Forward 10s
  else if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    import('./youtube.js').then((YT) => {
       const cur = YT.getCurrentTime();
       const dur = YT.getDuration();
       if (dur > 0) YT.seekTo(Math.min(dur, cur + 10));
    });
  }

  // Left Arrow: Backward 10s
  else if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    import('./youtube.js').then((YT) => {
       const cur = YT.getCurrentTime();
       YT.seekTo(Math.max(0, cur - 10));
    });
  }

  // Ctrl + Right Arrow: Next Track
  else if (e.key === 'ArrowRight' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    nextTrack();
  }

  // Ctrl + Left Arrow: Previous Track
  else if (e.key === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    prevTrack();
  }

  // Up Arrow: Volume Up
  else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const volSlider = document.getElementById('volume-slider');
    let currentVol = volSlider ? parseInt(volSlider.value, 10) : FM.getVolume();
    let newVol = Math.min(100, currentVol + 5);
    import('./youtube.js').then((YT) => YT.setVolume(newVol));
    if (volSlider) volSlider.value = newVol;
  }

  // Down Arrow: Volume Down
  else if (e.key === 'ArrowDown') {
    e.preventDefault();
    const volSlider = document.getElementById('volume-slider');
    let currentVol = volSlider ? parseInt(volSlider.value, 10) : FM.getVolume();
    let newVol = Math.max(0, currentVol - 5);
    import('./youtube.js').then((YT) => YT.setVolume(newVol));
    if (volSlider) volSlider.value = newVol;
  }

  // Ctrl + S: Toggle Shuffle
  else if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    toggleShuffle();
  }

  // Ctrl + L: Toggle Loop (Repeat)
  else if (e.key.toLowerCase() === 'l' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    toggleRepeat();
  }
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
