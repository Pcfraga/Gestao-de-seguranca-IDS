const APP_CACHE = 'ids-app-offline-v1'
const APP_SHELL = ['/', '/index.html', '/ids-mark.svg', '/manifest.webmanifest']

self.addEventListener('install', event => {
  event.waitUntil(precacheApplication())
  self.skipWaiting()
})

async function precacheApplication() {
  const cache = await caches.open(APP_CACHE)
  await cache.addAll(APP_SHELL)
  const index = await cache.match('/index.html')
  if (!index) return
  const html = await index.clone().text()
  const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)]
    .map(match => match[1])
  await cache.addAll([...new Set(assets)])
}

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('ids-app-offline-') && key !== APP_CACHE)
        .map(key => caches.delete(key)),
    )),
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        const copy = response.clone()
        caches.open(APP_CACHE).then(cache => cache.put('/index.html', copy))
        return response
      }).catch(() => caches.match('/index.html')),
    )
    return
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone()
        caches.open(APP_CACHE).then(cache => cache.put(request, copy))
      }
      return response
    })),
  )
})
