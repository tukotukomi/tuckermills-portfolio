// Caches the app's own files so it opens instantly and works offline. Streams and anything from other sites are never touched.
const CACHE = 'fmc-v34';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/main.js', 'js/scene.js', 'js/util.js', 'js/sprites.js', 'js/sfx.js', 'js/coins.js', 'js/story.js', 'js/traits.js', 'js/enemies.js',
  'js/i18n.js', 'js/icons.js', 'js/themes.js', 'js/support.js', 'js/visualizer.js', 'js/summon.js', 'js/player.js', 'js/ui.js',
  'assets/icon-180.png', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/sprites/manifest.json'
];

// The sprite sheet names come from the exporter's manifest, so adding art never needs this file touched.
async function precache() {
  const c = await caches.open(CACHE);
  await c.addAll(SHELL);
  try {
    const m = await (await fetch('assets/sprites/manifest.json')).json();
    await c.addAll(Object.keys(m).filter(k => k[0] !== '_').map(k => 'assets/sprites/' + k + '.png'));
  } catch (err) { /* the sprites are cached as they are first used instead */ }
}
self.addEventListener('install', e => { e.waitUntil(precache().then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Network first (so updates arrive), the cache when offline.
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request)));
});
