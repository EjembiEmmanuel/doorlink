// Deliberately minimal. DoorLink's whole design philosophy is that nothing
// pretends to be live or verified when it isn't — so this service worker
// does not cache pages or API responses as if they were fresh data. Its
// only job is to satisfy PWA installability (a fetch handler must exist)
// and hand back a static, honestly-labelled offline page when navigation
// truly has no network, instead of silently serving stale marketplace or
// catalogue content as if it were current.
const OFFLINE_CACHE = 'doorlink-offline-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return

  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  )
})
