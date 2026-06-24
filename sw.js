﻿﻿﻿const CACHE_NAME = 'kbs-industrial-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/admin.js',
  '/js/api.js',
  '/js/ui.js',
  '/js/utils.js',
  '/data/index.json',
  '/feed.xml',
  '/404.html',
  '/manifest.json',
  '/favicon.svg',
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).catch(err => console.warn('Cache install failed:', err));
  });
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first for data/API, cache first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isData = url.pathname.includes('/data/') || url.pathname.includes('/api/');
  const isHtml = event.request.headers.get('accept')?.includes('text/html');

  if (isData) {
    // Always fetch fresh data, fallback to cache only when offline
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (isHtml) {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Background sync for data updates
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(this.syncData());
  }
});
