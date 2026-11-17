// Hanzi Drill offline cache.
// When you change any file, bump VERSION so phones pick up the new copy.
const VERSION = 'hanzi-drill-v2';
const FILES = [
  './',
  'index.html',
  'data.js',
  'hanzi-writer.min.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'strokes/s0.json', 'strokes/s1.json', 'strokes/s2.json', 'strokes/s3.json', 'strokes/s4.json',
  'strokes/s5.json', 'strokes/s6.json', 'strokes/s7.json', 'strokes/s8.json', 'strokes/s9.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(FILES.map(f => new Request(f, {cache: 'reload'}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('hanzi-drill-') && k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({type: 'window'});
    clients.forEach(c => c.postMessage('cached'));
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, {ignoreSearch: true});
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      return Response.error();
    }
  })());
});
