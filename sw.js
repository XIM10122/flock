const V = 'flock-202608170751-82f7c91d';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon.svg'];
// Pinned to a version in the URL, so once cached they never need revalidating.
const LIB = ['https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];
const TILE_CAP = 1200;   // roughly a county at the zooms you actually read

// cache:'reload' on CORE: the browser's own HTTP cache must not hand this new worker the
// previous build's page. LIB is pinned to a version in the URL, so it is fine as-is.
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE.map(u => new Request(u, {cache: 'reload'})).concat(LIB))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

// Cache API keys come back in insertion order, so the oldest tiles are at the front.
let puts = 0;
async function trim(c) {
  if (++puts % 50) return;
  const ks = (await c.keys()).filter(r => /tile\.openstreetmap\.org|arcgisonline\.com/.test(new URL(r.url).host));
  for (const r of ks.slice(0, ks.length - TILE_CAP)) await c.delete(r);
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  const isTile = /tile\.openstreetmap\.org|arcgisonline\.com/.test(u.host);
  const isLib = LIB.includes(u.href);
  const isPage = u.origin === location.origin;
  if (!isTile && !isLib && !isPage) return;
  e.respondWith(caches.open(V).then(async c => {
    const hit = await c.match(e.request);
    // Tiles and the pinned library: whatever is cached, instantly. The page itself:
    // network first, so a republish shows up, falling back to the cache with no signal.
    if ((isTile || isLib) && hit) return hit;
    try {
      const r = await fetch(e.request);
      if (r.ok) { await c.put(e.request, r.clone()); if (isTile) trim(c); }
      return r;
    } catch (err) {
      if (hit) return hit;
      throw err;
    }
  }));
});
