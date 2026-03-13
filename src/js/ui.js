// src/js/ui.js — All DOM rendering functions
// Functions are exported AND registered on window for cross-module access.

import { formatTime } from './player.js';
import { isLiked, toggleLike, updateAllHeartButtons } from './likes.js';

// ── Toast Notifications ───────────────────────────────────────────────────────

let toastQueue = [];
let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  }
  return toastContainer;
}

/**
 * Shows a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
export function showToast(message, type = 'success') {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;

  container.appendChild(toast);

  // Trigger slide-in
  requestAnimationFrame(() => toast.classList.add('show'));

  // Auto-dismiss
  const timer = setTimeout(() => dismissToast(toast), 3000);
  toast._dismissTimer = timer;

  toast.addEventListener('click', () => {
    clearTimeout(toast._dismissTimer);
    dismissToast(toast);
  });
}

function dismissToast(toast) {
  toast.classList.remove('show');
  setTimeout(() => toast.remove(), 300);
}

// ── Modal ─────────────────────────────────────────────────────────────────────

/**
 * Shows a centered confirmation modal.
 * @param {string} title
 * @param {string} message
 * @param {Function} onConfirm
 * @param {Function} onCancel
 */
export function showModal(title, message, onConfirm, onCancel) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h2 id="modal-title" class="modal-title">${title}</h2>
      <p class="modal-message">${message}</p>
      <div class="modal-actions">
        <button id="modal-confirm" class="btn btn-primary">Confirm</button>
        <button id="modal-cancel" class="btn btn-secondary">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));

  const closeModal = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 300);
  };

  overlay.querySelector('#modal-confirm').addEventListener('click', () => {
    closeModal();
    if (onConfirm) onConfirm();
  });
  overlay.querySelector('#modal-cancel').addEventListener('click', () => {
    closeModal();
    if (onCancel) onCancel();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) { closeModal(); if (onCancel) onCancel(); }
  });
}

// ── Skeleton Loading ──────────────────────────────────────────────────────────

/**
 * Inserts shimmer skeleton rows into a container.
 * @param {string} containerId
 * @param {number} count
 */
export function showSkeleton(containerId, count = 8) {
  const el = document.getElementById(containerId);
  if (!el) return;
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton-row">
        <div class="skeleton skeleton-num"></div>
        <div class="skeleton skeleton-art"></div>
        <div class="skeleton-info">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-sub"></div>
        </div>
        <div class="skeleton skeleton-dur"></div>
      </div>`;
  }
  el.innerHTML = html;
}

export function hideSkeleton(containerId) {
  // The actual content render replaces skeletons automatically
}

// ── Track List ────────────────────────────────────────────────────────────────

/**
 * Renders an interactive track list into a container.
 * @param {Array} tracks
 * @param {string} containerId
 * @param {Function} onTrackClick - (track, tracks, index) => void
 */
export function renderTrackList(tracks, containerId, onTrackClick) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!tracks || tracks.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>No tracks found.</p></div>`;
    return;
  }

  const rows = tracks.map((track, i) => `
    <div class="track-row" data-index="${i}" data-id="${track.id}" role="row" tabindex="0" aria-label="${track.name} by ${track.artist}">
      <div class="track-num-cell">
        <span class="track-number">${i + 1}</span>
        <span class="track-play-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </span>
        <div class="music-bars paused" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
      </div>
      <img class="track-art" src="${track.albumArt || '/src/img/logo.png'}" 
           alt="${track.album}" 
           onerror="this.src='/src/img/logo.png'" 
           loading="lazy">
      <div class="track-info">
        <span class="track-name">${escapeHtml(track.name || track.title || 'Unknown Track')}</span>
        <span class="track-artist">${escapeHtml(track.artists || track.artist || track.channelName || 'Unknown Artist')}</span>
      </div>
      <span class="track-album hide-mobile">${escapeHtml(track.album)}</span>
      <span class="track-duration">${formatTime(track.duration)}</span>
      <button class="like-btn${isLiked(track.id) ? ' liked' : ''}" 
              data-track-id="${track.id}"
              aria-label="${isLiked(track.id) ? 'Remove from Liked Songs' : 'Add to Liked Songs'}"
              title="${isLiked(track.id) ? 'Remove from Liked Songs' : 'Add to Liked Songs'}"
              >${isLiked(track.id) ? '♥' : '♡'}</button>
    </div>
  `).join('');

  container.innerHTML = `<div class="track-list" role="table">${rows}</div>`;

  // Attach click events
  container.querySelectorAll('.track-row').forEach((row) => {
    const clickHandler = (e) => {
      // Don't trigger track play when clicking the like button
      if (e.target.classList.contains('like-btn')) return;
      const idx = parseInt(row.dataset.index, 10);
      if (onTrackClick) onTrackClick(tracks[idx], tracks, idx);
    };
    row.addEventListener('click', clickHandler);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickHandler(e); }
    });
  });

  // Attach like button events
  container.querySelectorAll('.like-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const trackId = btn.dataset.trackId;
      const idx = tracks.findIndex((t) => String(t.id) === String(trackId));
      if (idx !== -1) toggleLike(tracks[idx]);
    });
  });
}

