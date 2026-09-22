// Network first so a push shows up right away; falls back to the saved copy when offline.
// Covers the start screen, money and study. +1 keeps its own, in plusone/. Cache names must not clash
// with the old +1 at /-1/, which lives on the same site.
const CACHE = '0_0-v3';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './money/', './money/index.html', './money/money.js', './study/', './study/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => e.waitUntil(caches.delete('0_0-money-v1').then(() => self.clients.claim())));

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
