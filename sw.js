const V = 'flock-v1';
const CORE = ['./', './index.html', './manifest.webmanifest',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const isTile = /tile\.openstreetmap\.org|arcgisonline\.com/.test(u.host);
  const isCore = CORE.some(c => e.request.url.endsWith(c.replace('./', '')) || u.href === c) || u.origin === location.origin;
  if (!isTile && !isCore) return;
  e.respondWith(caches.open(V).then(async c => {
    const hit = await c.match(e.request);
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return isTile ? (hit || net) : (net.then(r => r || hit));
  }));
});
