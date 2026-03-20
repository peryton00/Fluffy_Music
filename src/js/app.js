// src/js/app.js — Main entry point for app.html
// Coordinates all modules: auth, player, spotify, youtube, ui, sync.

import { initAuth, loginWithGoogle, logout, isLoggedIn, getCurrentUser } from './auth.js';
import { 
  buildHomeSections, clearHomeSectionsCache, 
  buildTimeOfDaySection, buildChartsSection, buildPersonalizedSections, 
  buildLanguageSection, buildMoodSection, buildGenreSection, buildDecadesSection 
} from './home-sections.js';
import { loadUserLibrary, saveLink, removeLink, isLinkSaved, getLocalLibrary } from './sync.js';
import { parseSpotifyLink, fetchSpotifyData, fetchAllTracks } from './spotify.js';
import { initYouTubeAPI, setVolume } from './youtube.js';
import {
  loadTrack, playPause, nextTrack, prevTrack, getCurrentTrack,
  toggleShuffle, toggleRepeat, seekToPercent, setIsDraggingProgress,
  getIsShuffled, getRepeatMode, getQueue, getActiveQueue, getIndex
} from './player.js';
import {
  showToast, showModal, renderSavedLinks, renderTrackList,
  renderPlaylistHero, renderHomeView, renderLoadingProgress, showSkeleton,
  renderRecentlyPlayed, renderQueuePanel,
  renderLyricsPanel, highlightSyncedLine, renderRecommendationSections
} from './ui.js';
import { FM } from './storage.js';
import { getLikedSongs, toggleLike, updateLikedCountBadge, HEART_ICON, HEART_FILL_ICON } from './likes.js';
import { getDataMode, setDataMode, applyDataMode, getYTQuality } from './data-mode.js';
import { initMediaSession } from './media-session.js';
import {
  fetchLyrics,
  parseSyncedLyrics,
  startSyncedHighlight,
  stopSyncedHighlight
} from './lyrics.js';

// ── App State ─────────────────────────────────────────────────────────────────
let currentPlaylistData = null;
let allLoadedTracks = [];
let isLoadingSpotify = false;
let searchDebounceTimer = null;
let deferredInstallPrompt = null;
let lyricsOpen = false;
let currentLyricsTrackId = null;
let nowPlayingOpen = false;
let npLyricsActive = false;
let currentNPLyricsTrackId = null;
let currentRecsRequestId = 0;

// ── Initialization ────────────────────────────────────────────────────────────


/**
 * Loads home recommendations incrementally.
 */
async function loadHomeRecommendations() {
  const requestId = ++currentRecsRequestId;
  if (!document.getElementById('home-recommendations')) return;

  try {
    const builders = [
      { fn: buildTimeOfDaySection, id: 'tod' },
      { fn: buildChartsSection, id: 'charts' },
      { fn: buildPersonalizedSections, id: 'personal' },
      { fn: buildLanguageSection, id: 'lang' },
      { fn: buildMoodSection, id: 'mood' },
      { fn: buildGenreSection, id: 'genre' },
      { fn: buildDecadesSection, id: 'decades' }
    ];

    for (const item of builders) {
      if (requestId !== currentRecsRequestId) return;

      try {
        const result = await item.fn();
        if (requestId !== currentRecsRequestId) return;

        if (result) {
          const sections = Array.isArray(result) ? result : [result];
          if (sections.length > 0) {
            renderRecommendationSections(sections, (url) => handleSpotifyLink(url), true);
          }
        }
      } catch (e) {
        console.error(`[Recs] Failed to load ${item.id}:`, e);
      }
    }
    } finally {
    if (requestId === currentRecsRequestId) {
      const liveArea = document.getElementById('home-recommendations');
      const loading = liveArea?.querySelector('.home-recs-loading');
      if (loading) loading.remove();
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize YouTube IFrame API
  initYouTubeAPI();

  // 1a. Initialize Media Session API (notification bar / lock screen controls)
  initMediaSession();

  // 2. Initialize Firebase Auth listener
  initAuth(async (user) => {
    if (user) {
      await loadUserLibrary(user.uid);
      // Re-render home view with cloud-synced recent links
      const recentLinks = FM.getSavedLinks().slice(0, 4);
      if (document.querySelector('.home-view')) {
        renderHomeView(recentLinks);
        // Reload recs with personalization
        setTimeout(() => loadHomeRecommendations(), 100);
      }
    } else {
      const links = getLocalLibrary();
      renderAndBindSidebar(links);
      // Clear home view recent grid if on home
      if (document.querySelector('.home-view')) {
        renderHomeView([]);
        setTimeout(() => loadHomeRecommendations(), 100);
      }
    }
    // Always update liked count badge on auth change
    updateLikedCountBadge();
  });

  // 3. Render home view
  const recentLinks = FM.getSavedLinks().slice(0, 4);
  renderHomeView(recentLinks);

  // Note: loadHomeRecommendations is now triggered via the initAuth listener above
  // or via explicit user refresh, avoid calling it a 3rd time here.

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

  // PWA install prompt
  window.addEventListener(
    'beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      showInstallButton();
    });

  window.addEventListener(
    'appinstalled', () => {
      deferredInstallPrompt = null;
      hideInstallButton();
      showToast(
        '🎉 Fluffy Music installed!', 'success');
    });

  attachEventListeners();

  // 8. Load initial sidebar
  const savedLinks = FM.getSavedLinks();
  renderAndBindSidebar(savedLinks);

  // 9. Check URL params
  const params = new URLSearchParams(
    window.location.search);

  // ?url= handles Spotify links redirected
  // from index.html paste form
  const urlParam = params.get('url');
  if (urlParam) {
    handleSpotifyLink(decodeURIComponent(urlParam));
  }

  // ?q= handles shared song search links
  // generated by the in-app share button
  const qParam = params.get('q');
  if (qParam && !urlParam) {
    // Clean the raw query before searching
    // Removes YouTube title noise like pipes,
    // year tags, bracket content, Ft. credits
    const raw = decodeURIComponent(qParam);
    const cleaned = raw
      .split('|')[0]
      .split(' - ')[0]
      .replace(/\bft\.?\s/gi, '')
      .replace(/\(.*?\)/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    // Small delay so home view renders first
    setTimeout(() => {
      searchYouTube(cleaned || raw);
    }, 300);
  }

  // 10. Check offline status
  if (!navigator.onLine) showOfflineBanner();
  window.addEventListener('offline', showOfflineBanner);
  window.addEventListener('online', hideOfflineBanner);

  // 11. Expose handleSpotifyLink for onboarding try button (2F)
  window._handleSpotifyLink = handleSpotifyLink;

  // Auto-refresh lyrics when new track loads + sync Now Playing
  const _origUpdatePlayerBar =
    window.updatePlayerBar;
  window.updatePlayerBar = function(track) {
    if (_origUpdatePlayerBar)
      _origUpdatePlayerBar(track);
    if (lyricsOpen) {
      setTimeout(() => openLyrics(), 600);
    }
    if (nowPlayingOpen) {
      syncNowPlayingState();
    }
    if (nowPlayingOpen && npLyricsActive) {
      setTimeout(() => loadNPLyrics(), 600);
    }
  };

  // Keep Now Playing progress synced every 500ms
  setInterval(() => {
    if (nowPlayingOpen) syncNowPlayingProgress();
  }, 500);
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

  // Auto-close sidebar on mobile after selection
  closeSidebar();

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
      isSaved,
      () => handleSpotifyLink(url)
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
      spotifyId: null, // null so YouTube IDs aren't mistakenly synced as Spotify IDs
    }));

    // 7. Render results — user picks which to play (no auto-play)
    const container = document.getElementById('search-results-container');
    if (container) {
      container.innerHTML = `
        <div class="search-results-wrap">
          <div class="search-results-header" style="padding: 16px 0;">
            <h2 class="section-title">Search Results</h2>
            <p class="search-results-hint">Click a song to play</p>
          </div>
          <div id="search-track-list"></div>
        </div>`;
      renderTrackList(syntheticQueue, 'search-track-list', (track, queue, idx) => {
        FM.setCurrentPlaylist({ name: `Search: ${query}`, tracks: queue, type: 'search', url: '' });
        loadTrack(track, queue, idx);
      });
    }

  } catch (err) {
    showToast('Search failed. Please try again.', 'error');
  }
}

