/**
 * Utilidad unificada para gestión de IndexedDB
 * Garantiza un esquema consistente en toda la aplicación
 */

const DB_NAME = 'tms-offline-cache';
const DB_VERSION = 5; // Incrementado para forzar upgrade

const CACHEABLE_TABLES = [
  'services',
  'clients',
  'operators',
  'cranes',
  'service_types',
  'invoices',
  'costs',
  'cost_categories',
  'suppliers',
  'vehicle_brands',
  'vehicle_models',
  'inventory_items',
  'inventory_stock',
  'inventory_categories',
  'income_categories',
  'service_resources'
] as const;

export type CacheableTable = typeof CACHEABLE_TABLES[number];

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Abre la base de datos garantizando esquema completo
 */
export async function openOfflineDatabase(): Promise<IDBDatabase> {
  if (dbInstance && dbInstance.objectStoreNames.length > 0) {
    return dbInstance;
  }

  // Evitar múltiples aperturas simultáneas
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[OfflineDB] Error opening database:', request.error);
      dbPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('[OfflineDB] Database opened successfully, version:', dbInstance.version);
      dbPromise = null;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      console.log('[OfflineDB] Upgrading database schema...');

      // Crear stores para cada tabla cacheable
      CACHEABLE_TABLES.forEach(tableName => {
        if (!db.objectStoreNames.contains(tableName)) {
          const store = db.createObjectStore(tableName, { keyPath: 'id' });
          store.createIndex('updated_at', 'updated_at', { unique: false });
          console.log(`[OfflineDB] Created store: ${tableName}`);
        }
      });

      // Store de metadata para tracking de sincronización
      if (!db.objectStoreNames.contains('_metadata')) {
        db.createObjectStore('_metadata', { keyPath: 'tableName' });
        console.log('[OfflineDB] Created store: _metadata');
      }

      // Store de acciones offline pendientes
      if (!db.objectStoreNames.contains('_offlineActions')) {
        const actionsStore = db.createObjectStore('_offlineActions', { keyPath: 'id' });
        actionsStore.createIndex('timestamp', 'timestamp', { unique: false });
        actionsStore.createIndex('status', 'status', { unique: false });
        console.log('[OfflineDB] Created store: _offlineActions');
      }

      // Store de cache de datos (usado por useOfflineSync)
      if (!db.objectStoreNames.contains('_offlineDataCache')) {
        const cacheStore = db.createObjectStore('_offlineDataCache', { keyPath: 'key' });
        cacheStore.createIndex('table', 'table', { unique: false });
        cacheStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        console.log('[OfflineDB] Created store: _offlineDataCache');
      }

      console.log('[OfflineDB] Schema upgrade complete');
    };
  });

  return dbPromise;
}

/**
 * Cierra la conexión a la base de datos
 */
export function closeOfflineDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbPromise = null;
    console.log('[OfflineDB] Database connection closed');
  }
}

/**
 * Verifica si un store existe en la base de datos
 */
export async function hasStore(storeName: string): Promise<boolean> {
  const db = await openOfflineDatabase();
  return db.objectStoreNames.contains(storeName);
}

/**
 * Obtiene el contador de folio offline
 */
export async function getOfflineFolioCounter(): Promise<number> {
  try {
    const db = await openOfflineDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('_metadata', 'readonly');
      const store = tx.objectStore('_metadata');
      const request = store.get('offline_folio_counter');
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result?.value || 0);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[OfflineDB] Error getting folio counter:', error);
    return 0;
  }
}

/**
 * Guarda el contador de folio offline
 */
export async function saveOfflineFolioCounter(value: number): Promise<void> {
  try {
    const db = await openOfflineDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('_metadata', 'readwrite');
      const store = tx.objectStore('_metadata');
      const request = store.put({ tableName: 'offline_folio_counter', value });
      
      request.onsuccess = () => {
        console.log('[OfflineDB] Folio counter saved:', value);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[OfflineDB] Error saving folio counter:', error);
  }
}

/**
 * Limpia el contador de folio offline (después de sincronizar)
 */
export async function clearOfflineFolioCounter(): Promise<void> {
  try {
    const db = await openOfflineDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('_metadata', 'readwrite');
      const store = tx.objectStore('_metadata');
      const request = store.delete('offline_folio_counter');
      
      request.onsuccess = () => {
        console.log('[OfflineDB] Folio counter cleared');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[OfflineDB] Error clearing folio counter:', error);
  }
}

export { CACHEABLE_TABLES, DB_NAME, DB_VERSION };
