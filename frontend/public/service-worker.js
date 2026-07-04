/* Kill-switch service worker.
   The old /service-worker.js used a cache-first strategy that could pin users
   to a stale app shell (slow/broken first loads). Any client that still has it
   installed will fetch this file, which unregisters itself, wipes its caches,
   and reloads open tabs so they fall under the correct /sw.js worker. */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      await self.registration.unregister();
      const clientList = await self.clients.matchAll({ type: 'window' });
      clientList.forEach((client) => client.navigate(client.url));
    })()
  );
});