// ── PWA Install Helpers ───────────────────────────────────────────────────────

function showInstallButton() {
  document.getElementById('sidebar-install-btn')
    ?.classList.remove('hidden');
  document.getElementById('sidebar-install-card')
    ?.classList.remove('hidden');
}

function hideInstallButton() {
  document.getElementById('sidebar-install-btn')
    ?.classList.add('hidden');
  document.getElementById('sidebar-install-card')
    ?.classList.add('hidden');
}

async function handleInstallClick() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } =
    await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    deferredInstallPrompt = null;
    hideInstallButton();
  }
}

// ── Lyrics Helpers ────────────────────────────────────────────────────────────

async function openLyrics() {
  const wrap = document.getElementById(
    'lyrics-panel-wrap');
  const titleEl = document.getElementById(
    'lyrics-panel-title');
  const sourceBadge = document.getElementById(
    'lyrics-source-badge');
  if (!wrap) return;

  const track = getCurrentTrack() || FM.getLastPlayed();
  if (!track) {
    wrap.classList.remove('hidden');
    renderLyricsPanel('not_found', null, '');
    return;
  }

  // Toggle closed if same track
  if (lyricsOpen &&
      currentLyricsTrackId === track.id) {
    closeLyrics();
    return;
  }

  lyricsOpen = true;
  currentLyricsTrackId = track.id;
  wrap.classList.remove('hidden');

  document.getElementById('btn-lyrics')
    ?.classList.add('active');

  if (titleEl) {
    titleEl.textContent =
      `${track.name} — ${track.artist}`;
  }
  if (sourceBadge) {
    sourceBadge.classList.add('hidden');
    sourceBadge.textContent = '';
  }

  const bgEl = document.getElementById('lyrics-bg');
  if (bgEl && track.albumArt) {
    bgEl.style.backgroundImage = `url('${track.albumArt}')`;
  }

  renderLyricsPanel(
    'loading', null, track.name);
  stopSyncedHighlight();

  const result = await fetchLyrics(track);

  // Abort if panel was closed during fetch
  // or a new track was loaded
  if (!lyricsOpen ||
      currentLyricsTrackId !== track.id)
    return;

  if (sourceBadge && result.source) {
    sourceBadge.textContent = result.source;
    sourceBadge.classList.remove('hidden');
  }

  if (result.type === 'instrumental') {
    renderLyricsPanel(
      'instrumental', null, track.name);

  } else if (result.type === 'synced') {
    const lines =
      parseSyncedLyrics(result.lyrics);
    renderLyricsPanel(
      'synced', lines, track.name);
    startSyncedHighlight(
      lines,
      () => {
        if (window.ytPlayer &&
          typeof window.ytPlayer
            .getCurrentTime === 'function') {
          return window.ytPlayer
            .getCurrentTime() * 1000;
        }
        return 0;
      },
      (index) => highlightSyncedLine(index)
    );

  } else if (result.type === 'plain') {
    renderLyricsPanel(
      'plain', result.lyrics, track.name);

  } else {
    renderLyricsPanel(
      'not_found', null, track.name);
  }
}

function closeLyrics() {
  lyricsOpen = false;
  currentLyricsTrackId = null;
  stopSyncedHighlight();
  document.getElementById('lyrics-panel-wrap')
    ?.classList.add('hidden');
  document.getElementById('btn-lyrics')
    ?.classList.remove('active');
}

// ── Event Listeners ───────────────────────────────────────────────────────────

