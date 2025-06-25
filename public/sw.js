
const CACHE_NAME = 'tms-operador-v6';

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install v6 - Push notifications enabled');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate v6 - Clean all caches');
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

// Enhanced push notifications handler
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');
  
  if (!event.data) {
    console.log('[Service Worker] No push data received');
    return;
  }
  
  let data;
  try {
    data = event.data.json();
  } catch (error) {
    console.error('[Service Worker] Error parsing push data:', error);
    data = {
      title: 'TMS Grúas',
      body: event.data.text() || 'Nueva notificación',
      icon: '/icons/icon-192x192.png'
    };
  }
  
  console.log('[Service Worker] Push notification data:', data);
  
  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: data.actions || [],
    requireInteraction: data.urgent === true || data.type === 'service_assigned',
    tag: data.tag || `tms-${data.type || 'notification'}`,
    timestamp: Date.now(),
    silent: false,
    renotify: true
  };
  
  // Add default actions based on notification type
  if (data.type === 'service_assigned') {
    options.actions = [
      {
        action: 'view',
        title: 'Ver Servicio',
        icon: '/icons/icon-96x96.png'
      },
      {
        action: 'dismiss',
        title: 'Cerrar'
      }
    ];
  } else if (data.type === 'service_completed') {
    options.actions = [
      {
        action: 'view',
        title: 'Ver Detalles',
        icon: '/icons/icon-96x96.png'
      }
    ];
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Enhanced notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.notification);
  
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data;
  
  if (action === 'dismiss') {
    return;
  }
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Try to find an existing client
      for (const client of clients) {
        if (client.url.includes(self.registration.scope)) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            action,
            data,
            notificationType: data.type
          });
          return;
        }
      }
      
      // Open new window if no existing client
      let targetUrl = '/';
      
      // Navigate to appropriate page based on notification type
      if (data.type === 'service_assigned' || data.type === 'service_completed') {
        if (data.serviceId) {
          targetUrl = data.userRole === 'operator' ? '/operator' : '/services';
        }
      } else if (data.type === 'invoice_generated') {
        targetUrl = '/invoices';
      }
      
      return self.clients.openWindow(targetUrl);
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'push-subscription-sync') {
    event.waitUntil(syncPushSubscription());
  } else if (event.tag === 'offline-action') {
    event.waitUntil(syncOfflineActions());
  }
});

async function syncPushSubscription() {
  try {
    console.log('[Service Worker] Syncing push subscription');
    // This would sync any pending push subscription updates
    // Implementation depends on your offline storage strategy
  } catch (error) {
    console.error('[Service Worker] Error syncing push subscription:', error);
  }
}

async function syncOfflineActions() {
  try {
    console.log('[Service Worker] Syncing offline actions');
    
    // Notify all clients that sync is happening
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_STARTED'
      });
    });
    
    // Here you would sync any offline actions
    // For now, just notify completion
    setTimeout(() => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_COMPLETED'
        });
      });
    }, 1000);
  } catch (error) {
    console.error('[Service Worker] Error syncing offline actions:', error);
  }
}
