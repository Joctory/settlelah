const CACHE_NAME = 'settlelah-v1';
const OFFLINE_URL = '/offline.html';

// Install event - cache the offline page
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        // console.log("Opened cache");
        return cache.add(new Request(OFFLINE_URL, { cache: 'reload' })).catch((err) => {
          console.warn('Failed to cache offline page:', err);
          // Continue even if offline page caching fails
        });
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME;
            })
            .map((cacheName) => {
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        // Tell the active service worker to take control of the page immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache if offline
self.addEventListener('fetch', (event) => {
  // Only intercept navigate requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // If fetch fails (offline), serve the cached offline page
        return caches.match(OFFLINE_URL).then((response) => {
          return response || new Response('You are offline and the offline page could not be served.');
        });
      })
    );
  }
});
