/* service-worker.js — Fluffy Music PWA Service Worker */

const CACHE_NAME = 'fluffy-music-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/app.html',
  '/src/css/style.css',
  '/src/js/app.js',
  '/src/js/player.js',
  '/src/js/youtube.js',
  '/src/js/yt-cache.js',
  '/src/js/spotify.js',
  '/src/js/sync.js',
  '/src/js/auth.js',
  '/src/js/firebase.js',
  '/src/js/storage.js',
  '/src/js/ui.js',
  '/src/js/likes.js',
  '/src/js/data-mode.js',
  '/src/img/icon-192.png',
  '/src/img/icon-512.png',
  '/offline.html'
];

// ── Install: cache the app shell ─────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Cache individually so one failure doesn't break everything
        return Promise.allSettled(
          APP_SHELL.map((url) =>
            cache.add(url).catch((err) => {
              console.warn(`SW: Failed to cache ${url}:`, err.message);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: smart caching strategy ─────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache API calls — always go to network
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Never cache cross-origin requests (YouTube, Firebase, Spotify, Fonts)
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  // Navigation requests: network first, fall back to offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache a fresh copy
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match('/offline.html').then((cached) => cached ||
            new Response('<h1>Offline</h1>', {
              headers: { 'Content-Type': 'text/html' }
            })
          )
        )
    );
    return;
  }

  // Everything else (CSS, JS, images): cache first, then network fallback
  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) {
          // Update the cache in the background (stale-while-revalidate)
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) =>
                  cache.put(request, networkResponse)
                );
              }
            })
            .catch(() => {}); // Silently ignore background update failures
          return cached;
        }

        // Not in cache — fetch from network and cache it
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
  );
});
