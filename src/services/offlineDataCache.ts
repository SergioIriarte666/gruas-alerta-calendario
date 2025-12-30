/**
 * Offline Data Cache Service
 * Mantiene un "espejo" local de los datos de Supabase en IndexedDB
 */

const DB_NAME = 'tms-offline-cache';
const DB_VERSION = 2;

export interface CacheMetadata {
  tableName: string;
  lastSync: number;
  recordCount: number;
}

const CACHEABLE_TABLES = [
  'services',
  'clients',
  'operators',
  'cranes',
  'service_types',
  'invoices',
  'costs',
  'cost_categories'
] as const;

export type CacheableTable = typeof CACHEABLE_TABLES[number];

let dbInstance: IDBDatabase | null = null;

async function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[OfflineCache] Error opening database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create stores for each cacheable table
      CACHEABLE_TABLES.forEach(tableName => {
        if (!db.objectStoreNames.contains(tableName)) {
          const store = db.createObjectStore(tableName, { keyPath: 'id' });
          store.createIndex('updated_at', 'updated_at', { unique: false });
        }
      });

      // Metadata store for tracking sync times
      if (!db.objectStoreNames.contains('_metadata')) {
        db.createObjectStore('_metadata', { keyPath: 'tableName' });
      }

      // Offline actions queue
      if (!db.objectStoreNames.contains('_offlineActions')) {
        const actionsStore = db.createObjectStore('_offlineActions', { keyPath: 'id' });
        actionsStore.createIndex('timestamp', 'timestamp', { unique: false });
        actionsStore.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

/**
 * Guarda un snapshot completo de una tabla en cache
 */
export async function cacheTableData(tableName: CacheableTable, data: any[]): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([tableName, '_metadata'], 'readwrite');
    const store = transaction.objectStore(tableName);
    const metaStore = transaction.objectStore('_metadata');

    // Clear existing data
    store.clear();

    // Add new data
    data.forEach(item => {
      store.put(item);
    });

    // Update metadata
    metaStore.put({
      tableName,
      lastSync: Date.now(),
      recordCount: data.length
    });

    transaction.oncomplete = () => {
      console.log(`[OfflineCache] Cached ${data.length} items for ${tableName}`);
      resolve();
    };

    transaction.onerror = () => {
      console.error(`[OfflineCache] Error caching ${tableName}:`, transaction.error);
      reject(transaction.error);
    };
  });
}

/**
 * Obtiene datos de una tabla desde el cache
 */
export async function getCachedData<T = any>(tableName: CacheableTable): Promise<T[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(tableName, 'readonly');
    const store = transaction.objectStore(tableName);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      console.error(`[OfflineCache] Error reading ${tableName}:`, request.error);
      reject(request.error);
    };
  });
}

/**
 * Obtiene un item específico del cache
 */
export async function getCachedItem<T = any>(tableName: CacheableTable, id: string): Promise<T | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(tableName, 'readonly');
    const store = transaction.objectStore(tableName);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Actualiza un item específico en el cache
 */
export async function updateCacheItem(tableName: CacheableTable, data: any): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(tableName, 'readwrite');
    const store = transaction.objectStore(tableName);
    store.put(data);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Elimina un item del cache
 */
export async function removeCacheItem(tableName: CacheableTable, id: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(tableName, 'readwrite');
    const store = transaction.objectStore(tableName);
    store.delete(id);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Obtiene la metadata de cache de una tabla
 */
export async function getCacheMetadata(tableName: CacheableTable): Promise<CacheMetadata | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('_metadata', 'readonly');
    const store = transaction.objectStore('_metadata');
    const request = store.get(tableName);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Obtiene todas las metadata de cache
 */
export async function getAllCacheMetadata(): Promise<CacheMetadata[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('_metadata', 'readonly');
    const store = transaction.objectStore('_metadata');
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Limpia el cache de una tabla específica
 */
export async function clearTableCache(tableName: CacheableTable): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([tableName, '_metadata'], 'readwrite');
    const store = transaction.objectStore(tableName);
    const metaStore = transaction.objectStore('_metadata');

    store.clear();
    metaStore.delete(tableName);

    transaction.oncomplete = () => {
      console.log(`[OfflineCache] Cleared cache for ${tableName}`);
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}

/**
 * Limpia todo el cache
 */
export async function clearAllCache(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const storeNames = [...CACHEABLE_TABLES, '_metadata', '_offlineActions'] as const;
    const transaction = db.transaction(storeNames as unknown as string[], 'readwrite');

    storeNames.forEach(storeName => {
      if (db.objectStoreNames.contains(storeName)) {
        transaction.objectStore(storeName).clear();
      }
    });

    transaction.oncomplete = () => {
      console.log('[OfflineCache] All cache cleared');
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}

/**
 * Calcula el tamaño aproximado del cache en bytes
 */
export async function getCacheSize(): Promise<number> {
  let totalSize = 0;

  for (const tableName of CACHEABLE_TABLES) {
    try {
      const data = await getCachedData(tableName);
      totalSize += new Blob([JSON.stringify(data)]).size;
    } catch (error) {
      // Ignore errors for individual tables
    }
  }

  return totalSize;
}

/**
 * Verifica si el cache está inicializado y listo
 */
export async function isCacheReady(): Promise<boolean> {
  try {
    await openDatabase();
    return true;
  } catch {
    return false;
  }
}

// Export cacheable tables list
export { CACHEABLE_TABLES };
