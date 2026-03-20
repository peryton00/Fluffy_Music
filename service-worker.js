// service-worker.js — Fluffy Music PWA Service Worker
const CACHE_NAME = 'fluffy-music-v6';
const APP_SHELL = [
  '/',
  '/index.html',
  '/app.html',
  '/src/css/style.css',
  '/src/js/visibility-fixer.js',
  '/src/js/app.js',
  '/src/js/player.js',
  '/src/js/youtube.js',
  '/src/js/storage.js',
  '/src/js/auth.js',
  '/src/js/sync.js',
  '/src/js/spotify.js',
  '/src/js/ui.js',
  '/src/js/media-session.js',
  '/src/img/icon.png',
  '/src/img/icon-192.png',
  '/src/img/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests (like Spotify and YouTube APIs) 
  // and local API calls which should never be cached as shell.
  if (!event.request.url.startsWith(self.location.origin) || event.request.url.includes('/api/')) {
    return;
  }

  // Cache-busting: Bypass cache if a version query parameter is present
  if (event.request.url.includes('?v=')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
