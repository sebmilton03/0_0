// Network first so a push shows up right away; falls back to the saved copy when offline.
// Covers the start screen, money, valley and study. +1 keeps its own, in plusone/. Cache names must not clash
// with the old +1 at /-1/, which lives on the same site.
const CACHE = '0_0-v4';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './money/', './money/index.html', './money/money.js', './valley/', './valley/index.html', './valley/engine.js', './valley/valley.js', './study/', './study/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

// Old copies of this cache go; anything else on the site (like +1's) is left alone.
self.addEventListener('activate', e => e.waitUntil(Promise.all(['0_0-money-v1', '0_0-v3'].map(k => caches.delete(k))).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
