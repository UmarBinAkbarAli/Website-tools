// sw.js - improved service worker
const CACHE_NAME = 'teleprompter-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/core.js',
  '/js/scripts.js',
  '/js/gestures.js',
  '/js/fullscreen.js',
  '/js/auth.js',
  '/js/cloud.js',
  '/js/analytics.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// install - cache core assets
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS.map(x => new Request(x, {cache: 'reload'}))))
      .catch(err => console.warn('SW cache failed', err))
  );
});

// activate - cleanup old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => (k !== CACHE_NAME) ? caches.delete(k) : null)
    )).then(()=> self.clients.claim())
  );
});

// fetch - cache-first, network fallback; also try update-from-network in background
self.addEventListener('fetch', event => {
  const req = event.request;
  // ignore non-GET
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req).then(networkRes => {
        // update cache in background for same-origin assets
        if (networkRes && networkRes.status === 200 && req.url.startsWith(self.location.origin)) {
          caches.open(CACHE_NAME).then(cache => cache.put(req, networkRes.clone()));
        }
        return networkRes.clone();
      }).catch(()=> null);

      // return cached if exists, else network
      return cached || networkFetch.then(res => res) || new Response('Offline', { status: 503, statusText: 'Offline' });
    })
  );
});
