
const CACHE_NAME = 'tms-operador-v10';
const SW_VERSION = '10.0.0';

// Recursos estáticos para pre-cachear
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-96x96.png',
  '/manifest.json'
];

// Rutas de API que deben usar Network First
const API_ROUTES = [
  'supabase.co',
  '/rest/v1/',
  '/auth/v1/',
  '/storage/v1/'
];

// Rutas de assets que deben usar Cache First
const ASSET_ROUTES = [
  '/assets/',
  '/icons/',
  '.woff',
  '.woff2',
  '.ttf',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.gif',
  '.webp'
];

self.addEventListener('install', (event) => {
  console.log(`[Service Worker] Install v${SW_VERSION} - Full offline support`);
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(error => {
        console.warn('[Service Worker] Some assets failed to cache:', error);
        // Continue even if some assets fail
        return Promise.resolve();
      });
    })
  );
  
  // Force immediate activation
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log(`[Service Worker] Activate v${SW_VERSION} - Cleaning old caches`);
  
  event.waitUntil(
    Promise.all([
      // Clean old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Claim all clients immediately
      self.clients.claim()
    ])
  );
});

// Fetch handler with caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Check if it's an API request
  const isApiRequest = API_ROUTES.some(route => request.url.includes(route));
  
  // Check if it's a static asset
  const isAsset = ASSET_ROUTES.some(route => request.url.includes(route));
  
  if (isApiRequest) {
    // Network First for API requests
    event.respondWith(networkFirst(request));
  } else if (isAsset) {
    // Cache First for static assets
    event.respondWith(cacheFirst(request));
  } else {
    // Stale While Revalidate for HTML pages
    event.respondWith(staleWhileRevalidate(request));
  }
});

// Network First strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    
    throw error;
  }
}

// Cache First strategy
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Asset not available:', request.url);
    throw error;
  }
}

// Stale While Revalidate strategy
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      const cache = caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, networkResponse.clone());
      });
    }
    return networkResponse;
  }).catch((error) => {
    console.log('[Service Worker] Fetch failed:', request.url);
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    throw error;
  });
  
  return cachedResponse || fetchPromise;
}

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
    console.log('[Service Worker] Parsed push data:', data);
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
  
  if (data.type === 'service_assigned') {
    options.actions = [
      { action: 'view', title: 'Ver Servicio', icon: '/icons/icon-96x96.png' },
      { action: 'dismiss', title: 'Cerrar' }
    ];
  } else if (data.type === 'service_completed') {
    options.actions = [
      { action: 'view', title: 'Ver Detalles', icon: '/icons/icon-96x96.png' }
    ];
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, options).catch(error => {
      console.error('[Service Worker] Failed to show notification:', error);
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.notification);
  
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
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      try {
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
        
        let targetUrl = '/';
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
        return self.clients.openWindow('/');
      }
    }).catch(error => {
      console.error('[Service Worker] Error getting clients:', error);
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
  } catch (error) {
    console.error('[Service Worker] Error syncing push subscription:', error);
  }
}

async function syncOfflineActions() {
  try {
    console.log('[Service Worker] Syncing offline actions');
    
    // Notify all clients that sync is starting
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_STARTED' });
    });
    
    // Open IndexedDB and process pending actions
    const db = await openOfflineDB();
    if (db) {
      const actions = await getPendingActions(db);
      console.log(`[Service Worker] Found ${actions.length} pending actions`);
      
      for (const action of actions) {
        try {
          await processOfflineAction(action);
          await removeAction(db, action.id);
        } catch (error) {
          console.error('[Service Worker] Failed to sync action:', action.id, error);
          await incrementRetry(db, action.id);
        }
      }
    }
    
    // Notify completion
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_COMPLETED' });
    });
  } catch (error) {
    console.error('[Service Worker] Error syncing offline actions:', error);
  }
}

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('tms-offline-cache', 2);
    request.onerror = () => resolve(null);
    request.onsuccess = () => resolve(request.result);
  });
}

function getPendingActions(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('_offlineActions', 'readonly');
    const store = transaction.objectStore('_offlineActions');
    const request = store.getAll();
    request.onsuccess = () => {
      const actions = (request.result || []).filter(
        a => (a.status === 'pending' || a.status === 'failed') && a.retries < 3
      );
      resolve(actions.sort((a, b) => a.timestamp - b.timestamp));
    };
    request.onerror = () => resolve([]);
  });
}

function removeAction(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('_offlineActions', 'readwrite');
    const store = transaction.objectStore('_offlineActions');
    store.delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function incrementRetry(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('_offlineActions', 'readwrite');
    const store = transaction.objectStore('_offlineActions');
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      if (getRequest.result) {
        const updated = {
          ...getRequest.result,
          status: 'failed',
          retries: (getRequest.result.retries || 0) + 1
        };
        store.put(updated);
      }
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function processOfflineAction(action) {
  const { type, table, data } = action;
  const SUPABASE_URL = 'https://jqszxljtfuknhuvuheko.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impxc3p4bGp0ZnVrbmh1dnVoZWtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4NjcxMDEsImV4cCI6MjA2NTQ0MzEwMX0.vsTKjDOp6_eTi4IaOEOfABfEtJEtUPtUa_WmZ-QLZic';
  
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  };
  
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  let method = 'POST';
  let body = data;
  
  if (type === 'UPDATE') {
    method = 'PATCH';
    url += `?id=eq.${data.id}`;
    const { id, ...updateData } = data;
    body = updateData;
  } else if (type === 'DELETE') {
    method = 'DELETE';
    url += `?id=eq.${data.id}`;
    body = null;
  }
  
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  
  if (!response.ok) {
    throw new Error(`Failed to sync: ${response.status}`);
  }
  
  return response;
}
