// v2's own service worker: opens straight to Home offline, and never stalls on a bad signal.
// Every file is fetched fresh when the network answers quickly (so a new version is never mixed
// with an old one); if it doesn't answer within 1.5 s, or there's no signal, the saved copy is used.
// It only keeps the app's own files. Your data lives in IndexedDB, never in this cache.

const CACHE = '0_0-v2-shell';
const SHELL = [
  './', './index.html', './peace.css', './manifest.json', './app.js', './ui.js', './state.js',
  './core/log.js', './core/store.js', './core/backup.js',
  './engines/sebdate.js', './engines/sky.js', './engines/pillars.js', './engines/week.js', './engines/money.js',
  './engines/steps.js', './engines/study.js', './engines/tide.js', './engines/long.js',
  './places/home.js', './places/day.js', './places/money.js', './places/grow.js', './places/study.js', './places/tide.js', './places/long.js',
  '../valley/engine.js', '../icon-192.png', '../icon-512.png',
  './fonts/literata-latin.woff2', './fonts/inter-latin.woff2',   // the -ext pieces are saved the first time they're used
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; });
    net.catch(() => {});   // if the saved copy wins, a late network failure is fine
    const timeout = new Promise(r => setTimeout(r, 1500, null));
    try {
      const fast = await Promise.race([net, timeout]);
      if (fast) return fast;
    } catch {}
    const saved = await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await cache.match('./index.html') : null);
    return saved || net;   // nothing saved yet: wait for the network after all
  })());
});
