/* Passive kill-switch service worker.
   Any browser that still has an old worker installed will fetch this file on
   its next update check. It quietly wipes caches and unregisters itself.
   It never intercepts fetches and never navigates/reloads pages — reloading
   from inside a worker previously contributed to refresh loops during login. */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      } catch (e) {}
      try {
        await self.registration.unregister();
      } catch (e) {}
    })()
  );
});