// ── Playlist Hero ─────────────────────────────────────────────────────────────

/**
 * Renders the playlist/album hero section.
 * @param {object} data - API response data (name, coverArt, etc.)
 * @param {Function} onPlayAll
 * @param {Function} onSave
 * @param {boolean} isSaved
 */
export function renderPlaylistHero(data, onPlayAll, onSave, isSaved) {
  const container = document.getElementById('hero-section');
  if (!container) return;

  const totalMs = (data.tracks || []).reduce((acc, t) => acc + (t.duration || 0), 0);
  const totalMin = Math.floor(totalMs / 60000);
  const totalHr = Math.floor(totalMin / 60);
  const durationStr = totalHr > 0
    ? `${totalHr} hr ${totalMin % 60} min`
    : `${totalMin} min`;

  container.innerHTML = `
    <div class="hero-inner">
      <div class="hero-art-wrap">
        <img class="hero-art" 
             src="${data.coverArt || '/src/img/logo.png'}" 
             alt="${escapeHtml(data.name)}"
             onerror="this.src='/src/img/logo.png'">
      </div>
      <div class="hero-details">
        <span class="hero-type">${(data.type || 'playlist').toUpperCase()}</span>
        <h1 class="hero-title">${escapeHtml(data.name)}</h1>
        ${data.description ? `<p class="hero-desc">${escapeHtml(data.description)}</p>` : ''}
        <div class="hero-meta">
          <span>${data.totalTracks} tracks</span>
          ${totalMs > 0 ? `<span>·</span><span>${durationStr}</span>` : ''}
        </div>
        <div class="hero-actions">
          <button id="hero-play-all" class="btn btn-primary btn-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            Play All
          </button>
          <button id="hero-shuffle" class="btn btn-outlined btn-icon">
            <i data-lucide="shuffle"></i>
            Shuffle
          </button>
          ${!isSaved ? `
          <button id="hero-save" class="btn btn-outlined save-btn btn-icon">
            <i data-lucide="bookmark"></i>
            Save to Library
          </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  document.getElementById('hero-play-all')?.addEventListener('click', () => {
    if (onPlayAll) onPlayAll();
  });

  document.getElementById('hero-shuffle')?.addEventListener('click', () => {
    if (onPlayAll) onPlayAll(true);
  });

  document.getElementById('hero-save')?.addEventListener('click', () => {
    if (onSave) onSave();
  });
}

// ── Saved Links (Sidebar) ─────────────────────────────────────────────────────

/**
 * Renders the saved library links in the sidebar.
 * @param {Array} links
 * @param {Function} onLinkClick
 * @param {Function} onLinkRemove
 */