function attachEventListeners() {
  // ── Home Button ──
  document.getElementById('btn-home')?.addEventListener('click', () => {
    // 1. Render home view with top 4 recent links
    const recentLinks = FM.getSavedLinks().slice(0, 4);
    renderHomeView(recentLinks);
    
    // 2. Load recommendations incrementally
    setTimeout(() => loadHomeRecommendations(), 100);
    
    // 3. Reset sidebars/panels
    if (typeof closeSidebar === 'function') closeSidebar();
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    
    // 4. Scroll to top
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.scrollTop = 0;
    
    // 5. Clear search input
    const searchInput = document.getElementById('top-search');
    if (searchInput) searchInput.value = '';
  });

  // ── Search Bar (top navbar) ──
  const searchInput = document.getElementById('top-search');
  if (searchInput) {
    // Show search history on focus
    searchInput.addEventListener('focus', () => {
      renderSearchHistoryDropdown();
    });
    searchInput.addEventListener('blur', () => {
      setTimeout(() => {
        const dropdown = document.getElementById('search-history-dropdown');
        dropdown?.classList.add('hidden');
      }, 150);
    });
    searchInput.addEventListener('input', () => {
      const dropdown = document.getElementById('search-history-dropdown');
      if (searchInput.value.trim()) {
        dropdown?.classList.add('hidden');
      } else {
        renderSearchHistoryDropdown();
      }
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchDebounceTimer);
        const val = searchInput.value.trim();
        if (!val) return;
        // Save to search history (only non-Spotify queries)
        if (!parseSpotifyLink(val)) FM.addSearchHistory(val);
        if (parseSpotifyLink(val)) handleSpotifyLink(val);
        else searchYouTube(val);
        document.getElementById('search-history-dropdown')?.classList.add('hidden');
      }
    });

    // Also trigger search on search icon click
    const searchIcon = document.querySelector('.nav-search-icon');
    if (searchIcon) {
      searchIcon.style.cursor = 'pointer';
      searchIcon.addEventListener('click', () => {
        const val = searchInput.value.trim();
        if (!val) return;
        if (!parseSpotifyLink(val)) FM.addSearchHistory(val);
        if (parseSpotifyLink(val)) handleSpotifyLink(val);
        else searchYouTube(val);
      });
    }

    // Clear search history button
    document.getElementById('clear-search-history')?.addEventListener('click', (e) => {
      e.stopPropagation();
      FM.clearSearchHistory();
      document.getElementById('search-history-dropdown')?.classList.add('hidden');
    });
  }

  // ── Liked Songs Sidebar ──
  document.addEventListener('click', (e) => {
    if (e.target.closest('#sidebar-liked')) {
      renderLikedSongsView();
    }
    // Recently Played sidebar (2A)
    if (e.target.closest('#sidebar-recent')) {
      closeSidebar();
      const recentTracks = FM.getRecentTracks();
      renderRecentlyPlayed(recentTracks, (track, queue, idx) => {
        FM.setCurrentPlaylist({ name: 'Recently Played', tracks: queue, type: 'history', url: '' });
        loadTrack(track, queue, idx);
      });
    }
    // Haptic feedback on like button clicks (native app only, silent on web)
    if (e.target.closest('.like-btn')) {
      triggerHaptic();
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
  const overlay = document.getElementById('sidebar-overlay');

  if (hamburger && overlay) {
    hamburger.addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-close')?.addEventListener('click', toggleSidebar);
  }

  // ── Playback Quality (Data Mode) ──
  document.querySelectorAll('[data-mode-btn]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setDataMode(btn.dataset.modeBtn);
      updateModeButtonsUI(btn.dataset.modeBtn);
    });
  });

  // Initial UI state for quality buttons
  updateModeButtonsUI(getDataMode());

  // ── Queue Panel (2C) ──
  document.getElementById('btn-queue')?.addEventListener('click', () => {
    if (window.innerWidth >= 1024) {
      // Desktop: use right panel
      toggleRightPanel('queue');
    } else {
      // Mobile/tablet: use overlay queue panel
      const panel = document.getElementById('queue-panel');
      if (!panel) return;
      const isHidden = panel.classList.toggle('hidden');
      if (!isHidden) {
        const queue = getActiveQueue();
        const idx = getIndex();
        renderQueuePanel(queue, idx, (track, q, i) => {
          const origQ = getQueue();
          loadTrack(track, origQ, getIsShuffled() ? origQ.findIndex(t => t.id === track.id) : i);
        }, 'mobile-queue-list');
      }
    }
  });

  document.getElementById('queue-close')?.addEventListener('click', () => {
    document.getElementById('queue-panel')?.classList.add('hidden');
  });

  // ── PWA Install Buttons ──
  document.getElementById('sidebar-install-btn')
    ?.addEventListener('click',
      handleInstallClick);

  // ── Sidebar Library Refresh ──
  document.getElementById('btn-refresh-library')?.addEventListener('click', async () => {
    if (isLoggedIn()) {
      const user = getCurrentUser();
      await loadUserLibrary(user.uid);
      const links = FM.getSavedLinks();
      renderAndBindSidebar(links);
      showToast('Library synced from cloud ✓', 'success');
    } else {
      const links = getLocalLibrary();
      renderAndBindSidebar(links);
      showToast('Library refreshed ✓', 'success');
    }
  });

  // ── Lyrics Panel ──
  document.getElementById('btn-lyrics')
    ?.addEventListener('click', () => {
      if (window.innerWidth >= 1024) {
        // Desktop: show in right panel
        toggleRightPanel('lyrics');
      } else {
        // Mobile/tablet: full lyrics panel overlay
        openLyrics();
      }
    });

  document.getElementById('lyrics-close')
    ?.addEventListener('click', closeLyrics);

  // ── Sleep Timer (3E) ──
  document.getElementById('btn-sleep')?.addEventListener('click', () => {
    const panel = document.getElementById('sleep-panel');
    panel?.classList.toggle('hidden');
  });

  document.getElementById('sleep-close')?.addEventListener('click', () => {
    document.getElementById('sleep-panel')?.classList.add('hidden');
  });

  document.querySelectorAll('.sleep-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const mins = parseInt(btn.dataset.mins, 10);
      setSleepTimer(mins);
      document.getElementById('sleep-panel')?.classList.add('hidden');
    });
  });

  // ── Keyboard Shortcuts Modal (3F) ──
  document.getElementById('btn-shortcuts')?.addEventListener('click', () => {
    const modal = document.getElementById('shortcuts-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('show');
    }
  });

  document.getElementById('shortcuts-close')?.addEventListener('click', closeShortcutsModal);
  document.getElementById('shortcuts-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('shortcuts-modal')) closeShortcutsModal();
  });

  // ── Now Playing Screen (Mobile) ──

  // Open Now Playing when player bar is tapped on mobile
  const playerBar = document.getElementById('player-bar');
  if (playerBar) {
    playerBar.addEventListener('click', (e) => {
      if (window.innerWidth > 640) return;
      if (e.target.closest('#btn-play') || e.target.closest('#btn-next') ||
          e.target.closest('#btn-prev') || e.target.closest('#progress-bar') ||
          e.target.closest('button')) return;
      if (getCurrentTrack() || FM.getLastPlayed()) openNowPlaying();
    });
  }

  document.getElementById('np-close')
    ?.addEventListener('click', closeNowPlaying);

  // NP Play/Pause
  document.getElementById('np-play')
    ?.addEventListener('click', () => {
      playPause();
    });

  document.getElementById('np-prev')
    ?.addEventListener('click', prevTrack);
  document.getElementById('np-next')
    ?.addEventListener('click', nextTrack);

  document.getElementById('np-shuffle')
    ?.addEventListener('click', () => {
      toggleShuffle();
      const shuffleBtn = document.getElementById('np-shuffle');
      if (shuffleBtn) shuffleBtn.classList.toggle('active', getIsShuffled());
    });

  document.getElementById('np-repeat')
    ?.addEventListener('click', () => {
      toggleRepeat();
      // Give player a tick, then sync the NP repeat button
      setTimeout(() => {
        const repeatBtn = document.getElementById('np-repeat');
        if (!repeatBtn) return;
        const mode = getRepeatMode();
        repeatBtn.dataset.mode = mode;
        repeatBtn.classList.toggle('active', mode !== 'none');
        repeatBtn.setAttribute('aria-label',
          mode === 'one' ? 'Repeat one (on)' :
          mode === 'all' ? 'Repeat all (on)' :
          'Repeat (off)');
      }, 80);
    });

  // NP Like button
  document.getElementById('np-like-btn')
    ?.addEventListener('click', () => {
      const track = getCurrentTrack() || FM.getLastPlayed();
      if (!track) return;
      import('./likes.js').then(({ toggleLike }) => {
        toggleLike(track).then(liked => {
          const btn = document.getElementById('np-like-btn');
          if (btn) {
            btn.innerHTML = liked ? HEART_FILL_ICON : HEART_ICON;
            btn.classList.toggle('liked', liked);
          }
        });
      });
    });

  // NP Progress bar
  const npBar = document.getElementById('np-progress-bar');
  if (npBar) {
    npBar.addEventListener('click', (e) => {
      const rect = npBar.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      seekToPercent(Math.max(0, Math.min(100, pct)));
    });
    let npDragging = false;
    npBar.addEventListener('touchstart', () => {
      npDragging = true;
      setIsDraggingProgress(true);
    }, { passive: true });
    document.addEventListener('touchend', () => {
      if (npDragging) { npDragging = false; setIsDraggingProgress(false); }
    });
    document.addEventListener('touchmove', (e) => {
      if (!npDragging) return;
      const rect = npBar.getBoundingClientRect();
      const pct = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
      seekToPercent(Math.max(0, Math.min(100, pct)));
    }, { passive: true });
  }

  // NP Lyrics tab toggle
  document.getElementById('np-lyrics-tab')
    ?.addEventListener('click', () => {
      npLyricsActive = !npLyricsActive;
      const artView = document.getElementById('np-art-view');
      const lyricsView = document.getElementById('np-lyrics-view');
      const lyricsTab = document.getElementById('np-lyrics-tab');
      if (npLyricsActive) {
        artView?.classList.add('hidden');
        lyricsView?.classList.remove('hidden');
        lyricsTab?.classList.add('active');
        loadNPLyrics();
      } else {
        artView?.classList.remove('hidden');
        lyricsView?.classList.add('hidden');
        lyricsTab?.classList.remove('active');
      }
    });

  // NP Queue button
  document.getElementById('np-queue-btn')
    ?.addEventListener('click', () => {
      closeNowPlaying();
      setTimeout(() => document.getElementById('btn-queue')?.click(), 420);
    });

  // NP Sleep button
  document.getElementById('np-sleep-btn')
    ?.addEventListener('click', () => {
      closeNowPlaying();
      setTimeout(() => document.getElementById('btn-sleep')?.click(), 420);
    });

  // NP Share button
  document.getElementById('np-share-btn')
    ?.addEventListener('click', async () => {
      const track = getCurrentTrack() || FM.getLastPlayed();
      if (!track) return;
      const shareQuery = track.album === 'YouTube Radio'
        ? track.name
        : `${track.name} ${track.artist}`;
      const shareData = {
        title: 'Fluffy Music',
        text: `🎵 ${track.name} by ${track.artist}`,
        url: `https://fluffy-music.vercel.app/app.html?q=${encodeURIComponent(shareQuery)}`
      };
      try {
        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          await navigator.clipboard.writeText(shareData.url);
          if (window.showToast) window.showToast('Added to Liked Songs', 'success');
        }
      } catch (e) {}
    });

  // ── Wire right panel, mobile search, and bottom nav ──
  // ── Refresh Recommendations ──
  document.getElementById('btn-refresh-recs')?.addEventListener('click', () => {
    clearHomeSectionsCache();
    const recentLinks = FM.getSavedLinks().slice(0, 4);
    renderHomeView(recentLinks);
    setTimeout(() => loadHomeRecommendations(), 100);
    if (window.showToast) window.showToast('Refreshing recommendations...', 'info');
  });

    wireRightPanel();
  wireMobileSearch();
  wireBottomNav();
}


