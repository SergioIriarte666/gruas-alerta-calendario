import { createLogger } from '@/lib/logger';
import type { InspectionFormValues } from '@/schemas/inspectionSchema';
import type { Service } from '@/types';

const logger = createLogger('operatorOffline');

const DB_NAME = 'TMSOfflineDB';
const DB_VERSION = 2;
const PENDING_INSPECTIONS_STORE = 'pendingInspections';
const CACHED_SERVICES_STORE = 'cachedServices';
const OFFLINE_INSPECTIONS_EVENT = 'operator-offline-inspections-changed';

const emitOfflineInspectionChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OFFLINE_INSPECTIONS_EVENT));
  }
};

export interface PendingInspectionRecord {
  id: string;
  serviceId: string;
  userId: string | null;
  queuedAt: string;
  phase: 'initial' | 'final';
  serviceSnapshot: Service;
  values: InspectionFormValues;
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
  lastError: string | null;
}

interface CachedServiceRecord {
  id: string;
  userId: string;
  cachedAt: string;
  service: Service;
}

const openDb = async (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(PENDING_INSPECTIONS_STORE)) {
        const store = db.createObjectStore(PENDING_INSPECTIONS_STORE, { keyPath: 'id' });
        store.createIndex('status', 'status');
        store.createIndex('queuedAt', 'queuedAt');
        store.createIndex('serviceId', 'serviceId');
      }

      if (!db.objectStoreNames.contains(CACHED_SERVICES_STORE)) {
        const store = db.createObjectStore(CACHED_SERVICES_STORE, { keyPath: 'id' });
        store.createIndex('userId', 'userId');
        store.createIndex('cachedAt', 'cachedAt');
      }
    };
  });

const withStore = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDb();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = action(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      logger.error(`IndexedDB transaction failed for ${storeName}`, transaction.error);
      db.close();
    };
  });
};

export const cacheOperatorServices = async (userId: string, services: Service[]): Promise<void> => {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(CACHED_SERVICES_STORE, 'readwrite');
    const store = transaction.objectStore(CACHED_SERVICES_STORE);
    const index = store.index('userId');
    const request = index.getAllKeys(userId);

    request.onsuccess = () => {
      const keys = request.result as IDBValidKey[];
      keys.forEach((key) => store.delete(key));
      services.forEach((service) => {
        const record: CachedServiceRecord = {
          id: service.id,
          userId,
          cachedAt: new Date().toISOString(),
          service,
        };
        store.put(record);
      });
    };

    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
};

export const getCachedOperatorServices = async (userId: string): Promise<Service[]> => {
  const rows = await withStore<CachedServiceRecord[]>(
    CACHED_SERVICES_STORE,
    'readonly',
    (store) => store.index('userId').getAll(userId),
  ).catch((error) => {
    logger.warn('Could not read cached operator services', error);
    return [];
  });

  return rows.map((row) => row.service);
};

export const getCachedOperatorServiceById = async (serviceId: string): Promise<Service | null> => {
  const row = await withStore<CachedServiceRecord | undefined>(
    CACHED_SERVICES_STORE,
    'readonly',
    (store) => store.get(serviceId),
  ).catch((error) => {
    logger.warn(`Could not read cached operator service ${serviceId}`, error);
    return undefined;
  });

  return row?.service || null;
};

export const updateCachedOperatorService = async (
  serviceId: string,
  patch: Partial<Service>,
): Promise<void> => {
  const existing = await withStore<CachedServiceRecord | undefined>(
    CACHED_SERVICES_STORE,
    'readonly',
    (store) => store.get(serviceId),
  ).catch(() => undefined);

  if (!existing) return;

  await withStore<CachedServiceRecord>(
    CACHED_SERVICES_STORE,
    'readwrite',
    (store) => store.put({
      ...existing,
      cachedAt: new Date().toISOString(),
      service: {
        ...existing.service,
        ...patch,
      },
    }),
  );
};

export const queuePendingInspection = async (
  record: Omit<PendingInspectionRecord, 'id' | 'queuedAt' | 'status' | 'retryCount' | 'lastError'>,
): Promise<PendingInspectionRecord> => {
  const queued: PendingInspectionRecord = {
    ...record,
    id: `${record.serviceId}:${record.phase}`,
    queuedAt: new Date().toISOString(),
    status: 'pending',
    retryCount: 0,
    lastError: null,
  };

  await withStore<PendingInspectionRecord>(
    PENDING_INSPECTIONS_STORE,
    'readwrite',
    (store) => store.put(queued),
  );
  emitOfflineInspectionChange();

  return queued;
};

export const listPendingInspections = async (): Promise<PendingInspectionRecord[]> => {
  const rows = await withStore<PendingInspectionRecord[]>(
    PENDING_INSPECTIONS_STORE,
    'readonly',
    (store) => store.getAll(),
  ).catch((error) => {
    logger.warn('Could not read pending inspections', error);
    return [];
  });

  return rows.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
};

export const getPendingInspectionByServicePhase = async (
  serviceId: string,
  phase: 'initial' | 'final',
): Promise<PendingInspectionRecord | null> => {
  const record = await withStore<PendingInspectionRecord | undefined>(
    PENDING_INSPECTIONS_STORE,
    'readonly',
    (store) => store.get(`${serviceId}:${phase}`),
  ).catch((error) => {
    logger.warn(`Could not read pending inspection ${serviceId}:${phase}`, error);
    return undefined;
  });

  return record || null;
};

export const updatePendingInspection = async (
  id: string,
  patch: Partial<PendingInspectionRecord>,
): Promise<void> => {
  const existing = await withStore<PendingInspectionRecord | undefined>(
    PENDING_INSPECTIONS_STORE,
    'readonly',
    (store) => store.get(id),
  );

  if (!existing) return;

  await withStore<PendingInspectionRecord>(
    PENDING_INSPECTIONS_STORE,
    'readwrite',
    (store) => store.put({ ...existing, ...patch }),
  );
  emitOfflineInspectionChange();
};

export const removePendingInspection = async (id: string): Promise<void> => {
  await withStore<undefined>(
    PENDING_INSPECTIONS_STORE,
    'readwrite',
    (store) => store.delete(id),
  );
  emitOfflineInspectionChange();
};

export { OFFLINE_INSPECTIONS_EVENT };