export function renderSavedLinks(links, onLinkClick, onLinkRemove) {
  const container = document.getElementById('saved-links-list');
  if (!container) return;

  if (!links || links.length === 0) {
    container.innerHTML = `
      <div class="empty-library">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
        <p>No saved links yet.</p>
        <p class="hint">Paste a Spotify link to get started.</p>
      </div>`;
    return;
  }

  container.innerHTML = links.map((link) => `
    <div class="sidebar-item" data-id="${link.spotifyId}" role="button" tabindex="0" 
         aria-label="Play ${escapeHtml(link.name)}">
      <img class="sidebar-art" 
           src="${link.coverArt || '/src/img/logo.png'}" 
           alt="${escapeHtml(link.name)}"
           onerror="this.src='/src/img/logo.png'">
      <div class="sidebar-item-info">
        <span class="sidebar-item-name">${escapeHtml(link.name)}</span>
        <span class="sidebar-item-meta">${link.trackCount || 0} tracks · ${link.type || ''}</span>
      </div>
      <button class="sidebar-remove-btn" data-id="${link.spotifyId}" 
              aria-label="Remove ${escapeHtml(link.name)}" title="Remove">×</button>
    </div>
  `).join('');

  container.querySelectorAll('.sidebar-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('sidebar-remove-btn')) return;
      const link = links.find((l) => l.spotifyId === item.dataset.id);
      if (link && onLinkClick) onLinkClick(link);
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') item.click();
    });
  });

  container.querySelectorAll('.sidebar-remove-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onLinkRemove) onLinkRemove(btn.dataset.id);
    });
  });
}

// ── Player Bar ────────────────────────────────────────────────────────────────

/**
 * Updates the player bar with current track info.
 * @param {object} track
 */
export function updatePlayerBar(track) {
  const art = document.getElementById('player-art');
  const name = document.getElementById('player-track-name');
  const artist = document.getElementById('player-track-artist');
  const fill = document.getElementById('progress-fill');
  const thumb = document.getElementById('progress-thumb');
  const timeCurrent = document.getElementById('time-current');
  const timeTotal = document.getElementById('time-total');
  const bar = document.getElementById('player-bar');

  if (art) { 
    art.src = track.albumArt || '/src/img/logo.png'; 
    art.alt = track.name; 
    art.onerror = () => { art.src = '/src/img/logo.png'; };
  }
  if (name) name.textContent = track.name;
  if (artist) artist.textContent = track.artist;
  if (fill) fill.style.width = '0%';
  if (thumb) thumb.style.left = '0%';
  if (timeCurrent) timeCurrent.textContent = '0:00';
  if (timeTotal) timeTotal.textContent = formatTime(track.duration);
  if (bar) bar.classList.remove('hidden');

  // Update or create the like button in the player bar
  const trackInfo = document.querySelector('.player-track-info');
  if (trackInfo) {
    let likeBtn = trackInfo.querySelector('.like-btn');
    if (!likeBtn) {
      likeBtn = document.createElement('button');
      likeBtn.className = 'like-btn player-like-btn';
      likeBtn.addEventListener('click', () => toggleLike(track));
      trackInfo.appendChild(likeBtn);
    } else {
      // Replace listener by cloning
      const newBtn = likeBtn.cloneNode(false);
      newBtn.addEventListener('click', () => toggleLike(track));
      likeBtn.replaceWith(newBtn);
      likeBtn = newBtn;
    }
    const liked = isLiked(track.id);
    likeBtn.dataset.trackId = track.id;
    likeBtn.textContent = liked ? '♥' : '♡';
    likeBtn.title = liked ? 'Remove from Liked Songs' : 'Add to Liked Songs';
    likeBtn.setAttribute('aria-label', liked ? 'Remove from Liked Songs' : 'Add to Liked Songs');
    if (liked) likeBtn.classList.add('liked'); else likeBtn.classList.remove('liked');
  }

  document.title = `${track.name} – ${track.artist} | Fluffy Music`;
}

// ── Current Track Highlighting ────────────────────────────────────────────────

/**
 * Highlights the currently playing track row and shows music bars.
 * @param {string} trackId
 */
