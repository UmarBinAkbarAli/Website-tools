// sw.js – auto-updating service worker (no stale cache issues)

const VERSION = self.crypto.randomUUID(); // unique version on each build
const CACHE_NAME = `teleprompter-${VERSION}`;

// Core files to cache
const CORE_ASSETS = [
  '/index.html',
  '/manifest.json',
  '/css/style.css'
];

// On install – cache essential assets
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
});

// On activate – delete all old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null))
    ).then(() => self.clients.claim())
  );
});

// Network-first for JS/CSS/HTML
self.addEventListener('fetch', event => {
  const req = event.request;

  // Only GET requests
  if (req.method !== 'GET') return;

  event.respondWith(
    fetch(req)
      .then(res => {
        // Update cache
        if (res.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone()));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(cached => cached || new Response('Offline', { status: 503 }))
      )
  );
});
