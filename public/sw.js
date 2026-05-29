const CACHE = 'facilityos-shell-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './manifest.cloud.webmanifest', './icon-192.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((r) => r || caches.match('./index.html')))
  );
});

self.addEventListener('push', (event) => {
  let payload = { title: 'FacilityOS', body: 'New alert from your facility' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch { /* use defaults */ }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'FacilityOS', {
      body: payload.body || '',
      icon: './icon-192.svg',
      badge: './icon-192.svg',
      tag: payload.data?.pool_id || 'facilityos-alert',
      data: payload.data || {},
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./');
      return undefined;
    })
  );
});
