
const CACHE_NAME = 'tms-operador-v2';
const DYNAMIC_CACHE = 'dynamic-tms-operador-v2';
const OFFLINE_CACHE = 'offline-tms-v2';

// Estrategias de cache específicas para TMS Grúas
const CACHE_STRATEGIES = {
  // Datos críticos para operadores (alta prioridad offline)
  '/operator': 'cache-first',
  '/operator/': 'cache-first',
  
  // Dashboard y datos administrativos
  '/dashboard': 'stale-while-revalidate',
  '/': 'stale-while-revalidate',
  
  // Gestión de datos (requieren datos frescos)
  '/services': 'network-first',
  '/clients': 'network-first',
  '/invoices': 'network-first',
  
  // Assets estáticos
  '*.js': 'cache-first',
  '*.css': 'cache-first',
  '*.woff2': 'cache-first',
  '*.png': 'cache-first',
  '*.jpg': 'cache-first',
  '*.svg': 'cache-first',
};

// URLs críticas para cachear inmediatamente
const CRITICAL_URLS = [
  '/',
  '/operator',
  '/auth',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Background sync tags
const SYNC_TAGS = {
  SERVICE_UPDATE: 'service-update',
  INSPECTION_COMPLETE: 'inspection-complete',
  OFFLINE_ACTION: 'offline-action'
};

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install v2');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(cache => cache.addAll(CRITICAL_URLS)),
      self.skipWaiting()
    ])
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate v2');
  const cacheWhitelist = [CACHE_NAME, DYNAMIC_CACHE, OFFLINE_CACHE];
  
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!cacheWhitelist.includes(cacheName)) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and Supabase auth
  if (event.request.method !== 'GET' || 
      event.request.url.includes('supabase.co/auth/') ||
      event.request.url.includes('supabase.co/realtime/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  const url = new URL(event.request.url);
  const strategy = getStrategyForUrl(url.pathname);

  event.respondWith(handleRequest(event.request, strategy));
});

function getStrategyForUrl(pathname) {
  // Operador portal - cache first para trabajo offline
  if (pathname.startsWith('/operator')) {
    return 'cache-first';
  }
  
  // Supabase REST API - network first con fallback
  if (pathname.includes('/rest/v1/')) {
    return 'network-first-with-cache';
  }
  
  // Assets estáticos - cache first
  if (pathname.match(/\.(js|css|woff2|png|jpg|svg)$/)) {
    return 'cache-first';
  }
  
  // Default - stale while revalidate
  return 'stale-while-revalidate';
}

async function handleRequest(request, strategy) {
  const cache = await caches.open(DYNAMIC_CACHE);
  
  switch (strategy) {
    case 'cache-first':
      return cacheFirst(request, cache);
    
    case 'network-first':
      return networkFirst(request, cache);
    
    case 'network-first-with-cache':
      return networkFirstWithCache(request, cache);
    
    case 'stale-while-revalidate':
      return staleWhileRevalidate(request, cache);
    
    default:
      return networkFirst(request, cache);
  }
}

async function cacheFirst(request, cache) {
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[Service Worker] Cache first failed:', error);
    return new Response('Offline - No cached version available', { status: 503 });
  }
}

async function networkFirst(request, cache) {
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    console.error('[Service Worker] Network first failed:', error);
    return new Response('Offline - Service unavailable', { status: 503 });
  }
}

async function networkFirstWithCache(request, cache) {
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      console.log('[Service Worker] Serving from cache:', request.url);
      return cached;
    }
    throw error;
  }
}

async function staleWhileRevalidate(request, cache) {
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(err => {
    console.error('[Service Worker] Revalidation failed:', err);
    return cached;
  });
  
  return cached || fetchPromise;
}

// Background sync para operaciones críticas
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync triggered:', event.tag);
  
  switch (event.tag) {
    case SYNC_TAGS.SERVICE_UPDATE:
      event.waitUntil(syncServiceUpdates());
      break;
    
    case SYNC_TAGS.INSPECTION_COMPLETE:
      event.waitUntil(syncInspectionData());
      break;
    
    case SYNC_TAGS.OFFLINE_ACTION:
      event.waitUntil(syncOfflineActions());
      break;
  }
});

async function syncServiceUpdates() {
  try {
    // Recuperar datos pendientes de IndexedDB
    const pendingUpdates = await getFromIndexedDB('pendingServiceUpdates');
    
    for (const update of pendingUpdates || []) {
      try {
        await fetch('/api/services/update', {
          method: 'POST',
          body: JSON.stringify(update),
          headers: { 'Content-Type': 'application/json' }
        });
        
        // Remover de IndexedDB tras éxito
        await removeFromIndexedDB('pendingServiceUpdates', update.id);
      } catch (error) {
        console.error('[Service Worker] Failed to sync service update:', error);
      }
    }
  } catch (error) {
    console.error('[Service Worker] Sync service updates failed:', error);
  }
}

async function syncInspectionData() {
  try {
    const pendingInspections = await getFromIndexedDB('pendingInspections');
    
    for (const inspection of pendingInspections || []) {
      try {
        await fetch('/api/inspections/submit', {
          method: 'POST',
          body: JSON.stringify(inspection),
          headers: { 'Content-Type': 'application/json' }
        });
        
        await removeFromIndexedDB('pendingInspections', inspection.id);
        
        // Notificar al cliente sobre el éxito
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'INSPECTION_SYNCED',
              data: { id: inspection.id }
            });
          });
        });
      } catch (error) {
        console.error('[Service Worker] Failed to sync inspection:', error);
      }
    }
  } catch (error) {
    console.error('[Service Worker] Sync inspections failed:', error);
  }
}

async function syncOfflineActions() {
  try {
    const offlineActions = await getFromIndexedDB('offlineActions');
    
    for (const action of offlineActions || []) {
      try {
        const response = await fetch(action.url, {
          method: action.method,
          body: action.body,
          headers: action.headers
        });
        
        if (response.ok) {
          await removeFromIndexedDB('offlineActions', action.id);
        }
      } catch (error) {
        console.error('[Service Worker] Failed to sync offline action:', error);
      }
    }
  } catch (error) {
    console.error('[Service Worker] Sync offline actions failed:', error);
  }
}

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
      // Si hay una ventana abierta, enfocarla
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
      
      // Si no hay ventana abierta, abrir una nueva
      const targetUrl = data.url || '/';
      return self.clients.openWindow(targetUrl);
    })
  );
});

// Helper functions para IndexedDB
async function getFromIndexedDB(storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TMSOfflineDB', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' });
      }
    };
  });
}

async function removeFromIndexedDB(storeName, id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TMSOfflineDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const deleteRequest = store.delete(id);
      
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}
