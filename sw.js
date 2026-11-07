// Service worker: makes the app work offline. Every file is cached on install (a test checks that the list
// is complete); requests are answered from the cache at once and refreshed from the network in the background
// (stale-while-revalidate), so an update reaches the phone on the next start.
// Bump CACHE when a file is removed or renamed, so the old cache is cleared.

const CACHE = 'hjem-inventar-v3';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './demo/eksempel-plan.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg',
  './js/data/db.js',
  './js/data/export.js',
  './js/data/files.js',
  './js/main.js',
  './js/model/decisions.js',
  './js/model/demo.js',
  './js/model/inventory.js',
  './js/model/plan.js',
  './js/model/quickstart.js',
  './js/model/stats.js',
  './js/parse/parse-da.js',
  './js/parse/rooms-da.js',
  './js/ui/actions.js',
  './js/ui/board.js',
  './js/ui/capture.js',
  './js/ui/dialog.js',
  './js/ui/dom.js',
  './js/ui/itemdialog.js',
  './js/ui/lists.js',
  './js/ui/planedit.js',
  './js/ui/planview.js',
  './js/ui/quickstart.js',
  './js/ui/room.js',
  './js/ui/settings.js',
  './js/ui/speech.js',
  './js/ui/triage.js',
  './js/ui/walk.js',
  './js/ui/widgets.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // All pages are the same single page; the route lives in the #hash.
  const key = req.mode === 'navigate' ? './index.html' : req;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(key, { ignoreSearch: true });
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(key, res.clone());
          return res;
        })
        .catch(() => cached ?? Response.error());
      if (cached) {
        event.waitUntil(fresh.catch(() => {}));
        return cached;
      }
      return fresh;
    }),
  );
});
