// VoxelCraft service worker — network-first for pages so updates always show,
// cache-first for static assets, with offline fallback.
const CACHE = 'voxelcraft-v2';
const ASSETS = [
  './', './index.html', './game.html', './guide.html', './changelog.html',
  './about.html', './privacy.html', './manifest.json',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(ASSETS.map((u) => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.url.includes('googlesyndication') || req.url.includes('doubleclick') || req.url.includes('google-analytics') || req.url.includes('adservice')) return;

  const accept = req.headers.get('accept') || '';
  const isPage = req.mode === 'navigate' || accept.includes('text/html');

  if (isPage) {
    // NETWORK-FIRST: freshest page when online, cache fallback offline.
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        try { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } catch (_) {}
        return res;
      } catch (_) {
        return (await caches.match(req)) || (await caches.match('./index.html')) || (await caches.match('./game.html'));
      }
    })());
    return;
  }

  // CACHE-FIRST for static assets (engine, icons, manifest).
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    const res = await fetch(req);
    try {
      if (res && res.status === 200 && new URL(req.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
    } catch (_) {}
    return res;
  })());
});
