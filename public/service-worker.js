// Service Worker for SettleLah PWA
const CACHE_NAME = "settlelah-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/styles.css",
  "/script.js",
  "/login.html",
  "/login.css",
  "/login.js",
  "/manifest.json",
  "/offline.html",
  "/assets/start-card.svg",
  // Add other important assets here
];

// Installation event - cache all static resources
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Opened cache");
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Cache hit - return response
      if (response) {
        return response;
      }

      // Clone the request
      const fetchRequest = event.request.clone();

      return fetch(fetchRequest)
        .then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            // Don't cache API calls or external resources
            if (event.request.url.includes("/api/") || !event.request.url.startsWith(self.location.origin)) {
              return;
            }

            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // If network fails and it's a navigation request, serve the offline page
          if (event.request.mode === "navigate") {
            return caches.match("/offline.html");
          }

          // For image requests, you could return a default offline image
          if (event.request.destination === "image") {
            return caches.match("/assets/offline-image.png");
          }

          // Return the offline page for any other type of request
          return caches.match("/offline.html");
        });
    })
  );
});

// Background sync for offline data submissions
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-settlements") {
    event.waitUntil(syncSettlements());
  }
});

// Listen for push notifications
self.addEventListener("push", (event) => {
  const options = {
    body: event.data.text(),
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: "1",
    },
    actions: [
      { action: "view", title: "View Settlement" },
      { action: "close", title: "Close" },
    ],
  };

  event.waitUntil(self.registration.showNotification("SettleLah", options));
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "view") {
    clients.openWindow("/");
  }
});
// Function to sync offline settlements
async function syncSettlements() {
  try {
    const offlineData = await getOfflineData();

    if (offlineData && offlineData.length) {
      // Process each offline entry
      for (const entry of offlineData) {
        await fetch("/api/settlements", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(entry),
        });
      }

      // Clear synced offline data
      await clearOfflineData();

      // Notify the user
      self.registration.showNotification("SettleLah", {
        body: "Your settlements have been synced!",
        icon: "/icons/icon-192x192.png",
      });
    }
  } catch (error) {
    console.error("Sync failed:", error);
  }
}

// These functions would be implemented to work with IndexedDB
function getOfflineData() {
  // Implementation for retrieving offline data
  return Promise.resolve([]);
}

function clearOfflineData() {
  // Implementation for clearing synced offline data
  return Promise.resolve();
}
