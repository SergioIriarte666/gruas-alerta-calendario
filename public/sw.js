
const CACHE_NAME = 'tms-operador-v1';
const DYNAMIC_CACHE = 'dynamic-tms-operador-v1';

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  event.waitUntil(caches.open(CACHE_NAME));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchResponse) => {
        if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
          return fetchResponse;
        }
        const responseToCache = fetchResponse.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return fetchResponse;
      });
    }).catch(err => {
      console.error('[Service Worker] Fetch failed:', err);
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate');
  const cacheWhitelist = [CACHE_NAME, DYNAMIC_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});
