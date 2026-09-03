// Custom service worker additions bundled by next-pwa (customWorkerDir).
//
// Runs once at activation and deletes every stale Workbox *runtime* cache so
// that HTML/API/RSC responses cached by previous builds (e.g. a cached 404 or
// redirect on /login) can never be served again. The precache store
// (workbox-precache-*) is left intact: Workbox repopulates it with this
// build's manifest via precacheAndRoute + cleanupOutdatedCaches.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await self.caches.keys();
      await Promise.all(
        cacheNames.map((name) => {
          if (name.startsWith('workbox-') && !name.startsWith('workbox-precache-')) {
            return self.caches.delete(name);
          }
          return Promise.resolve();
        })
      );
    })()
  );
});
