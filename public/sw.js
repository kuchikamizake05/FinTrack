const STATIC_CACHE = "fintrack-static-v6";
const PAGE_CACHE = "fintrack-pages-v6";
const PRECACHE_URLS = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith("fintrack-") && ![STATIC_CACHE, PAGE_CACHE].includes(name)).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;

  if (request.mode === "navigate") {
    const offlineFallback = () => caches.match("/offline").then((response) => (
      response || new Response("FinTrack sedang offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    ));
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response.ok && self.navigator.onLine === false) return offlineFallback();
          if (response.ok && new URL(request.url).pathname === "/offline") {
            const copy = response.clone();
            void caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(offlineFallback),
    );
    return;
  }

  const destination = request.destination;
  if (!["style", "script", "font", "image"].includes(destination)) return;
  event.respondWith(
    caches.match(request).then(async (cached) => {
      const refresh = () => fetch(request).then((response) => {
        if (response.ok) void caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone()));
        return response;
      });
      if (cached) {
        event.waitUntil(refresh().then(() => undefined).catch(() => undefined));
        return cached;
      }
      return refresh();
    }),
  );
});
