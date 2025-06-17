
import { useState, useEffect, useCallback } from 'react';

interface OfflineAction {
  id: string;
  type: string;
  url: string;
  method: string;
  body?: string;
  headers?: Record<string, string>;
  timestamp: number;
  retries: number;
}

const DB_NAME = 'TMSOfflineDB';
const DB_VERSION = 1;

const STORES = {
  OFFLINE_ACTIONS: 'offlineActions',
  PENDING_INSPECTIONS: 'pendingInspections',
  PENDING_SERVICE_UPDATES: 'pendingServiceUpdates',
  CACHED_SERVICES: 'cachedServices',
  CACHED_CLIENTS: 'cachedClients'
};

export const useOfflineStorage = () => {
  const [isReady, setIsReady] = useState(false);
  const [db, setDb] = useState<IDBDatabase | null>(null);

  useEffect(() => {
    const initDB = async () => {
      return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Create object stores
          Object.values(STORES).forEach(storeName => {
            if (!db.objectStoreNames.contains(storeName)) {
              const objectStore = db.createObjectStore(storeName, { keyPath: 'id' });
              
              // Add indexes for commonly queried fields
              if (storeName === STORES.OFFLINE_ACTIONS) {
                objectStore.createIndex('timestamp', 'timestamp');
                objectStore.createIndex('type', 'type');
              }
              
              if (storeName === STORES.CACHED_SERVICES) {
                objectStore.createIndex('operator_id', 'operator_id');
                objectStore.createIndex('status', 'status');
              }
            }
          });
        };
      });
    };

    initDB()
      .then(database => {
        setDb(database);
        setIsReady(true);
      })
      .catch(error => {
        console.error('Failed to initialize IndexedDB:', error);
      });
  }, []);

  const addOfflineAction = useCallback(async (action: Omit<OfflineAction, 'id' | 'timestamp' | 'retries'>) => {
    if (!db) throw new Error('Database not ready');

    const fullAction: OfflineAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retries: 0
    };

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORES.OFFLINE_ACTIONS], 'readwrite');
      const store = transaction.objectStore(STORES.OFFLINE_ACTIONS);
      const request = store.add(fullAction);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  const getOfflineActions = useCallback(async (): Promise<OfflineAction[]> => {
    if (!db) throw new Error('Database not ready');

    return new Promise<OfflineAction[]>((resolve, reject) => {
      const transaction = db.transaction([STORES.OFFLINE_ACTIONS], 'readonly');
      const store = transaction.objectStore(STORES.OFFLINE_ACTIONS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  const removeOfflineAction = useCallback(async (id: string) => {
    if (!db) throw new Error('Database not ready');

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORES.OFFLINE_ACTIONS], 'readwrite');
      const store = transaction.objectStore(STORES.OFFLINE_ACTIONS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  const storeData = useCallback(async (storeName: string, data: any) => {
    if (!db) throw new Error('Database not ready');
    if (!Object.values(STORES).includes(storeName)) throw new Error('Invalid store name');

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  const getData = useCallback(async (storeName: string, id?: string) => {
    if (!db) throw new Error('Database not ready');
    if (!Object.values(STORES).includes(storeName)) throw new Error('Invalid store name');

    return new Promise<any>((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = id ? store.get(id) : store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  const clearStore = useCallback(async (storeName: string) => {
    if (!db) throw new Error('Database not ready');
    if (!Object.values(STORES).includes(storeName)) throw new Error('Invalid store name');

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  const clearAll = useCallback(async () => {
    if (!db) throw new Error('Database not ready');

    const promises = Object.values(STORES).map(storeName => clearStore(storeName));
    await Promise.all(promises);
  }, [db, clearStore]);

  // Cache services for offline access
  const cacheServices = useCallback(async (services: any[]) => {
    if (!db) return;

    try {
      const transaction = db.transaction([STORES.CACHED_SERVICES], 'readwrite');
      const store = transaction.objectStore(STORES.CACHED_SERVICES);
      
      // Clear existing cache
      await new Promise<void>((resolve, reject) => {
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => reject(clearRequest.error);
      });

      // Add new services
      for (const service of services) {
        await new Promise<void>((resolve, reject) => {
          const addRequest = store.add({ ...service, cached_at: Date.now() });
          addRequest.onsuccess = () => resolve();
          addRequest.onerror = () => reject(addRequest.error);
        });
      }
    } catch (error) {
      console.error('Error caching services:', error);
    }
  }, [db]);

  const getCachedServices = useCallback(async (operatorId?: string): Promise<any[]> => {
    if (!db) return [];

    try {
      return new Promise<any[]>((resolve, reject) => {
        const transaction = db.transaction([STORES.CACHED_SERVICES], 'readonly');
        const store = transaction.objectStore(STORES.CACHED_SERVICES);
        
        if (operatorId) {
          const index = store.index('operator_id');
          const request = index.getAll(operatorId);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        } else {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        }
      });
    } catch (error) {
      console.error('Error getting cached services:', error);
      return [];
    }
  }, [db]);

  return {
    isReady,
    stores: STORES,
    addOfflineAction,
    getOfflineActions,
    removeOfflineAction,
    storeData,
    getData,
    clearStore,
    clearAll,
    cacheServices,
    getCachedServices
  };
};
