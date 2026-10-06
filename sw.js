const CACHE_NAME = 'mincontrol-v4';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './js/db.js',
  './js/export.js',
  './js/license.js',
  './js/app.js',
  './manifest.json',
  './vendor/bootstrap-icons/bootstrap-icons.css',
  './vendor/inter/inter.css',
  './vendor/tailwind/tailwind.js',
  './vendor/dexie/dexie.js',
  './vendor/jspdf/jspdf.umd.min.js',
  './vendor/xlsx/xlsx.full.min.js',
  './vendor/jszip/jszip.min.js',
  './vendor/alpinejs/cdn.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(URLS_TO_CACHE.map((url) => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // No cachear los CDN externos por complejidad; solo el shell local.
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});
