// src/js/app.js — Main entry point for app.html
// Coordinates all modules: auth, player, spotify, youtube, ui, sync.

import { initAuth, loginWithGoogle, logout, isLoggedIn, getCurrentUser } from './auth.js';
import { loadUserLibrary, saveLink, removeLink, isLinkSaved, getLocalLibrary } from './sync.js';
import { parseSpotifyLink, fetchSpotifyData, fetchAllTracks } from './spotify.js';
import { initYouTubeAPI, setVolume } from './youtube.js';
import {
  loadTrack, playPause, nextTrack, prevTrack,
  toggleShuffle, toggleRepeat, seekToPercent, setIsDraggingProgress,
  getIsShuffled, getQueue
} from './player.js';
import {
  showToast, showModal, renderSavedLinks, renderTrackList,
  renderPlaylistHero, renderHomeView, renderLoadingProgress, renderSearchResults
} from './ui.js';
import { FM } from './storage.js';
import { getLikedSongs, toggleLike, updateLikedCountBadge } from './likes.js';
import { getDataMode, setDataMode, applyDataMode, getYTQuality } from './data-mode.js';

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

  // 3a. Apply saved data mode immediately
  applyDataMode(getDataMode());

  // 3b. Update liked songs badge
  updateLikedCountBadge();

  // 4. Restore last played info / playlist session
  const lastPlayed = FM.getLastPlayed();
  const lastPlaylist = FM.getCurrentPlaylist();

  if (lastPlaylist) {
    currentPlaylistData = lastPlaylist;
    allLoadedTracks = lastPlaylist.tracks || [];
    
    // Render the view without auto-playing
    renderPlaylistHero(
      { ...lastPlaylist },
      (shuffle) => {
        if (shuffle) {
          loadTrack(allLoadedTracks[Math.floor(Math.random() * allLoadedTracks.length)], allLoadedTracks, 0);
          toggleShuffle();
        } else {
          loadTrack(allLoadedTracks[0], allLoadedTracks, 0);
        }
      },
      () => saveCurrentToLibrary(lastPlaylist.url, lastPlaylist.type, lastPlaylist),
      isLinkSaved(lastPlaylist.id)
    );

    renderTrackList(allLoadedTracks, 'track-list-container', (track, queue, idx) => {
      loadTrack(track, queue, idx);
    });

    if (lastPlayed) {
      const lastIndex = FM.getLastIndex();
      loadTrack(lastPlayed, allLoadedTracks, lastIndex, { autoPlay: false });
    }
  } else if (lastPlayed) {
    const lastIndex = FM.getLastIndex();
    loadTrack(lastPlayed, [], lastIndex, { autoPlay: false });
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

    // Save current playlist to session storage for persistence
    FM.setCurrentPlaylist({ ...firstPage, tracks: allLoadedTracks, type, url });

    const isSaved = isLinkSaved(id);

    // Render hero immediately
    renderPlaylistHero(
      { ...firstPage, type },
      (shuffle) => {
        if (shuffle) {
          // Explicitly enable shuffle
          if (!getIsShuffled()) toggleShuffle();
          const queue = getQueue();
          loadTrack(queue[Math.floor(Math.random() * queue.length)], queue, 0);
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
    saveBtn.remove();
  }

  renderAndBindSidebar(FM.getSavedLinks());
}

// ── YouTube Direct Search ─────────────────────────────────────────────────────

async function searchYouTube(query) {
  try {
    // 1. Show loading skeleton in main content
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.innerHTML = '<div id="search-results-container"></div>';
      const { showSkeleton } = await import('./ui.js');
      showSkeleton('search-results-container', 5);
    }

    const encoded = encodeURIComponent(query);
    let data = null;

    // 2. Try Piped first
    let res = await fetch(`/api/search-youtube?q=${encoded}&source=piped`);
    if (res.ok) data = await res.json();

    // 3. Fallback to Invidious
    if (!data || data.error || !data.results?.length) {
      res = await fetch(`/api/search-youtube?q=${encoded}&source=invidious`);
      if (res.ok) data = await res.json();
    }

    // 4. Fallback to YouTube API (if not quota-blocked)
    const quotaExpiry = localStorage.getItem('fm_yt_quota_expiry');
    const isBlocked = quotaExpiry && Date.now() < parseInt(quotaExpiry);
    if (!isBlocked && (!data || data.error || !data.results?.length)) {
      res = await fetch(`/api/search-youtube?q=${encoded}&source=youtube`);
      if (res.ok) {
        data = await res.json();
      } else if (res.status === 429) {
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);
        localStorage.setItem('fm_yt_quota_expiry', midnight.getTime().toString());
      }
    }

    // 5. Final fallback: scraper
    if (!data || data.error || !data.results?.length) {
      res = await fetch(`/api/search-youtube?q=${encoded}&source=ytsearch`);
      if (res.ok) data = await res.json();
    }

    if (!data || data.error || !data.results?.length) {
      showToast('No results found.', 'error');
      renderHomeView(FM.getSavedLinks().slice(0, 4));
      return;
    }

    const results = data.results;

    // 6. Build synthetic queue for playback
    const syntheticQueue = results.map(t => ({
      id: t.videoId,
      name: t.title,
      artist: t.channelName,
      artists: t.channelName,
      album: 'YouTube Radio',
      albumArt: t.thumbnail || '',
      duration: (t.duration || 0) * 1000,
      spotifyId: t.videoId,
    }));

    // 7. Render results — user picks which to play (no auto-play)
    renderSearchResults(
      results,
      'search-results-container',
      (selectedResult) => {
        const idx = results.indexOf(selectedResult);
        loadTrack(syntheticQueue[idx], syntheticQueue, idx);
      }
    );

  } catch (err) {
    showToast('Search failed. Please try again.', 'error');
  }
}

