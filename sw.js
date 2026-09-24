/* SpeechBuddy service worker
   - pagina: network-first (online vezi mereu ultima versiune), fallback offline din cache
   - audio + imagini: se salveaza la prima folosire, apoi merg si offline
   - /api/*: niciodata in cache (mereu live)
   Cand schimbi lista APP_SHELL sau vrei sa fortezi un cache nou, creste VERSION. */
const VERSION = 'v1';
const SHELL_CACHE = 'sb-shell-' + VERSION;
const MEDIA_CACHE = 'sb-media';
const FONT_CACHE = 'sb-fonts';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/images/zuzi-mascot.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('sb-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) return;
    if (req.mode === 'navigate') { event.respondWith(networkFirstPage(req)); return; }
    if (url.pathname.startsWith('/audio/')) { event.respondWith(audioResponse(event, req, url)); return; }
    if (url.pathname.startsWith('/images/') || url.pathname.startsWith('/icons/')) {
      event.respondWith(staleWhileRevalidate(event, req, MEDIA_CACHE));
    }
    return;
  }
  if (url.hostname === 'fonts.bunny.net') {
    event.respondWith(staleWhileRevalidate(event, req, FONT_CACHE));
  }
});

function fetchWithTimeout(url, ms) {
  if (!ms) return fetch(url);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}

async function networkFirstPage(req) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match('/');
  try {
    const res = await fetchWithTimeout(req.url, cached ? 4000 : 0);
    if (res.ok) await cache.put('/', res.clone());
    return res;
  } catch (e) {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(event, req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  if (cached) { event.waitUntil(network); return cached; }
  return (await network) || Response.error();
}

/* Audio: Safari/iOS cere fisierele audio cu antet Range si vrea raspuns 206,
   deci raspunsul din cache trebuie taiat manual. */
const revalidated = new Set();

async function audioResponse(event, req, url) {
  const cache = await caches.open(MEDIA_CACHE);
  const key = url.origin + url.pathname;
  const cached = await cache.match(key);
  if (cached) {
    if (!revalidated.has(key)) {
      revalidated.add(key);
      event.waitUntil(refreshAudio(cache, key));
    }
    return rangeResponse(req, cached);
  }
  try {
    const res = await fetch(key);
    if (!res.ok) return res;
    await cache.put(key, res.clone());
    return rangeResponse(req, res);
  } catch (e) {
    return Response.error();
  }
}

async function refreshAudio(cache, key) {
  try {
    const res = await fetch(key, { cache: 'no-cache' });
    if (res.ok) await cache.put(key, res);
  } catch (e) { /* offline: pastram varianta veche */ }
}

async function rangeResponse(req, res) {
  const range = req.headers.get('range');
  if (!range) return res;
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  const type = res.headers.get('Content-Type') || 'audio/mpeg';
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!m || (m[1] === '' && m[2] === '')) {
    return new Response(buf, { status: 200, headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' } });
  }
  let start, end;
  if (m[1] === '') { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
  else { start = parseInt(m[1], 10); end = m[2] === '' ? size - 1 : Math.min(parseInt(m[2], 10), size - 1); }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  }
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': type,
      'Content-Length': String(end - start + 1),
      'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
      'Accept-Ranges': 'bytes'
    }
  });
}
