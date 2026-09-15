/**
 * KMD DRAINAGE FIELD INSPECTOR — SERVICE WORKER (OFFLINE PWA)
 * Caches core shell, offline data bundles & viewer engines.
 * Bypasses cache for Supabase REST synchronization.
 */

const CACHE_NAME = 'kmd-drainage-cache-v1';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './manifest.js',
  './config.js',
  './sync.js',
  './edit_manager.js',
  './sld_viewer.js',
  './cad_viewer.js',
  './scrubber.js',
  './dashboard.js',
  './reports.js',
  './data_exchange.js',
  './app.js',
  './data/bundle.js',
  './data/section02_bundle.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Supabase REST API calls: ALWAYS bypass cache (network-only)
  if (url.hostname.includes('supabase.co') || url.pathname.includes('/rest/v1/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Local assets: Cache first with network fallback
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          // Fetch fresh copy in background to keep cache up to date
          fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
            }
          }).catch(() => {});
          return cachedResponse;
        }
        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          }
          return networkResponse;
        }).catch(() => {
          // Offline fallback
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
    );
  }
});
