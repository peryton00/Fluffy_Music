// src/js/ui.js — All DOM rendering functions
// Functions are exported AND registered on window for cross-module access.

import { formatTime } from './player.js';
import { isLiked, toggleLike, updateAllHeartButtons } from './likes.js';

// Heart icon SVGs (Bootstrap Icons equivalent)
export const HEART_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-heart" viewBox="0 0 16 16"><path d="m8 2.748-.717-.737C5.6.281 2.514.878 1.4 3.053c-.523 1.023-.641 2.5.314 4.385.92 1.815 2.834 3.989 6.286 6.357 3.452-2.368 5.365-4.542 6.286-6.357.955-1.886.838-3.362.314-4.385C13.486.878 10.4.28 8.717 2.01zM8 15C-7.333 4.868 3.279-3.04 7.824 1.143q.09.083.176.171a3 3 0 0 1 .176-.17C12.72-3.042 23.333 4.867 8 15"/></svg>`;
export const HEART_FILL_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-heart-fill" viewBox="0 0 16 16"><path d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314"/></svg>`;

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
        <span class="track-name">${escapeHtml((track.album === 'YouTube Radio' ? cleanYouTubeTitle(track.name) : track.name) || track.title || 'Unknown Track')}</span>
        <span class="track-artist">${escapeHtml(track.artists || track.artist || track.channelName || 'Unknown Artist')}</span>
      </div>
      <span class="track-album hide-mobile">${escapeHtml(track.album)}</span>
      <span class="track-duration">${formatTime(track.duration)}</span>
      <button class="like-btn${isLiked(track.id) ? ' liked' : ''}" 
              data-track-id="${track.id}"
              aria-label="${isLiked(track.id) ? 'Remove from Liked Songs' : 'Add to Liked Songs'}"
              title="${isLiked(track.id) ? 'Remove from Liked Songs' : 'Add to Liked Songs'}"
              >${isLiked(track.id) ? HEART_FILL_ICON : HEART_ICON}</button>
    </div>
  `).join('');

  container.innerHTML = `<div class="track-list" role="table">${rows}</div>`;

  // Attach click events
  container.querySelectorAll('.track-row').forEach((row) => {
    const clickHandler = (e) => {
      // Don't trigger track play when clicking the like button
      if (e.target.closest('.like-btn')) return;
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
 * @param {Function} onRefresh
 */
export function renderPlaylistHero(data, onPlayAll, onSave, isSaved, onRefresh) {
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
             onerror="this.src='/src/img/logo.png'"
             loading="lazy">
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
          <button id="hero-refresh" class="btn btn-outlined btn-icon" title="Refresh playlist">
            <i data-lucide="refresh-cw"></i>
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

  document.getElementById('hero-refresh')?.addEventListener('click', () => {
    if (onRefresh) onRefresh();
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
           onerror="this.src='/src/img/logo.png'"
           loading="lazy">
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

/**
 * Renders the saved library links into main-content (used for mobile Library tab).
 * @param {Array} links
 * @param {Function} onLinkClick
 * @param {Function} onLinkRemove
 * @param {Function} onLikedClick
 */
export function renderMobileLibraryView(links, onLinkClick, onLinkRemove, onLikedClick) {
  const container = document.getElementById('main-content');
  if (!container) return;

  const likedSongs = JSON.parse(localStorage.getItem('fm_liked_songs') || '[]');
  const likedCount = likedSongs.length;

  if ((!links || links.length === 0) && likedCount === 0) {
    container.innerHTML = `
      <div class="empty-state-full" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:40px 20px;">
        <svg fill="none" stroke="var(--text-muted)" stroke-width="1.5" width="48" height="48" viewBox="0 0 24 24" style="margin-bottom:16px;">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
        <h2 style="font-size:20px;margin-bottom:8px;">Your Library is Empty</h2>
        <p style="color:var(--text-muted);">Paste a Spotify link on the Home tab and like some songs to add to your library.</p>
      </div>`;
    return;
  }

  const likedCountStr = `${likedCount} tracks`;
  const likedIconHtml = HEART_FILL_ICON.replace('width="16" height="16"', 'width="24" height="24"').replace('currentColor', 'white');

  const likedHtml = `
    <div class="track-row liked-songs-mobile-row" role="button" tabindex="0" style="grid-template-columns: 48px 1fr auto; padding: 12px; gap: 16px; align-items: center; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s;">
      <div style="width: 48px; height: 48px; border-radius: 4px; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; color: white;">${likedIconHtml}</div>
      <div style="display:flex; flex-direction:column; gap:4px; overflow:hidden;">
        <span style="font-size: 15px; font-weight: 500; font-family: inherit; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Liked Songs</span>
        <span style="font-size: 13px; color: var(--text-muted);">${likedCountStr}</span>
      </div>
      <div style="width: 34px"></div>
    </div>
  `;

  const listHtml = (links || []).map((link) => `
    <div class="track-row link-row" data-id="${link.spotifyId}" role="button" tabindex="0" style="grid-template-columns: 48px 1fr auto; padding: 12px; gap: 16px; align-items: center; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s;">
      <img src="${link.coverArt || '/src/img/logo.png'}" alt="${escapeHtml(link.name)}" onerror="this.src='/src/img/logo.png'" loading="lazy" style="width: 48px; height: 48px; border-radius: 4px; object-fit: cover;">
      <div style="display:flex; flex-direction:column; gap:4px; overflow:hidden;">
        <span style="font-size: 15px; font-weight: 500; font-family: inherit; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(link.name)}</span>
        <span style="font-size: 13px; color: var(--text-muted);">${link.trackCount || 0} tracks · ${link.type || 'Playlist'}</span>
      </div>
      <button class="mobile-lib-remove-btn" data-id="${link.spotifyId}" aria-label="Remove" style="background:none; border:none; color: var(--text-muted); padding: 8px; font-size: 18px; cursor: pointer;">×</button>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="mobile-library-view" style="padding-bottom: 120px;">
      <div class="home-section" style="padding: 24px 16px;">
        <h2 class="section-title" style="font-size: 28px; font-weight: 700; margin-bottom: 24px;">Your Library</h2>
        <div class="mobile-links-list" style="display: flex; flex-direction: column;">
          ${likedHtml}
          ${listHtml}
        </div>
      </div>
    </div>`;

  const likedRow = container.querySelector('.liked-songs-mobile-row');
  if (likedRow) {
    likedRow.addEventListener('click', () => {
      if (onLikedClick) onLikedClick();
    });
  }

  container.querySelectorAll('.link-row').forEach((item) => {
    item.addEventListener('click', (e) => {
      // Don't trigger if click was on remove button
      if (e.target.closest('.mobile-lib-remove-btn')) return;
      const link = links.find((l) => l.spotifyId === item.dataset.id);
      if (link && onLinkClick) onLinkClick(link);
    });
  });

  container.querySelectorAll('.mobile-lib-remove-btn').forEach((btn) => {
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
  if (name) name.setAttribute('data-original', track.name);
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
    likeBtn.innerHTML = liked ? HEART_FILL_ICON : HEART_ICON;
    likeBtn.title = liked ? 'Remove from Liked Songs' : 'Add to Liked Songs';
    likeBtn.setAttribute('aria-label', liked ? 'Remove from Liked Songs' : 'Add to Liked Songs');
    if (liked) likeBtn.classList.add('liked'); else likeBtn.classList.remove('liked');
  }

  // Share button
  const playerRight = document.querySelector('.player-right');
  if (playerRight) {
    let shareBtn = playerRight.querySelector('.share-btn');
    if (!shareBtn) {
      shareBtn = document.createElement('button');
      shareBtn.className = 'ctrl-btn share-btn';
      shareBtn.setAttribute('aria-label', 'Share');
      shareBtn.title = 'Share this song';
      shareBtn.innerHTML = `<i data-lucide="share-2" style="width:15px;height:15px;"></i>`;
      const volumeWrap = playerRight.querySelector('.volume-wrap') || playerRight.firstChild;
      playerRight.insertBefore(shareBtn, volumeWrap);
      if (window.lucide) window.lucide.createIcons();
    }
    shareBtn.onclick = async () => {
      const isYTRadio = track.album === 'YouTube Radio';
      const cleanName = isYTRadio ? cleanYouTubeTitle(track.name) : track.name;
      const shareQuery = isYTRadio ? cleanName : `${track.name} ${track.artist}`;

      const shareData = {
        title: 'Fluffy Music',
        text: `\uD83C\uDFB5 ${cleanName} by ${track.artist}`,
        url: `https://fluffy-music.vercel.app/app.html?q=${encodeURIComponent(shareQuery)}`
      };
      try {
        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          await navigator.clipboard.writeText(`${shareData.text}\nListen on Fluffy Music: ${shareData.url}`);
          if (window.showToast) window.showToast('Link copied to clipboard! \uD83D\uDCCB', 'success');
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          try {
            await navigator.clipboard.writeText(shareData.text);
            if (window.showToast) window.showToast('Song info copied! \uD83D\uDCCB', 'success');
          } catch {}
        }
      }
    };
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

// ── Lyrics Panel ───────────────────────────────────────────────────

/**
 * Renders the lyrics panel in various states.
 * @param {'loading'|'instrumental'|'not_found'|'plain'|'synced'} state
 * @param {string|Array|null} lyricsData
 * @param {string} trackName
 */
export function renderLyricsPanel(state, lyricsData, trackName) {
  const panel = document.getElementById('lyrics-panel');
  if (!panel) return;

  if (state === 'loading') {
    panel.innerHTML = `
      <div class="lyrics-loading">
        <div class="lyrics-spinner"></div>
        <p>Finding lyrics...</p>
      </div>`;
    return;
  }

  if (state === 'instrumental') {
    panel.innerHTML = `
      <div class="lyrics-empty">
        <div class="lyrics-empty-icon">🎵</div>
        <p class="lyrics-empty-title">Instrumental Track</p>
        <p class="lyrics-empty-sub">This track has no lyrics.</p>
      </div>`;
    return;
  }

  if (state === 'not_found') {
    panel.innerHTML = `
      <div class="lyrics-empty">
        <div class="lyrics-empty-icon">🎤</div>
        <p class="lyrics-empty-title">No Lyrics Found</p>
        <p class="lyrics-empty-sub">We couldn't find lyrics for "${escapeHtml(trackName || 'this song')}".</p>
      </div>`;
    return;
  }

  if (state === 'plain') {
    const lines = (lyricsData || '').split('\n').map(l => l.trim());
    const html = lines.map(line =>
      line.length > 0 ? `<p class="lyric-line">${escapeHtml(line)}</p>` : `<p class="lyric-spacer"></p>`
    ).join('');
    panel.innerHTML = `<div class="lyrics-plain">${html}</div>`;
    return;
  }

  if (state === 'synced') {
    const lines = lyricsData || [];
    const html = lines.map((line, i) =>
      `<p class="lyric-line lyric-synced-line" data-index="${i}" data-time="${line.timeMs}">${escapeHtml(line.text)}</p>`
    ).join('');
    panel.innerHTML = `<div class="lyrics-synced">${html}</div>`;
    return;
  }
}

/**
 * Highlights the active synced lyric line and scrolls it into view.
 * @param {number} index
 */
export function highlightSyncedLine(index) {
  const panel = document.getElementById('lyrics-panel');
  if (!panel) return;

  panel.querySelectorAll('.lyric-synced-line').forEach((el, i) => {
    const diff = Math.abs(i - index);
    el.classList.toggle('lyric-active', i === index);
    el.classList.toggle('lyric-near', diff === 1);
    if (i === index) {
      el.style.opacity = '1';
      el.style.fontSize = '26px';
    } else if (diff === 1) {
      el.style.opacity = '0.5';
      el.style.fontSize = '22px';
    } else if (diff === 2) {
      el.style.opacity = '0.35';
      el.style.fontSize = '20px';
    } else {
      el.style.opacity = '0.2';
      el.style.fontSize = '18px';
    }
  });

  const active = panel.querySelector('.lyric-active');
  if (active) active.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

window.renderLyricsPanel = renderLyricsPanel;
window.highlightSyncedLine = highlightSyncedLine;

// ── Home View ─────────────────────────────────────────────────────────────────

/**
 * Renders the home view into main-content.
 * @param {Array} recentLinks - Up to 4 recent saved links
 */
export function renderHomeView(recentLinks = []) {
  const container = document.getElementById('main-content');
  if (!container) return;

  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 17 ? 'Good afternoon' : hour >= 17 && hour < 21 ? 'Good evening' : 'Good night';
  const userName = localStorage.getItem('fm_user_name');
  const greetingText = userName ? `${greeting}, ${userName.split(' ')[0]}!` : `${greeting}!`;

  let likedCount = 0;
  try { likedCount = JSON.parse(localStorage.getItem('fm_liked_songs') || '[]').length; } catch {}
  const isNewUser = !localStorage.getItem('fm_user_uid') && likedCount === 0 && !localStorage.getItem('fm_onboarding_dismissed');

  const onboardingHtml = isNewUser ? `
    <div class="onboarding-banner" id="onboarding-banner">
      <button class="onboarding-close" id="onboarding-close" aria-label="Dismiss">&#x00D7;</button>
      <h2 class="onboarding-title">&#x1F44B; Welcome to Fluffy Music</h2>
      <p class="onboarding-desc">Stream any public Spotify playlist, album or song — completely free. Here's how to get started:</p>
      <div class="onboarding-steps">
        <div class="onboarding-step"><span class="step-num">1</span><span>Open Spotify and find any playlist or album</span></div>
        <div class="onboarding-step"><span class="step-num">2</span><span>Tap Share → Copy Link</span></div>
        <div class="onboarding-step"><span class="step-num">3</span><span>Paste the link above and hit Play</span></div>
      </div>
      <div class="onboarding-try">
        <span>Try this example playlist:</span>
        <button class="onboarding-try-btn" id="onboarding-try-btn">&#x1F3B5; Top 50 Global</button>
      </div>
    </div>` : '';

  const recentHtml = recentLinks.length > 0
    ? `<div class="home-section">
        <h2 class="section-title">Recently Saved</h2>
        <div class="recent-grid">
          ${recentLinks.slice(0, 4).map((link) => `
            <div class="recent-card" data-url="${link.url}" data-id="${link.spotifyId}" role="button" tabindex="0" aria-label="Play ${escapeHtml(link.name)}">
              <div class="recent-art-wrap">
                <img src="${link.coverArt || '/src/img/logo.png'}" alt="${escapeHtml(link.name)}" class="recent-art" onerror="this.src='/src/img/logo.png'" loading="lazy">
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

  const skeletonCard = `<div class="recs-skeleton-card"><div class="skeleton recs-skeleton-art"></div><div class="skeleton recs-skeleton-name"></div></div>`;
  const skeletonCards = skeletonCard.repeat(5);

  container.innerHTML = `
    <div class="home-view">
      ${onboardingHtml}
      <div class="home-hero">
        <div class="home-glow"></div>
        <h1 class="home-heading">${escapeHtml(greetingText)}</h1>
        <p class="home-subheading">Paste any Spotify playlist, album, or song link to start listening.</p>
        <div class="home-input-wrap">
          <div class="home-input-box" id="home-input-box">
            <i data-lucide="link-2" class="home-input-icon"></i>
            <input type="url" id="home-url-input" placeholder="Paste a Spotify playlist, album or song link…" autocomplete="off" spellcheck="false" aria-label="Spotify link input">
            <button id="home-play-btn" class="btn btn-primary home-play-btn" aria-label="Play">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              Play
            </button>
          </div>
          <p class="home-hint">🔒 No account needed. Just paste and play.</p>
        </div>
      </div>
      ${recentHtml}
      <div id="home-recommendations">
        <div id="recs-container"></div>
        <div class="recs-header-row">
          <button id="btn-refresh-recs" aria-label="Refresh recommendations">
            <i data-lucide="refresh-cw" style="width:12px;height:12px;"></i>
            Refresh
          </button>
        </div>
        <div class="home-recs-loading">
          <div class="recs-skeleton-section">
            <div class="skeleton recs-skeleton-title"></div>
            <div class="recs-skeleton-row">${skeletonCards}</div>
          </div>
          <div class="recs-skeleton-section">
            <div class="skeleton recs-skeleton-title"></div>
            <div class="recs-skeleton-row">${skeletonCards}</div>
          </div>
        </div>
      </div>
    </div>`;

  if (window.lucide) window.lucide.createIcons();

  document.getElementById('onboarding-close')?.addEventListener('click', () => {
    document.getElementById('onboarding-banner')?.remove();
    localStorage.setItem('fm_onboarding_dismissed', '1');
  });
  document.getElementById('onboarding-try-btn')?.addEventListener('click', () => {
    const sampleUrl = 'https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF';
    const input = document.getElementById('home-url-input');
    if (input) input.value = sampleUrl;
    if (window._handleSpotifyLink) window._handleSpotifyLink(sampleUrl);
  });
}

// ── Recommendation Sections ───────────────────────────────────────────────────

export function renderRecommendationSections(sections, onPlaylistClick, append = false) {
  const container = document.getElementById('recs-container') || document.getElementById('home-recommendations');
  if (!container) return;

  const parent = document.getElementById('home-recommendations');
  const loading = parent?.querySelector('.home-recs-loading');
  if (loading) loading.remove();

  if (!sections || sections.length === 0) {
    if (!append) container.innerHTML = '';
    return;
  }

  const html = sections.map(section => renderSection(section)).join('');
  if (append) container.insertAdjacentHTML('beforeend', html); else container.innerHTML = html;

  container.querySelectorAll('.rec-card').forEach(card => {
    if (card.dataset.bound) return;
    card.dataset.bound = 'true';
    card.addEventListener('click', () => {
      if (onPlaylistClick) onPlaylistClick(card.dataset.url, card.dataset.id);
    });
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); } });
  });

  if (window.lucide) window.lucide.createIcons();
}

function renderSection(section) {
  if (!section || !section.items || !section.items.length) return '';
  const cards = section.items.map(item => {
    const meta = item.trackCount ? item.trackCount + ' tracks' : item.description ? escapeHtml(item.description.slice(0, 40)) : '';
    return `<div class="rec-card" data-url="${item.url || ''}" data-id="${item.spotifyId || ''}" role="button" tabindex="0" aria-label="Play ${escapeHtml(item.name || '')}">
      <div class="rec-art-wrap">
        <img class="rec-art" src="${item.coverArt || '/src/img/logo.png'}" alt="${escapeHtml(item.name || '')}" loading="lazy" onerror="this.src='/src/img/logo.png'">
        <div class="rec-play-overlay">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
      <p class="rec-name">${escapeHtml(item.label || item.name || '')}</p>
      <p class="rec-meta">${meta}</p>
    </div>`;
  }).join('');

  return `<div class="home-section rec-section" id="rec-section-${section.id}">
    <div class="rec-section-header">
      <h2 class="section-title">${escapeHtml(section.title || '')}</h2>
      <button class="rec-see-all hidden" data-section="${section.id}">See all</button>
    </div>
    <div class="rec-scroll-row" id="rec-row-${section.id}">${cards}</div>
  </div>`;
}

window.renderRecommendationSections = renderRecommendationSections;

// ── Utilities ─────────────────────────────────────────────────────────────────

function cleanYouTubeTitle(title) {
  if (!title) return '';
  return title.replace(/\(official\s*(music\s*)?video\)/gi, '').replace(/\(official\s*audio\)/gi, '').replace(/\(official\s*lyric\s*video\)/gi, '').replace(/\(lyrics\)/gi, '').replace(/\(lyric\s*video\)/gi, '').replace(/\[official\s*(music\s*)?video\]/gi, '').replace(/\[official\s*audio\]/gi, '').replace(/\[lyrics\]/gi, '').replace(/\(hd\)/gi, '').replace(/\(4k\)/gi, '').replace(/\(\d{4}\)/gi, '').replace(/\(audio\)/gi, '').replace(/\bvevo\b/gi, '').replace(/\s{2,}/g, ' ').trim();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeHtmlAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

window.showToast = showToast;
window.showModal = showModal;
window.renderSavedLinks = (links) => renderSavedLinks(links, window._onLinkClick, window._onLinkRemove);
window.updatePlayerBar = updatePlayerBar;
window.highlightCurrentTrack = highlightCurrentTrack;

export function setPlayerLoadingState(loading) {
  const name = document.getElementById('player-track-name');
  const playBtn = document.getElementById('btn-play');
  if (!name) return;
  if (loading) {
    name.innerHTML = `<span class="player-loading-text"><span class="player-loading-dot"></span><span class="player-loading-dot"></span><span class="player-loading-dot"></span>Loading...</span>`;
    if (playBtn) playBtn.disabled = true;
  } else {
    const original = name.getAttribute('data-original');
    if (original) name.textContent = original;
    if (playBtn) playBtn.disabled = false;
  }
}

window.setPlayerLoadingState = setPlayerLoadingState;

// ── Recently Played ──────────────────────────────────────────────────────

export function renderRecentlyPlayed(tracks, onTrackClick) {
  const container = document.getElementById('main-content');
  if (!container) return;

  if (!tracks || tracks.length === 0) {
    container.innerHTML = `<div class="empty-state-full"><div class="empty-icon">🕐</div><h2>No Recently Played</h2><p>Songs you play will appear here.</p></div>`;
    return;
  }

  const rows = tracks.map((track, i) => `
    <div class="track-row" data-index="${i}" data-id="${track.id}" role="row" tabindex="0" aria-label="${escapeHtmlAttr(track.name)} by ${escapeHtmlAttr(track.artist)}">
      <div class="track-num-cell">
        <span class="track-number">${i + 1}</span>
        <span class="track-play-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </span>
        <div class="music-bars paused" aria-hidden="true"><span></span><span></span><span></span></div>
      </div>
      <img class="track-art" src="${track.albumArt || '/src/img/logo.png'}" alt="${escapeHtmlAttr(track.album || '')}" onerror="this.src='/src/img/logo.png'" loading="lazy">
      <div class="track-info">
        <span class="track-name">${escapeHtml(track.name || 'Unknown')}</span>
        <span class="track-artist">${escapeHtml(track.artist || 'Unknown')}</span>
      </div>
      <span class="track-album hide-mobile">${escapeHtml(track.album || '')}</span>
      <span class="track-duration recent-time" title="Played at">${timeAgo(track.playedAt)}</span>
      <button class="like-btn${isLiked(track.id) ? ' liked' : ''}" data-track-id="${track.id}" aria-label="${isLiked(track.id) ? 'Remove from Liked Songs' : 'Add to Liked Songs'}">
        ${isLiked(track.id) ? HEART_FILL_ICON : HEART_ICON}
      </button>
    </div>
  `).join('');

  container.innerHTML = `
    <div id="playlist-view">
      <div id="hero-section">
        <div class="hero-inner">
          <div class="hero-art-wrap">
            <div class="liked-songs-hero-art" style="background:linear-gradient(135deg,#1DB954,#0a8a3a);">🕐</div>
          </div>
          <div class="hero-details">
            <span class="hero-type">HISTORY</span>
            <h1 class="hero-title">Recently Played</h1>
            <div class="hero-meta"><span>${tracks.length} tracks</span></div>
            <div class="hero-actions">
              <button id="recent-play-all" class="btn btn-primary btn-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                Play All
              </button>
              <button id="recent-clear" class="btn btn-outlined btn-icon">
                <i data-lucide="trash-2"></i>
                Clear History
              </button>
            </div>
          </div>
        </div>
      </div>
      <div id="track-list-container">
        <div class="track-list" role="table">${rows}</div>
      </div>
    </div>`;

  if (window.lucide) window.lucide.createIcons();

  container.querySelectorAll('.track-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.like-btn')) return;
      const idx = parseInt(row.dataset.index, 10);
      if (onTrackClick) onTrackClick(tracks[idx], tracks, idx);
    });
  });

  container.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.trackId;
      const idx = tracks.findIndex(t => String(t.id) === String(id));
      if (idx !== -1) toggleLike(tracks[idx]);
    });
  });

  document.getElementById('recent-play-all')?.addEventListener('click', () => { if (tracks[0] && onTrackClick) onTrackClick(tracks[0], tracks, 0); });
  document.getElementById('recent-clear')?.addEventListener('click', () => {
    if (window.showModal) {
      window.showModal('Clear History', 'Remove all recently played tracks?', () => {
        localStorage.removeItem('fm_recent_tracks');
        renderRecentlyPlayed([], onTrackClick);
        if (window.showToast) window.showToast('History cleared', 'info');
      });
    }
  });
}