// ── Right Panel (desktop Queue / Lyrics) ─────────────────────────────────────

let rightPanelCurrentTab = null; // 'queue' | 'lyrics'

function toggleRightPanel(tab) {
  const panel = document.getElementById('right-panel');
  if (!panel) return;

  const isSameTab = rightPanelCurrentTab === tab;
  const isHidden = panel.classList.contains('hidden');

  if (!isHidden && isSameTab) {
    panel.classList.add('hidden');
    rightPanelCurrentTab = null;
    document.getElementById('btn-queue')?.classList.remove('active');
    document.getElementById('btn-lyrics')?.classList.remove('active');
    return;
  }

  panel.classList.remove('hidden');
  rightPanelCurrentTab = tab;
  switchRightPanelTab(tab);

  document.getElementById('btn-queue')?.classList.toggle('active', tab === 'queue');
  document.getElementById('btn-lyrics')?.classList.toggle('active', tab === 'lyrics');
}

function switchRightPanelTab(tab) {
  const queueContent = document.getElementById('rp-queue-content');
  const lyricsContent = document.getElementById('rp-lyrics-content');
  const queueTab = document.getElementById('rp-tab-queue');
  const lyricsTab = document.getElementById('rp-tab-lyrics');
  if (!queueContent || !lyricsContent) return;

  if (tab === 'queue') {
    queueContent.classList.remove('hidden');
    lyricsContent.classList.add('hidden');
    queueTab?.classList.add('active');
    lyricsTab?.classList.remove('active');
    // Render queue directly into the right panel's queue-list
    // Use getActiveQueue so it shows shuffled tracks if shuffle is on
    const queue = getActiveQueue();
    const idx = getIndex();
    const listEl = document.getElementById('queue-list');
    if (listEl) {
      // Generate queue HTML same format as existing queue items
      if (!queue || queue.length === 0) {
        listEl.innerHTML = '<div class="queue-empty"><p>No tracks in queue.</p></div>';
      } else {
        const upcoming = queue.slice(idx);
        const previous = queue.slice(0, idx);
        let html = '';
        if (upcoming.length > 0) {
          html += '<p class="queue-section-label">Now &amp; Up Next</p>';
          html += upcoming.map((track, i) => {
            const realIdx = idx + i;
            const isCurrent = i === 0;
            return `<div class="queue-item${isCurrent ? ' queue-current' : ''}" data-index="${realIdx}" role="button" tabindex="0">
              <img class="queue-art" src="${track.albumArt || '/src/img/logo.png'}" alt="" onerror="this.src='/src/img/logo.png'" loading="lazy">
              <div class="queue-info">
                <span class="queue-track-name">${track.name || 'Unknown'}</span>
                <span class="queue-track-artist">${track.artist || 'Unknown'}</span>
              </div>
              ${isCurrent ? '<span class="queue-playing-badge">Playing</span>' : ''}
            </div>`;
          }).join('');
        }
        if (previous.length > 0) {
          html += '<p class="queue-section-label queue-history-label">Previously Played</p>';
          html += [...previous].reverse().map((track, i) => {
            const realIdx = idx - i - 1;
            return `<div class="queue-item queue-prev" data-index="${realIdx}" role="button" tabindex="0">
              <img class="queue-art" src="${track.albumArt || '/src/img/logo.png'}" alt="" onerror="this.src='/src/img/logo.png'" loading="lazy">
              <div class="queue-info">
                <span class="queue-track-name">${track.name || 'Unknown'}</span>
                <span class="queue-track-artist">${track.artist || 'Unknown'}</span>
              </div>
            </div>`;
          }).join('');
        }
        listEl.innerHTML = html;
        // Wire click handlers
        listEl.querySelectorAll('.queue-item').forEach(item => {
          item.addEventListener('click', () => {
            const i = parseInt(item.dataset.index, 10);
            const track = queue[i];
            if (track) {
              const origQ = getQueue();
              loadTrack(track, origQ, getIsShuffled() ? origQ.findIndex(t => t.id === track.id) : i);
            }
          });
        });
        const current = listEl.querySelector('.queue-current');
        if (current) setTimeout(() => current.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      }
    }
  } else if (tab === 'lyrics') {
    lyricsContent.classList.remove('hidden');
    queueContent.classList.add('hidden');
    lyricsTab?.classList.add('active');
    queueTab?.classList.remove('active');
    openRightPanelLyrics();
  }
  rightPanelCurrentTab = tab;
}

async function openRightPanelLyrics() {
  const track = getCurrentTrack() || FM.getLastPlayed();
  const panel = document.getElementById('rp-lyrics-panel');
  if (!panel) return;
  if (!track) {
    panel.innerHTML = '<div class="lyrics-empty"><div class="lyrics-empty-icon">🎵</div><p class="lyrics-empty-title">No track playing</p></div>';
    return;
  }
  panel.innerHTML = '<div class="lyrics-loading"><div class="lyrics-spinner"></div><p>Finding lyrics...</p></div>';
  try {
    const result = await fetchLyrics(track);
    if (result.type === 'instrumental') {
      panel.innerHTML = '<div class="lyrics-empty"><div class="lyrics-empty-icon">🎵</div><p class="lyrics-empty-title">Instrumental Track</p></div>';
    } else if (result.type === 'not_found') {
      panel.innerHTML = `<div class="lyrics-empty"><div class="lyrics-empty-icon">🎤</div><p class="lyrics-empty-title">No Lyrics Found</p><p class="lyrics-empty-sub">Couldn't find lyrics for "${track.name}".</p></div>`;
    } else if (result.type === 'plain') {
      const html = (result.lyrics || '').split('\n').map(l => l.trim()
        ? `<p class="lyric-line">${l}</p>`
        : `<p class="lyric-spacer"></p>`).join('');
      panel.innerHTML = `<div class="lyrics-plain">${html}</div>`;
    } else if (result.type === 'synced') {
      const lines = parseSyncedLyrics(result.lyrics);
      const html = lines.map((line, i) =>
        `<p class="lyric-line lyric-synced-line" data-index="${i}" data-time="${line.timeMs}">${line.text}</p>`
      ).join('');
      panel.innerHTML = `<div class="lyrics-synced">${html}</div>`;
      // Highlight synced lines using the panel's own elements
      startSyncedHighlight(
        lines,
        () => window.ytPlayer?.getCurrentTime?.() * 1000 || 0,
        (index) => {
          panel.querySelectorAll('.lyric-synced-line').forEach((el, i) => {
            const diff = Math.abs(i - index);
            el.classList.toggle('lyric-active', i === index);
            el.classList.toggle('lyric-near', diff === 1);
            el.style.opacity = i === index ? '1' : diff === 1 ? '0.5' : diff === 2 ? '0.35' : '0.2';
            el.style.fontSize = i === index ? '22px' : diff === 1 ? '18px' : '16px';
          });
          const active = panel.querySelector('.lyric-active');
          if (active) active.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      );
    }
  } catch (e) {
    panel.innerHTML = '<div class="lyrics-empty"><p class="lyrics-empty-title">Could not load lyrics</p></div>';
  }
}

function wireRightPanel() {
  document.getElementById('rp-tab-queue')?.addEventListener('click', () => switchRightPanelTab('queue'));
  document.getElementById('rp-tab-lyrics')?.addEventListener('click', () => switchRightPanelTab('lyrics'));
  document.getElementById('right-panel-close')?.addEventListener('click', () => {
    document.getElementById('right-panel')?.classList.add('hidden');
    rightPanelCurrentTab = null;
    document.getElementById('btn-queue')?.classList.remove('active');
    document.getElementById('btn-lyrics')?.classList.remove('active');
  });
}

// ── Mobile Search View ────────────────────────────────────────────────────────

function openMobileSearch() {
  const view = document.getElementById('mobile-search-view');
  if (!view) return;

  const historyList = document.getElementById('mobile-search-history-list');
  if (historyList) {
    const history = FM.getSearchHistory();
    if (history.length === 0) {
      historyList.innerHTML = '<div class="mobile-search-history-empty" style="color:var(--text-secondary);padding:10px 0;">No recent searches</div>';
    } else {
      historyList.innerHTML = history.map(q => `
        <div class="search-history-item" tabindex="0" role="button" style="padding:12px 0;">${escapeHtml(q)}</div>
      `).join('');
      historyList.querySelectorAll('.search-history-item').forEach(item => {
        item.addEventListener('click', () => {
          const val = item.textContent;
          closeMobileSearch();
          if (parseSpotifyLink(val)) handleSpotifyLink(val);
          else searchYouTube(val);
        });
      });
    }
  }

  view.classList.remove('hidden');
  view.classList.add('visible');
  setTimeout(() => document.getElementById('mobile-search-input')?.focus(), 100);
}

function closeMobileSearch() {
  const view = document.getElementById('mobile-search-view');
  if (!view) return;
  view.classList.remove('visible');
  view.classList.add('hidden');
  const inp = document.getElementById('mobile-search-input');
  if (inp) inp.value = '';
}

function wireMobileSearch() {
  const input = document.getElementById('mobile-search-input');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = input.value.trim();
        if (!val) return;
        closeMobileSearch();
        if (parseSpotifyLink(val)) handleSpotifyLink(val);
        else searchYouTube(val);
      }
    });
  }
  document.getElementById('mobile-search-cancel')?.addEventListener('click', closeMobileSearch);
}