export function highlightCurrentTrack(trackId) {
  document.querySelectorAll('.track-row').forEach((row) => {
    const isActive = row.dataset.id === String(trackId);
    row.classList.toggle('active', isActive);

    const bars = row.querySelector('.music-bars');
    const num = row.querySelector('.track-number');
    const playIcon = row.querySelector('.track-play-icon');

    if (bars) bars.classList.toggle('paused', !isActive);
    if (isActive) {
      if (num) num.style.display = 'none';
      if (playIcon) playIcon.style.display = 'none';
      if (bars) bars.style.display = 'flex';
    } else {
      if (num) num.style.display = '';
      if (bars) bars.style.display = 'none';
      if (playIcon) playIcon.style.display = '';
    }
  });
}

// ── Loading Progress ──────────────────────────────────────────────────────────

/**
 * Shows a track loading progress indicator.
 * @param {number} loaded
 * @param {number} total
 */
export function renderLoadingProgress(loaded, total) {
  let el = document.getElementById('track-load-progress');
  if (!el) {
    el = document.createElement('div');
    el.id = 'track-load-progress';
    el.className = 'load-progress';
    const content = document.getElementById('main-content');
    if (content) content.insertBefore(el, content.firstChild);
  }

  const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
  el.innerHTML = `
    <span>Loading tracks… ${loaded} / ${total}</span>
    <div class="load-progress-bar">
      <div class="load-progress-fill" style="width:${pct}%"></div>
    </div>`;

  if (loaded >= total) {
    setTimeout(() => el.remove(), 1000);
  }
}

// ── Home View ─────────────────────────────────────────────────────────────────

/**
 * Renders the home view into main-content.
 * @param {Array} recentLinks - Up to 4 recent saved links
 */
export function renderHomeView(recentLinks = []) {
  const container = document.getElementById('main-content');
  if (!container) return;

  const recentHtml = recentLinks.length > 0
    ? `<div class="home-section">
        <h2 class="section-title">Recently Saved</h2>
        <div class="recent-grid">
          ${recentLinks.slice(0, 4).map((link) => `
            <div class="recent-card" data-url="${link.url}" data-id="${link.spotifyId}" 
                 role="button" tabindex="0" aria-label="Play ${escapeHtml(link.name)}">
              <div class="recent-art-wrap">
                <img src="${link.coverArt || '/src/img/logo.png'}" alt="${escapeHtml(link.name)}" class="recent-art"
                     onerror="this.src='/src/img/logo.png'">
                <div class="recent-play-overlay">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                </div>
              </div>
              <p class="recent-name">${escapeHtml(link.name)}</p>
              <p class="recent-meta">${link.trackCount || 0} tracks</p>
            </div>
          `).join('')}
        </div>
      </div>`
    : '';

  container.innerHTML = `
    <div class="home-view">
      <div class="home-hero">
        <div class="home-glow"></div>
        <h1 class="home-heading">Your Music, <span class="gradient-text">Your Way.</span></h1>
        <p class="home-subheading">Paste any Spotify playlist, album, or song link to start listening.</p>
        <div class="home-input-wrap">
          <div class="home-input-box" id="home-input-box">
            <i data-lucide="link-2" class="home-input-icon"></i>
            <input type="url" id="home-url-input" 
                   placeholder="Paste a Spotify playlist, album or song link…"
                   autocomplete="off" spellcheck="false"
                   aria-label="Spotify link input">
            <button id="home-play-btn" class="btn btn-primary home-play-btn" aria-label="Play">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              Play
            </button>
          </div>
          <p class="home-hint">🔒 No account needed. Just paste and play.</p>
        </div>
      </div>
      ${recentHtml}
    </div>`;

  if (window.lucide) window.lucide.createIcons();
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Register on window for cross-module access
window.showToast = showToast;
window.showModal = showModal;
window.renderSavedLinks = (links) => renderSavedLinks(links, window._onLinkClick, window._onLinkRemove);
window.updatePlayerBar = updatePlayerBar;
window.highlightCurrentTrack = highlightCurrentTrack;
