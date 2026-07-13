const CACHE_NAME = "fintrack-cache-v2";
const urlsToCache = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// Perform install
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Service Worker: Caching Files");
      return cache.addAll(urlsToCache);
    })
  );
});

// Cache and return requests
self.addEventListener("fetch", (event) => {
  // Never cache Next.js documents. App Router navigation and HMR must always
  // reach the network, otherwise a stale document can trigger reload loops.
  if (event.request.mode === "navigate") {
    return;
  }

  // Only cache same-origin static GET requests.
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response; // Return cached file
      }
      return fetch(event.request); // Fetch from network
    })
  );
});

// Update service worker
self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log("Service Worker: Clearing Old Cache");
            return caches.delete(cacheName);
          }
        })
      );
      }),
      self.clients.claim(),
    ])
  );
});
