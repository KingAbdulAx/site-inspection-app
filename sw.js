/**
 * KMD DRAINAGE FIELD INSPECTOR — SERVICE WORKER (OFFLINE PWA)
 * Caches core shell, offline data bundles & viewer engines.
 * Bypasses cache for Supabase REST synchronization.
 */

const CACHE_NAME = 'kmd-drainage-cache-v2';

const PRECACHE_LOCAL_ASSETS = [
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
  './lib/leaflet-rotate.js',
  './data/bundle.js',
  './data/section02_bundle.js'
];

const EXTERNAL_VENDOR_ASSETS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(PRECACHE_LOCAL_ASSETS);
      try {
        await cache.addAll(EXTERNAL_VENDOR_ASSETS);
      } catch (err) {
        console.warn('Vendor asset precache deferred to runtime:', err);
      }
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

  // 2. GET requests: Cache-first with ignoreSearch: true (handles cache buster query strings)
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
        if (cachedResponse) {
          // Revalidate in background when online
          fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const resClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
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
          // Offline navigation fallback
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html', { ignoreSearch: true });
          }
        });
      })
    );
  }
});
