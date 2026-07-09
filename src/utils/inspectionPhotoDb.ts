import { createLogger } from '@/lib/logger';

const logger = createLogger('InspectionPhotoDb');

const DB_NAME = 'InspectionPhotosDB';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

interface StoredPhotoRow {
  fileName: string;
  blob: Blob;
}

const openDb = async (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'fileName' });
      }
    };
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDb();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = action(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      logger.error(`Transacción de IndexedDB fallida en ${STORE_NAME}`, transaction.error);
      db.close();
    };
  });
};

/**
 * Guarda el blob comprimido de una foto en IndexedDB. Nunca usar localStorage para esto:
 * localStorage es síncrono y de capacidad muy limitada; con varias fotos de inspección
 * ya causó crashes por presión de memoria en WKWebView (iOS).
 */
export const saveInspectionPhotoBlob = async (fileName: string, blob: Blob): Promise<void> => {
  await withStore<IDBValidKey>('readwrite', (store) => store.put({ fileName, blob } satisfies StoredPhotoRow));
};

export const loadInspectionPhotoBlob = async (fileName: string): Promise<Blob | null> => {
  const row = await withStore<StoredPhotoRow | undefined>(
    'readonly',
    (store) => store.get(fileName),
  ).catch((error) => {
    logger.warn(`No se pudo leer la foto ${fileName} de IndexedDB`, error);
    return undefined;
  });

  return row?.blob ?? null;
};

export const removeInspectionPhotoBlob = async (fileName: string): Promise<void> => {
  await withStore<undefined>('readwrite', (store) => store.delete(fileName));
};
