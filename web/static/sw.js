const CACHE_NAME = 'kicknosub-v3';
const ASSETS = [
    '/',
    '/static/style.css',
    '/static/lang.js',
    '/static/main.js',
    '/static/manifest.json',
    '/static/logo.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    // Only cache static assets and GET requests
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
        return;
    }
    
    // API calls should not be cached by SW (handled by app)
    if (event.request.url.includes('/api/')) {
        return;
    }

    // Network First strategy
    event.respondWith(
        fetch(event.request).then(networkResponse => {
            caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, networkResponse.clone());
            });
            return networkResponse;
        }).catch(() => {
            return caches.match(event.request);
        })
    );
});