// ── Event Listeners ───────────────────────────────────────────────────────────

function attachEventListeners() {
  // ── Search Bar (top navbar) ──
  const searchInput = document.getElementById('top-search');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchDebounceTimer);
        const val = searchInput.value.trim();
        if (!val) return;
        if (parseSpotifyLink(val)) handleSpotifyLink(val);
        else searchYouTube(val);
      }
    });

    // Also trigger search on search icon click
    const searchIcon = document.querySelector('.nav-search-icon');
    if (searchIcon) {
      searchIcon.style.cursor = 'pointer';
      searchIcon.addEventListener('click', () => {
        const val = searchInput.value.trim();
        if (!val) return;
        if (parseSpotifyLink(val)) handleSpotifyLink(val);
        else searchYouTube(val);
      });
    }
  }

  // ── Liked Songs Sidebar ──
  document.addEventListener('click', (e) => {
    if (e.target.closest('#sidebar-liked')) {
      renderLikedSongsView();
    }
  });

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

  // ── Mobile Sidebar ──
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (hamburger && sidebar && overlay) {
    const toggleSidebar = () => {
      const isOpen = sidebar.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', isOpen);
      overlay.style.opacity = isOpen ? '1' : '0';
      overlay.style.pointerEvents = isOpen ? 'auto' : 'none';
    };

    hamburger.addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', toggleSidebar);
  }

  // ── Settings Panel (Data Mode) ──
  document.getElementById('btn-settings')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const panel = document.getElementById('settings-panel');
    panel?.classList.toggle('visible');
    updateModeButtonsUI(getDataMode());
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#settings-panel') && !e.target.closest('#btn-settings')) {
      document.getElementById('settings-panel')?.classList.remove('visible');
    }
  });

  document.querySelectorAll('[data-mode-btn]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setDataMode(btn.dataset.modeBtn);
      updateModeButtonsUI(btn.dataset.modeBtn);
    });
  });
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

// ── Liked Songs View ──────────────────────────────────────────────────────────

function renderLikedSongsView() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  const liked = getLikedSongs();

  if (liked.length === 0) {
    mainContent.innerHTML = `
      <div class="liked-songs-view">
        <div class="liked-songs-hero">
          <div class="liked-songs-hero-art">♥</div>
          <div class="hero-details">
            <span class="hero-type">PLAYLIST</span>
            <h1 class="hero-title">Liked Songs</h1>
            <div class="hero-meta"><span>0 songs</span></div>
          </div>
        </div>
        <div class="empty-state" style="margin-top:48px;">
          <div style="font-size:48px;margin-bottom:16px;">♡</div>
          <p>Songs you like will appear here</p>
          <p class="hint" style="margin-top:8px;color:var(--text-muted);">Hit ♡ on any track to save it</p>
        </div>
      </div>`;
    return;
  }

  mainContent.innerHTML = `
    <div id="playlist-view">
      <div id="hero-section">
        <div class="hero-inner">
          <div class="hero-art-wrap">
            <div class="liked-songs-hero-art">♥</div>
          </div>
          <div class="hero-details">
            <span class="hero-type">PLAYLIST</span>
            <h1 class="hero-title">Liked Songs</h1>
            <div class="hero-meta"><span>${liked.length} songs</span></div>
            <div class="hero-actions">
              <button id="liked-play-all" class="btn btn-primary btn-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                Play All
              </button>
            </div>
          </div>
        </div>
      </div>
      <div id="track-list-container"></div>
    </div>`;

  renderTrackList(liked, 'track-list-container', (track, queue, idx) => {
    loadTrack(track, queue, idx);
  });

  document.getElementById('liked-play-all')?.addEventListener('click', () => {
    if (liked.length > 0) loadTrack(liked[0], liked, 0);
  });
}

// ── Data Mode UI ──────────────────────────────────────────────────────────────

function updateModeButtonsUI(activeMode) {
  document.querySelectorAll('[data-mode-btn]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.modeBtn === activeMode);
  });

  // Update description text
  const desc = document.getElementById('mode-description');
  if (desc) {
    import('./data-mode.js').then(({ DATA_MODES }) => {
      desc.textContent = DATA_MODES[activeMode]?.description || '';
    });
  }
}

