const CACHE_NAME = 'uu-qn-bank-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Pass-through network-first strategy for installability compliance
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
