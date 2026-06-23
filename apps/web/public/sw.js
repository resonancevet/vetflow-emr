// Self-destructing service worker.
//
// Offline/PWA support was removed from VetRoamer. Devices that installed the
// previous offline worker (notably iPad home-screen apps) would otherwise keep
// serving a stale app shell that references CSS/JS bundles that no longer exist,
// producing an unstyled page. This worker takes over from the old one, purges
// all caches, unregisters itself, and reloads any controlled tabs so they fetch
// fresh content directly from the network.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {
        // Best-effort cache purge.
      }

      try {
        await self.registration.unregister();
      } catch {
        // Best-effort unregister.
      }

      try {
        const clients = await self.clients.matchAll({ type: "window" });
        clients.forEach((client) => {
          if ("navigate" in client) {
            client.navigate(client.url);
          }
        });
      } catch {
        // Best-effort reload.
      }
    })()
  );
});

// Never intercept fetches: always let the network handle requests so the page
// loads current assets while this worker is tearing itself down.
