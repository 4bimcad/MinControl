const CACHE_NAME = 'mincontrol-v5';

const URLS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',

    // JS
    './js/db.js',
    './js/export.js',
    './js/license.js',
    './js/app.js',

    // Tailwind
    './vendor/tailwind/tailwind.js',
    './vendor/tailwind/tailwind.css',

    // Bootstrap Icons
    './vendor/bootstrap-icons/bootstrap-icons.css',
    './vendor/bootstrap-icons/fonts/bootstrap-icons.woff',
    './vendor/bootstrap-icons/fonts/bootstrap-icons.woff2',

    // Inter
    './vendor/inter/inter.css',
    './vendor/inter/inter-latin-400-normal.woff2',
    './vendor/inter/inter-latin-500-normal.woff2',
    './vendor/inter/inter-latin-700-normal.woff2',

    // Libraries
    './vendor/dexie/dexie.js',
    './vendor/jspdf/jspdf.umd.min.js',
    './vendor/xlsx/xlsx.full.min.js',
    './vendor/jszip/jszip.min.js',
    './vendor/alpinejs/cdn.min.js',

    // Images
    './img/logo.png',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.all(
                URLS_TO_CACHE.map(url =>
                    cache.add(url).catch(error => {
                        console.warn('No se pudo cachear:', url, error);
                    })
                )
            );
        })
    );

    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );

    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.url.startsWith(self.location.origin)) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) {
                    return cached;
                }

                return fetch(event.request).catch(() => {
                    // Evita "Uncaught (in promise) TypeError: Failed to fetch"
                    return new Response('', {
                        status: 503,
                        statusText: 'Offline'
                    });
                });
            })
        );
    }
});