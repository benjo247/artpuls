/* ArtPulse Service Worker
 * Strategy:
 *   - App shell (HTML, CSS, JS, fonts, icons): cache-first, populated on install + on use
 *   - stories.json: network-first with cache fallback (so users get fresh news but works offline)
 *   - External images: cache as encountered, served from cache when possible
 */

var VERSION = 'ap-v8';
var SHELL_CACHE = 'kp-shell-' + VERSION;
var DATA_CACHE = 'kp-data-' + VERSION;
var IMG_CACHE = 'kp-img-' + VERSION;

var SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/ads.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== SHELL_CACHE && key !== DATA_CACHE && key !== IMG_CACHE) {
          return caches.delete(key);
        }
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Data files (/data/*.json) — network-first, fall back to cache
  if (url.pathname.indexOf('/data/') === 0 && url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(DATA_CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req);
      })
    );
    return;
  }

  // /s/:id permalinks — always network (server-rendered, fresh)
  if (url.pathname.indexOf('/s/') === 0) {
    event.respondWith(fetch(req).catch(function () {
      return caches.match('/index.html');
    }));
    return;
  }

  // Images — cache first
  if (req.destination === 'image' || /\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (res) {
          if (res && res.status === 200 && res.type !== 'opaque') {
            var copy = res.clone();
            caches.open(IMG_CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        });
      }).catch(function () { return new Response('', { status: 504 }); })
    );
    return;
  }

  // Same-origin shell — cache first, then network
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        return cached || fetch(req).then(function (res) {
          if (res && res.status === 200) {
            var copy = res.clone();
            caches.open(SHELL_CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        });
      })
    );
    return;
  }

  // Everything else — network with cache fallback
  event.respondWith(
    fetch(req).catch(function () { return caches.match(req); })
  );
});