function timeAgo(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

window.renderRecentlyPlayed = (tracks, cb) => renderRecentlyPlayed(tracks, cb);

// ── Queue Panel ──────────────────────────────────────────────────────────

export function renderQueuePanel(queue, currentIndex, onTrackClick, listId = 'mobile-queue-list') {
  const panel = document.getElementById('queue-panel');
  const list = document.getElementById(listId) || document.getElementById('queue-list');
  if (!panel || !list) return;

  if (!queue || queue.length === 0) {
    list.innerHTML = `<div class="queue-empty"><p>No tracks in queue.</p><p class="hint">Load a playlist to start a queue.</p></div>`;
    return;
  }

  const upcoming = queue.slice(currentIndex);
  const previous = queue.slice(0, currentIndex);
  let html = '';

  if (upcoming.length > 0) {
    html += `<p class="queue-section-label">Now &amp; Up Next</p>`;
    html += upcoming.map((track, i) => {
      const realIdx = currentIndex + i;
      const isCurrent = i === 0;
      return `<div class="queue-item${isCurrent ? ' queue-current' : ''}" data-index="${realIdx}" role="button" tabindex="0">
          <img class="queue-art" src="${track.albumArt || '/src/img/logo.png'}" alt="" onerror="this.src='/src/img/logo.png'" loading="lazy">
          <div class="queue-info">
            <span class="queue-track-name">${escapeHtml(track.name || 'Unknown')}</span>
            <span class="queue-track-artist">${escapeHtml(track.artist || 'Unknown')}</span>
          </div>
          ${isCurrent ? `<span class="queue-playing-badge">Playing</span>` : `<span class="queue-duration">${formatTime(track.duration)}</span>`}
        </div>`;
    }).join('');
  }

  if (previous.length > 0) {
    html += `<p class="queue-section-label queue-history-label">Previously Played</p>`;
    html += [...previous].reverse().map((track, i) => {
      const realIdx = currentIndex - i - 1;
      return `<div class="queue-item queue-prev" data-index="${realIdx}" role="button" tabindex="0">
          <img class="queue-art" src="${track.albumArt || '/src/img/logo.png'}" alt="" onerror="this.src='/src/img/logo.png'" loading="lazy">
          <div class="queue-info">
            <span class="queue-track-name">${escapeHtml(track.name || 'Unknown')}</span>
            <span class="queue-track-artist">${escapeHtml(track.artist || 'Unknown')}</span>
          </div>
          <span class="queue-duration">${formatTime(track.duration)}</span>
        </div>`;
    }).join('');
  }

  list.innerHTML = html;
  const currentItem = list.querySelector('.queue-current');
  if (currentItem) setTimeout(() => currentItem.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);

  list.querySelectorAll('.queue-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.index, 10);
      if (onTrackClick && queue[idx]) onTrackClick(queue[idx], queue, idx);
      panel.classList.add('hidden');
    });
    item.addEventListener('keydown', e => { if (e.key === 'Enter') item.click(); });
  });
}

window.renderQueuePanel = renderQueuePanel;
window.renderMobileLibraryView = renderMobileLibraryView;
