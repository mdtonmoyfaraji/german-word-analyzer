const CACHE_NAME = 'gwa-v1';
const OFFLINE_ASSETS = [
  '/german-word-analyzer/',
  '/german-word-analyzer/index.html',
  '/german-word-analyzer/assets/css/style.css',
  '/german-word-analyzer/assets/js/script.js',
  '/german-word-analyzer/assets/js/hover-addon.js',
  '/german-word-analyzer/assets/js/dictionary.js',
  '/german-word-analyzer/assets/images/logo.svg',
  '/german-word-analyzer/assets/images/favicon.svg',
  '/german-word-analyzer/assets/images/pwa-192.png',
  '/german-word-analyzer/assets/images/pwa-512.png',
  '/german-word-analyzer/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => caches.match('/german-word-analyzer/index.html'));
    })
  );
});