// ── Bottom Navigation (mobile only) ──────────────────────────────────────────

function setBottomNavActive(id) {
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.id === id);
  });
}

function wireBottomNav() {
  document.getElementById('bnav-home')?.addEventListener('click', () => {
    setBottomNavActive('bnav-home');
    closeMobileSearch();
    if (!document.querySelector('.home-view')) {
      renderHomeView(FM.getSavedLinks().slice(0, 4));
    }
  });

  document.getElementById('bnav-search')?.addEventListener('click', () => {
    setBottomNavActive('bnav-search');
    openMobileSearch();
  });

  document.getElementById('bnav-library')?.addEventListener('click', () => {
    setBottomNavActive('bnav-library');
    closeMobileSearch();
    renderMobileLibraryView(
      FM.getSavedLinks(),
      (link) => handleSpotifyLink(link.url),
      removeLink,
      renderLikedSongsView
    );
  });

  document.getElementById('bnav-liked')?.addEventListener('click', () => {
    setBottomNavActive('bnav-liked');
    closeMobileSearch();
    renderLikedSongsView();
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

  // '?' key: Show keyboard shortcuts modal (3F)
  else if (e.key === '?') {
    const modal = document.getElementById('shortcuts-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('show');
    }
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

// ── Sidebar Helpers ───────────────────────────────────────────────────────────

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const hamburger = document.getElementById('hamburger');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar || !hamburger || !overlay) return;

  const isOpen = sidebar.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', isOpen);
  overlay.style.opacity = isOpen ? '1' : '0';
  overlay.style.pointerEvents = isOpen ? 'auto' : 'none';
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const hamburger = document.getElementById('hamburger');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar || !hamburger || !overlay) return;

  if (sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    overlay.classList.remove('visible', 'active');
  }
}

function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const hamburger = document.getElementById('hamburger');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar) return;

  sidebar.classList.add('open');
  if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
  if (overlay) {
    overlay.classList.add('visible', 'active');
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';
  }
}

