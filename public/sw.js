
const CACHE_NAME = 'tms-operador-v12';
const SW_VERSION = '12.0.0';

// Recursos estáticos para pre-cachear
const STATIC_ASSETS = [
  '/',
  '/index.html',
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
  console.log(`[Service Worker] Install v${SW_VERSION} - Full offline support with SPA fallback`);

  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    console.log('[Service Worker] Pre-caching static assets (non-blocking)');

    // CRITICAL: cache.addAll fails entirely if one asset 404s.
    // We cache app-shell first, then cache the rest with allSettled.
    const appShellAssets = ['/', '/index.html'];
    for (const asset of appShellAssets) {
      try {
        await cache.add(new Request(asset, { cache: 'reload' }));
      } catch (error) {
        console.warn('[Service Worker] Failed to cache app shell asset:', asset, error);
      }
    }

    const otherAssets = STATIC_ASSETS.filter(a => !appShellAssets.includes(a));
    const results = await Promise.allSettled(
      otherAssets.map((asset) => cache.add(asset))
    );

    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      console.warn('[Service Worker] Some assets failed to cache:', failed);
    }
  })());

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

// Fetch handler with caching strategies - CRITICAL: SPA fallback for navigation
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
  
  // CRITICAL: Navigation requests (HTML pages) - Use SPA fallback strategy
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }
  
  if (isApiRequest) {
    // Network First for API requests
    event.respondWith(networkFirst(request));
  } else if (isAsset) {
    // Cache First for static assets
    event.respondWith(cacheFirst(request));
  } else {
    // Stale While Revalidate for other resources
    event.respondWith(staleWhileRevalidate(request));
  }
});

// CRITICAL: SPA fallback for navigation requests
// This ensures that when offline, React Router can handle all routes
async function handleNavigationRequest(request) {
  try {
    // Try network first for navigation
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache the successful response
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Navigation failed, serving app shell for SPA fallback:', request.url);
    
    // CRITICAL: Return the cached app shell (/) so React Router can handle the route
    // This is what allows /dashboard, /services, etc. to work offline
    const appShell = await caches.match('/');
    
    if (appShell) {
      console.log('[Service Worker] Serving cached app shell for:', request.url);
      return appShell;
    }
    
    // Try index.html as alternative
    const indexHtml = await caches.match('/index.html');
    if (indexHtml) {
      console.log('[Service Worker] Serving cached index.html for:', request.url);
      return indexHtml;
    }
    
    // Last resort: offline.html (only if app shell is not cached)
    console.log('[Service Worker] No app shell cached, falling back to offline.html');
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) {
      return offlinePage;
    }
    
    // Absolute last resort
    return new Response('Offline - Please connect to the internet and reload', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

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

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, networkResponse.clone());
        });
      }
      return networkResponse;
    })
    .catch((error) => {
      console.log('[Service Worker] Fetch failed:', request.url);
      // If we have cache, serve it; otherwise propagate the error.
      if (cachedResponse) return cachedResponse;
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

// Background sync handler
// IMPORTANT: Offline data sync is handled by the app (useOfflineSync) with user's JWT
// The SW only handles push subscription sync, NOT data writes to Supabase
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'push-subscription-sync') {
    event.waitUntil(syncPushSubscription());
  }
  // NOTE: 'offline-action' sync is deliberately NOT handled here
  // Data sync requires user's JWT which the SW doesn't have
  // The app's useOfflineSync hook handles data synchronization properly
});

async function syncPushSubscription() {
  try {
    console.log('[Service Worker] Syncing push subscription');
    // Just log - actual subscription sync is handled by the app
  } catch (error) {
    console.error('[Service Worker] Error syncing push subscription:', error);
  }
}

// Helper to open IndexedDB (used for reading pending count, not for syncing)
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('tms-offline-cache', 3);
    request.onerror = () => resolve(null);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('_offlineActions')) {
        db.createObjectStore('_offlineActions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('_offlineDataCache')) {
        db.createObjectStore('_offlineDataCache', { keyPath: 'key' });
      }
    };
  });
}
