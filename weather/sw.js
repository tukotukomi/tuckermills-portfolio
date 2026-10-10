// Blue Marble Forecast moved to https://bluemarbleforecast.com. This replaces
// the old app's service worker so installed copies stop serving cached files:
// it clears its caches, unregisters itself and reloads open pages, which then
// load the redirect in index.html.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
  })());
});
