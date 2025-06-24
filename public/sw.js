
const CACHE_NAME = 'tms-operador-v4';
const DYNAMIC_CACHE = 'dynamic-tms-operador-v4';

// URLs críticas para cachear
const CRITICAL_URLS = [
  '/',
  '/operator',
  '/auth',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/images/crane-photo.png'
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install v4 - Simplified');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CRITICAL_URLS).catch(err => {
        console.warn('[Service Worker] Failed to cache some resources:', err);
        return Promise.resolve();
      });
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate v4 - Clean old caches');
  const cacheWhitelist = [CACHE_NAME, DYNAMIC_CACHE];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('[Service Worker] Deleting cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and Supabase auth
  if (event.request.method !== 'GET' || 
      event.request.url.includes('supabase.co/auth/') ||
      event.request.url.includes('supabase.co/realtime/')) {
    return;
  }

  // Simple network-first strategy for all requests
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, responseClone).catch(err => {
              console.warn('[Service Worker] Failed to cache:', err);
            });
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response('Offline - Service unavailable', { status: 503 });
        });
      })
  );
});

// Push notifications handler
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  console.log('[Service Worker] Push notification received:', data);
  
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: data.actions || [],
    requireInteraction: data.urgent === true,
    tag: data.tag || 'tms-notification'
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.notification);
  
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data;
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      for (const client of clients) {
        if (client.url === self.registration.scope && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            action,
            data
          });
          return;
        }
      }
      
      const targetUrl = data.url || '/';
      return self.clients.openWindow(targetUrl);
    })
  );
});
