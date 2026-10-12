// This address used to host the app's service worker. The app moved to /fantasyradiocompanion/: clear what the old install cached,
// remove this worker, and send any open window across.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const c of clients) c.navigate('/fantasyradiocompanion/');
  })());
});