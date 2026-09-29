/* Auto Lab service worker — offline cache */
const VERSION = 'autolab-v7.3';
const CORE    = VERSION + '-core';
const RUNTIME = VERSION + '-runtime';

const CORE_ASSETS = [
  './', './index.html', './app.css', './kit.js', './labels.js', './components.js', './components.css', './modules.js', './guard.js', './404.html',
  './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png',
  /* Module HTMLs — missing files are tolerated (each fetched individually) */
  './engine.html',
  './valvetrain.html',
  './crankshaft-piston.html',
  './airfilter.html',
  './turbocharger.html',
  './intercooler.html',
  './fuelpump.html',
  './carburetor.html',
  './mpfi.html',
  './commonrail.html',
  './ignition.html',
  './sparkplug.html',
  './coilplug.html',
  './lubrication.html',
  './oilpump.html',
  './oilfilter.html',
  './cooling.html',
  './thermostat.html',
  './radiator.html',
  './exhaustsystem.html',
  './catalytic.html',
  './egr.html',
  './dpf.html',
  './electrical.html',
  './starting-system.html',
  './lighting.html',
  './wiring.html',
  './sensors.html',
  './ecu.html',
  './obd2.html',
  './transmission.html',
  './clutch.html',
  './gearbox.html',
  './automatic.html',
  './differential.html',
  './driveshaft.html',
  './awd.html',
  './steering.html',
  './suspension.html',
  './braking.html',
  './abs-esc.html',
  './tyres.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE);
    await Promise.all(CORE_ASSETS.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res && res.ok) await cache.put(url, res);
      } catch (_) {}
    }));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k !== CORE && k !== RUNTIME)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Navigations: network-first, cache fallback */
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CORE);
        if (fresh && fresh.ok) cache.put(req, fresh.clone());   /* only cache good responses */
        return fresh;
      } catch (_) {
        const cached = (await caches.match(req)) || (await caches.match('./index.html'));
        return cached || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  /* Same-origin: network-first (keeps kit.js / app.css / pages in lock-step), cache fallback offline */
  if (url.origin === location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CORE);
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (_) {
        return (await cache.match(req)) || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  /* Three.js CDN: cache-first */
  if (url.hostname.endsWith('unpkg.com')) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (_) {
        return new Response('Offline', { status: 503 });
      }
    })());
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
