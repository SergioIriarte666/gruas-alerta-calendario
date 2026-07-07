
const CACHE_NAME = 'tms-operador-v11';
const SW_VERSION = '11.0.0';
const DEBUG = false;

self.addEventListener('install', (event) => {
  if (DEBUG) console.log(`[Service Worker] Install v${SW_VERSION} - waiting for client ack`);
  // No auto skipWaiting: se espera un mensaje SKIP_WAITING del cliente para
  // que la app pueda avisar "Nueva versión disponible" antes de activar.
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    if (DEBUG) console.log('[Service Worker] SKIP_WAITING received, activating new version');
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  if (DEBUG) console.log(`[Service Worker] Activate v${SW_VERSION} - Clearing ALL caches`);
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (DEBUG) console.log('[Service Worker] Deleting cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }),
      self.clients.claim()
    ])
  );
});

// Enhanced push notifications handler with better error handling
self.addEventListener('push', (event) => {
  if (DEBUG) console.log('[Service Worker] Push notification received');
  
  if (!event.data) {
    if (DEBUG) console.log('[Service Worker] No push data received');
    return;
  }
  
  let data;
  try {
    data = event.data.json();
    if (DEBUG) console.log('[Service Worker] Parsed push data:', data);
  } catch (error) {
    console.warn('[Service Worker] Error parsing push data, using fallback:', error);
    data = {
      title: 'TMS Grúas',
      body: event.data.text() || 'Nueva notificación',
      icon: '/icons/icon-192x192.png'
    };
  }
  
  if (!data.title || !data.body) {
    console.error('[Service Worker] Invalid notification data:', data);
    return;
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: data.actions || [],
    requireInteraction: data.urgent === true || data.type === 'service_assigned',
    tag: data.tag || `tms-${data.type || 'notification'}-${Date.now()}`,
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
    self.registration.showNotification(data.title, options).catch(error => {
      console.error('[Service Worker] Failed to show notification:', error);
    })
  );
});

// Enhanced notification click handler with better error handling
self.addEventListener('notificationclick', (event) => {
  if (DEBUG) console.log('[Service Worker] Notification clicked:', event.notification);
  
  try {
    event.notification.close();
  } catch (error) {
    console.warn('[Service Worker] Error closing notification:', error);
  }
  
  const action = event.action;
  const data = event.notification.data || {};
  
  if (action === 'dismiss') {
    return;
  }
  
  event.waitUntil(
    self.clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    }).then(clients => {
      try {
        // Try to find an existing client
        for (const client of clients) {
          if (client.url && client.url.includes(self.registration.scope.replace(/\/$/, ''))) {
            return client.focus().then(() => {
              return client.postMessage({
                type: 'NOTIFICATION_CLICKED',
                action,
                data,
                notificationType: data.type
              });
            }).catch(error => {
              console.warn('[Service Worker] Error messaging client:', error);
            });
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
      } catch (error) {
        console.error('[Service Worker] Error in notification click handler:', error);
        // Fallback: always try to open main page
        return self.clients.openWindow('/');
      }
    }).catch(error => {
      console.error('[Service Worker] Error getting clients:', error);
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (DEBUG) console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'push-subscription-sync') {
    event.waitUntil(syncPushSubscription());
  } else if (event.tag === 'offline-action') {
    event.waitUntil(syncOfflineActions());
  }
});

async function syncPushSubscription() {
  try {
    if (DEBUG) console.log('[Service Worker] Syncing push subscription');
    // This would sync any pending push subscription updates
    // Implementation depends on your offline storage strategy
  } catch (error) {
    console.error('[Service Worker] Error syncing push subscription:', error);
  }
}

async function syncOfflineActions() {
  try {
    if (DEBUG) console.log('[Service Worker] Syncing offline actions');
    
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
