/**
 * Offline Data Cache Service
 * Mantiene un "espejo" local de los datos de Supabase en IndexedDB
 */

import { openOfflineDatabase, CACHEABLE_TABLES, CacheableTable as BaseCacheableTable } from './offlineDb';

export interface CacheMetadata {
  tableName: string;
  lastSync: number;
  recordCount: number;
}

export type CacheableTable = BaseCacheableTable;

// Usar la función unificada de apertura de DB
async function openDatabase(): Promise<IDBDatabase> {
  return openOfflineDatabase();
}

export { CACHEABLE_TABLES };

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

  return new Promise(async (resolve, reject) => {
    try {
      // Obtener metadata de tablas normales
      const transaction = db.transaction('_metadata', 'readonly');
      const store = transaction.objectStore('_metadata');
      const request = store.getAll();

      request.onsuccess = async () => {
        const normalMetadata = request.result || [];
        
        // También obtener metadata del cache del hook useOfflineSync
        try {
          if (db.objectStoreNames.contains('_offlineDataCache')) {
            const cacheTransaction = db.transaction('_offlineDataCache', 'readonly');
            const cacheStore = cacheTransaction.objectStore('_offlineDataCache');
            const cacheRequest = cacheStore.getAll();
            
            cacheRequest.onsuccess = () => {
              const hookCacheData = cacheRequest.result || [];
              const hookMetadata = hookCacheData.map((item: any) => ({
                tableName: `${item.table} (offline)`,
                lastSync: item.updatedAt || Date.now(),
                recordCount: Array.isArray(item.data) ? item.data.length : 0
              }));
              
              resolve([...normalMetadata, ...hookMetadata]);
            };
            
            cacheRequest.onerror = () => {
              resolve(normalMetadata);
            };
          } else {
            resolve(normalMetadata);
          }
        } catch {
          resolve(normalMetadata);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    } catch (error) {
      reject(error);
    }
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
    const storeNames = [...CACHEABLE_TABLES, '_metadata', '_offlineActions', '_offlineDataCache'] as const;
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

// CACHEABLE_TABLES ya se exporta al inicio del archivo desde offlineDb
