
const CACHE_NAME = 'tms-operador-v5';

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install v5 - Ultra simplified');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate v5 - Clean all caches');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('[Service Worker] Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests and skip auth/realtime
  if (event.request.method !== 'GET' || 
      event.request.url.includes('supabase.co/auth/') ||
      event.request.url.includes('supabase.co/realtime/')) {
    return;
  }

  // Simple network-only strategy to avoid cache issues
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('Offline - Service unavailable', { 
        status: 503,
        statusText: 'Service Unavailable'
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
