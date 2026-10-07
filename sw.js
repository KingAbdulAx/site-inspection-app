/**
 * KMD DRAINAGE FIELD INSPECTOR — SERVICE WORKER (OFFLINE PWA)
 * Caches core shell, offline data bundles & viewer engines.
 * Bypasses cache for Supabase REST synchronization.
 */

const CACHE_NAME = 'kmd-drainage-cache-v11';

const PRECACHE_LOCAL_ASSETS = [
  './',
  './index.html',
  './ui/app.css',
  './ui/desk.css',
  './ui/model.js',
  './ui/icons.js',
  './ui/strip.js',
  './ui/app.js',
  './ui/screens.js',
  './ui/base.js',
  './lib/leaflet.js',
  './lib/leaflet.css',
  './fonts/barlow-500.woff2',
  './fonts/barlow-600.woff2',
  './fonts/barlow-700.woff2',
  './fonts/barlow-condensed-700.woff2',
  './fonts/ibm-plex-mono-500.woff2',
  './fonts/ibm-plex-mono-600.woff2',
  './culvert_ir_progress_table.json',
  './data/sections_DWKZ.json',
  './data/sections_KZDR.json',
  './data/sections_KNDW.json',
  './data/sections_DRMR.json',
  './legacy.html',
  './styles.css',
  './fonts.css',
  './tokens.css',
  './components.css',
  './manifest.json',
  './manifest.js',
  './type_catalogue.js',
  './type_icons.js',
  './data_model.js',
  './data_store.js',
  './data/kmd_alignment_stations_bundle.js',
  './position_engine.js',
  './edit_door.js',
  './walk_strip.js',
  './walk_drawer.js',
  './identify_view.js',
  './section_view.js',
  './walk_view.js',
  './map_view.js',
  './toast_manager.js',
  './record_view.js',
  './defect_view.js',
  './export_engine.js',
  './day_view.js',
  './feature_detail_view.js',
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
  './data/section01_bundle.js',
  './data/section04_bundle.js',
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

  // 2. Map Tiles (arcgisonline, openstreetmap): Cache-first, handle opaque responses (status 0)
  if (url.hostname.includes('arcgisonline.com') || url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then(networkResponse => {
          // Allow opaque responses (status 0) for CORS-less tile requests
          if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. Same-origin GETs: network-first so a new release shows on the next load,
  //    falling back to the cache when there is no signal.
  if (event.request.method === 'GET' && url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        }
        return networkResponse;
      }).catch(() => caches.match(event.request, { ignoreSearch: true }).then(cached => {
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('./index.html', { ignoreSearch: true });
        return undefined;
      }))
    );
    return;
  }

  // 4. Other GETs (vendor CDNs): cache-first
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then(cached => cached || fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        }
        return networkResponse;
      }))
    );
  }
});
