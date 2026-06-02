const CACHE_NAME = "vetroamer-shell-v3";
const APP_SHELL = [
  "/",
  "/login",
  "/schedule",
  "/patients",
  "/clients",
  "/offline-notes",
  "/offline-charts",
  "/sync",
  "/favicon.svg",
  "/logo.svg",
  "/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          APP_SHELL.map((url) =>
            fetch(url, { credentials: "same-origin" })
              .then((response) => {
                if (response.ok) return cache.put(url, response);
              })
              .catch(() => {
                // A single shell URL failing should not prevent the service
                // worker from installing; visited pages are cached below.
              })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy.clone());
              cache.put(url.pathname, copy);
            });
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match(url.pathname))
            .then((cached) => cached || caches.match("/offline-charts"))
            .then((cached) => cached || caches.match("/schedule"))
            .then((cached) => cached || caches.match("/login"))
        )
    );
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/favicon.svg" ||
    url.pathname === "/logo.svg" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
  }
});
