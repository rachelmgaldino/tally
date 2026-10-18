// Tally's service worker: lets the home-screen app open without the network.
// Pages are fetched fresh when online and fall back to the last copy offline;
// built files (hashed names) and fonts are kept once fetched. Supabase calls
// are never touched, so money data always comes from the server.
const CACHE = 'tally-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add('/')).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  const keep = (url.origin === location.origin && (url.pathname.startsWith('/assets/') || /\.(png|svg|webmanifest)$/.test(url.pathname)))
    || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (!keep) return
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
      }
      return res
    })),
  )
})