// ── Liked Songs View ──────────────────────────────────────────────────────────

function renderLikedSongsView() {
  // Auto-close sidebar on mobile
  closeSidebar();

  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  const liked = getLikedSongs();

  if (liked.length === 0) {
    mainContent.innerHTML = `
      <div class="liked-songs-view">
        <div class="liked-songs-hero">
          <div class="liked-songs-hero-art">${HEART_FILL_ICON.replace('width="16" height="16"', 'width="64" height="64"').replace('currentColor', 'white')}</div>
          <div class="hero-details">
            <span class="hero-type">PLAYLIST</span>
            <h1 class="hero-title">Liked Songs</h1>
            <div class="hero-meta"><span>0 songs</span></div>
          </div>
        </div>
        <div class="empty-state" style="margin-top:48px;">
          <div style="font-size:48px;margin-bottom:16px;">${HEART_ICON.replace('width="16" height="16"', 'width="48" height="48"')}</div>
          <h2 style="font-size:24px;margin-bottom:8px;">Your Liked Songs</h2>
          <p class="hint" style="margin-top:8px;color:var(--text-muted);">Hit the heart icon on any track to save it</p>
        </div>
      </div>`;
    return;
  }

  mainContent.innerHTML = `
    <div id="playlist-view">
      <div id="hero-section">
        <div class="hero-inner">
          <div class="hero-art-wrap">
            <div class="liked-songs-hero-art">${HEART_FILL_ICON.replace('width="16" height="16"', 'width="64" height="64"').replace('currentColor', 'white')}</div>
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
    FM.setCurrentPlaylist({ name: 'Liked Songs', tracks: queue, type: 'liked', url: '' });
    loadTrack(track, queue, idx);
  });

  document.getElementById('liked-play-all')?.addEventListener('click', () => {
    if (liked.length > 0) {
      FM.setCurrentPlaylist({ name: 'Liked Songs', tracks: liked, type: 'liked', url: '' });
      loadTrack(liked[0], liked, 0);
    }
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

// ── Shortcuts Modal (3F) ─────────────────────────────────────────────────────

function closeShortcutsModal() {
  const modal = document.getElementById('shortcuts-modal');
  if (!modal) return;
  modal.classList.remove('show');
  setTimeout(() => modal.classList.add('hidden'), 250);
}

// ── Sleep Timer (3E) ─────────────────────────────────────────────────────────

let sleepTimerTimeout = null;
let sleepTimerInterval = null;

function setSleepTimer(mins) {
  // Cancel existing timer
  clearTimeout(sleepTimerTimeout);
  clearInterval(sleepTimerInterval);

  const btn = document.getElementById('btn-sleep');
  const status = document.getElementById('sleep-status');

  if (mins === 0) {
    if (btn) { btn.classList.remove('active'); btn.title = 'Sleep timer: Off'; }
    if (status) { status.textContent = ''; status.classList.add('hidden'); }
    showToast('Sleep timer cancelled', 'info');
    return;
  }

  let msLeft = mins * 60 * 1000;
  if (btn) { btn.classList.add('active'); }
  if (status) status.classList.remove('hidden');

  const updateStatus = () => {
    const minsLeft = Math.ceil(msLeft / 60000);
    const secsLeft = Math.ceil((msLeft % 60000) / 1000);
    const label = minsLeft > 1 ? `${minsLeft}m` : `${secsLeft}s`;
    if (btn) btn.title = `Sleep timer: ${label}`;
    if (status) status.textContent = `Sleeping in ${label}`;
    msLeft -= 1000;
  };

  updateStatus();
  sleepTimerInterval = setInterval(() => {
    if (msLeft <= 0) {
      clearInterval(sleepTimerInterval);
      return;
    }
    updateStatus();
  }, 1000);

  sleepTimerTimeout = setTimeout(() => {
    clearInterval(sleepTimerInterval);
    import('./youtube.js').then(YTmod => YTmod.pause()).catch(() => {});
    if (btn) { btn.classList.remove('active'); btn.title = 'Sleep timer: Off'; }
    if (status) { status.textContent = ''; status.classList.add('hidden'); }
    showToast('Good night! Music paused 🌙', 'info');
  }, mins * 60 * 1000);

  showToast(`Sleep timer set for ${mins} min`, 'success');
}

// ── Search History Dropdown (2B) ─────────────────────────────────────────────

function renderSearchHistoryDropdown() {
  const dropdown = document.getElementById('search-history-dropdown');
  const list = document.getElementById('search-history-list');
  if (!dropdown || !list) return;

  const history = FM.getSearchHistory();
  if (history.length === 0) {
    dropdown.classList.add('hidden');
    return;
  }

  list.innerHTML = history.map(q => `
    <div class="search-history-item" tabindex="0" role="button">${escapeHtml(q)}</div>
  `).join('');

  list.querySelectorAll('.search-history-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const val = item.textContent.trim();
      const input = document.getElementById('top-search');
      if (input) { input.value = val; input.focus(); }
      dropdown.classList.add('hidden');
      if (parseSpotifyLink(val)) handleSpotifyLink(val);
      else searchYouTube(val);
    });
  });

  dropdown.classList.remove('hidden');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Now Playing Screen (Mobile) ───────────────────────────────────────────────

function openNowPlaying() {
  const screen = document.getElementById('now-playing-screen');
  if (!screen) return;
  nowPlayingOpen = true;
  screen.classList.remove('hidden');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => screen.classList.add('visible'));
  });
  syncNowPlayingState();
  initNowPlayingSwipe(screen);
  if (window.lucide) window.lucide.createIcons();
}

function closeNowPlaying() {
  const screen = document.getElementById('now-playing-screen');
  if (!screen) return;
  nowPlayingOpen = false;
  screen.classList.remove('visible');
  setTimeout(() => screen.classList.add('hidden'), 400);
}

function syncNowPlayingState() {
  const track = getCurrentTrack() || FM.getLastPlayed();
  if (!track) return;

  // Album art
  const art = document.getElementById('np-album-art');
  if (art) {
    art.src = track.albumArt || '/src/img/logo.png';
    art.onerror = () => { art.src = '/src/img/logo.png'; };
  }

  // Track name & artist
  const name = document.getElementById('np-track-name');
  const artist = document.getElementById('np-track-artist');
  if (name) name.textContent = track.name || '–';
  if (artist) artist.textContent = track.artist || '–';

  // Like button
  import('./likes.js').then(({ isLiked }) => {
    const likeBtn = document.getElementById('np-like-btn');
    if (likeBtn) {
      const liked = isLiked(track.id);
      likeBtn.innerHTML = liked ? HEART_FILL_ICON : HEART_ICON;
      likeBtn.dataset.trackId = track.id;
      likeBtn.classList.toggle('liked', liked);
      likeBtn.title = liked ? 'Remove from Liked Songs' : 'Add to Liked Songs';
      likeBtn.setAttribute('aria-label', liked ? 'Remove from Liked Songs' : 'Add to Liked Songs');
    }
  });

  // Play/Pause button initial state on open
  import('./youtube.js').then(YTmod => {
    const btn = document.getElementById('np-play');
    if (!btn) return;
    const isPlaying = YTmod.getPlayerState?.() === 1 || YTmod.getPlayerState?.() === 3;
    const NP_PLAY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true" style="margin-left: 3px;"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>`;
    const NP_PAUSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>`;
    btn.innerHTML = isPlaying ? NP_PAUSE_ICON : NP_PLAY_ICON;
    btn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  });

  // Shuffle button active state
  const shuffleBtn = document.getElementById('np-shuffle');
  if (shuffleBtn) shuffleBtn.classList.toggle('active', getIsShuffled());

  // Repeat button mode
  const repeatBtn = document.getElementById('np-repeat');
  if (repeatBtn) {
    const mode = getRepeatMode(); // 'none' | 'all' | 'one'
    repeatBtn.dataset.mode = mode;
    repeatBtn.classList.toggle('active', mode !== 'none');
    repeatBtn.setAttribute('aria-label',
      mode === 'one' ? 'Repeat one (on)' :
      mode === 'all' ? 'Repeat all (on)' :
      'Repeat (off)');
  }

  // Refresh lyrics if the panel is active
  if (npLyricsActive) {
    loadNPLyrics();
  }

  syncNowPlayingProgress();
}

function syncNowPlayingProgress() {
  if (!nowPlayingOpen) return;
  const mainFill = document.getElementById('progress-fill');
  const mainThumb = document.getElementById('progress-thumb');
  const mainCurrent = document.getElementById('time-current');
  const mainTotal = document.getElementById('time-total');
  const npFill = document.getElementById('np-progress-fill');
  const npThumb = document.getElementById('np-progress-thumb');
  const npCurrent = document.getElementById('np-time-current');
  const npTotal = document.getElementById('np-time-total');

  if (mainFill && npFill) npFill.style.width = mainFill.style.width;
  if (mainThumb && npThumb) npThumb.style.left = mainThumb.style.left;
  if (mainCurrent && npCurrent) npCurrent.textContent = mainCurrent.textContent;
  if (mainTotal && npTotal) npTotal.textContent = mainTotal.textContent;
}

function initNowPlayingSwipe(screen) {
  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  // Remove existing listeners to avoid duplicates on re-open
  screen._touchStartHandler && screen.removeEventListener('touchstart', screen._touchStartHandler);
  screen._touchMoveHandler && screen.removeEventListener('touchmove', screen._touchMoveHandler);
  screen._touchEndHandler && screen.removeEventListener('touchend', screen._touchEndHandler);

  screen._touchStartHandler = (e) => {
    if (e.target.closest('button') || e.target.closest('.np-progress-bar') ||
        e.target.closest('.np-lyrics-view')) return;
    startY = e.touches[0].clientY;
    isDragging = true;
  };
  screen._touchMoveHandler = (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    if (diff > 0) screen.style.transform = `translateY(${diff}px)`;
  };
  screen._touchEndHandler = () => {
    if (!isDragging) return;
    isDragging = false;
    const diff = currentY - startY;
    screen.style.transform = '';
    if (diff > 120) closeNowPlaying();
    startY = 0; currentY = 0;
  };

  screen.addEventListener('touchstart', screen._touchStartHandler, { passive: true });
  screen.addEventListener('touchmove', screen._touchMoveHandler, { passive: true });
  screen.addEventListener('touchend', screen._touchEndHandler);
}

async function loadNPLyrics() {
  const track = getCurrentTrack() || FM.getLastPlayed();
  if (!track) return;
  
  // Prevent redundant fetches if we already loaded this track's lyrics
  if (currentNPLyricsTrackId === track.id) return;
  
  const npContent = document.getElementById('np-lyrics-content');
  if (!npContent) return;

  npContent.innerHTML = `<div class="np-lyrics-loading"><div class="lyrics-spinner"></div></div>`;
  currentNPLyricsTrackId = track.id;

  try {
    const result = await fetchLyrics(track);
    
    // Check if user changed the track while we were fetching
    const currentTrack = getCurrentTrack() || FM.getLastPlayed();
    if (currentTrack && currentTrack.id !== track.id) return;

    if (result.type === 'instrumental') {
      npContent.innerHTML = `<div class="np-lyrics-empty">🎵 Instrumental Track</div>`;
      return;
    }
    if (result.type === 'not_found') {
      npContent.innerHTML = `<div class="np-lyrics-empty">🎤 No lyrics found for this song.</div>`;
      return;
    }
    if (result.type === 'synced') {
      const lines = parseSyncedLyrics(result.lyrics);
      renderNPSyncedLyrics(lines);
      startSyncedHighlight(
        lines,
        () => window.ytPlayer?.getCurrentTime?.() * 1000 || 0,
        (index) => highlightNPLine(index)
      );
      return;
    }
    if (result.type === 'plain') {
      const linesHtml = result.lyrics.split('\n').map(l => l.trim())
        .map(l => l
          ? `<p class="np-lyric-plain-line">${escapeHtmlLocal(l)}</p>`
          : `<p class="np-lyric-spacer"></p>`)
        .join('');
      npContent.innerHTML = `<div class="np-plain-lyrics">${linesHtml}</div>`;
    }
  } catch (e) {
    npContent.innerHTML = `<div class="np-lyrics-empty">🎤 Couldn't load lyrics.</div>`;
  }
}

function renderNPSyncedLyrics(lines) {
  const npContent = document.getElementById('np-lyrics-content');
  if (!npContent) return;
  npContent.innerHTML = lines.map((line, i) =>
    `<p class="np-lyric-synced" data-index="${i}">${escapeHtmlLocal(line.text)}</p>`
  ).join('');
}

function highlightNPLine(index) {
  const npContent = document.getElementById('np-lyrics-content');
  if (!npContent) return;
  npContent.querySelectorAll('.np-lyric-synced').forEach((el, i) => {
    const diff = Math.abs(i - index);
    el.classList.toggle('np-lyric-active', i === index);
    el.style.opacity = i === index ? '1' :
      diff === 1 ? '0.5' : diff === 2 ? '0.3' : '0.15';
    el.style.fontSize = i === index ? '22px' : '18px';
    el.style.fontWeight = i === index ? '700' : '400';
  });
  const active = npContent.querySelector('.np-lyric-active');
  if (active) active.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function escapeHtmlLocal(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}



// ── Haptic Feedback ───────────────────────────────────────────────────────────

function triggerHaptic() {
  try {
    if (navigator.vibrate) navigator.vibrate(30);
  } catch (e) {}
}

