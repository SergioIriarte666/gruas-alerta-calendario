/**
 * Servicio centralizado de operaciones offline
 * Wrapper para CRUD que funciona online y offline
 */

import { supabase } from '@/integrations/supabase/client';
import { 
  cacheTableData, 
  getCachedTableData, 
  addToLocalCache, 
  updateInLocalCache, 
  removeFromLocalCache 
} from '@/hooks/useOfflineSync';
import { toast } from 'sonner';

export type OfflineOperationType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface OfflineOperationConfig {
  table: string;
  operation: OfflineOperationType;
  data: any;
  isOnline: boolean;
  optimisticId?: string; // Para updates/deletes
}

export interface OfflineOperationResult<T> {
  data: T | null;
  error: any;
  isOffline: boolean;
  tempId?: string;
}

// Genera un ID temporal para registros creados offline
export function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Verifica si un ID es temporal
export function isTempId(id: string): boolean {
  return id?.startsWith('temp_');
}

// Marca un registro como offline
export function markAsOffline<T extends object>(record: T): T & { _isOffline: boolean } {
  return { ...record, _isOffline: true };
}

import { openOfflineDatabase } from '@/services/offlineDb';

const STORE_NAME = '_offlineActions';

async function openDatabase(): Promise<IDBDatabase> {
  return openOfflineDatabase();
}

async function addOfflineAction(action: {
  type: OfflineOperationType;
  table: string;
  data: any;
}): Promise<string> {
  const db = await openDatabase();
  const id = `${action.table}-${action.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const fullAction = {
    ...action,
    id,
    timestamp: Date.now(),
    retries: 0,
    status: 'pending'
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(fullAction);

    transaction.oncomplete = () => resolve(id);
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Ejecuta operación CREATE con soporte offline
 */
export async function offlineCreate<T extends { id?: string }>(
  table: string,
  data: Omit<T, 'id'>,
  isOnline: boolean,
  transformToDb?: (data: any) => any,
  transformFromDb?: (data: any) => T
): Promise<OfflineOperationResult<T>> {
  const dbData = transformToDb ? transformToDb(data) : data;

  if (isOnline) {
    try {
      const { data: result, error } = await supabase
        .from(table as any)
        .insert(dbData)
        .select()
        .single();

      if (error) throw error;

      const transformed = transformFromDb ? transformFromDb(result) : result as unknown as T;
      
      // Actualizar cache local
      await addToLocalCache(table, transformed);
      
      return { data: transformed, error: null, isOffline: false };
    } catch (error: any) {
      // Si falla por red, guardar offline
      if (error.message?.includes('network') || error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
        console.log(`[OfflineOps] Network error, saving ${table} offline`);
      } else {
        throw error;
      }
    }
  }

  // Guardar offline
  const tempId = generateTempId();
  const offlineRecord = markAsOffline({ ...data, id: tempId } as T);
  
  await addOfflineAction({
    type: 'CREATE',
    table,
    data: { ...dbData, id: tempId, _tempId: tempId }
  });

  await addToLocalCache(table, offlineRecord);

  toast.info('Guardado localmente', {
    description: 'Se sincronizará cuando haya conexión'
  });

  return { data: offlineRecord, error: null, isOffline: true, tempId };
}

/**
 * Ejecuta operación UPDATE con soporte offline
 */
export async function offlineUpdate<T extends { id: string }>(
  table: string,
  id: string,
  data: Partial<T>,
  isOnline: boolean,
  transformToDb?: (data: any) => any,
  transformFromDb?: (data: any) => T
): Promise<OfflineOperationResult<T>> {
  const dbData = transformToDb ? transformToDb(data) : data;

  if (isOnline && !isTempId(id)) {
    try {
      const { data: result, error } = await supabase
        .from(table as any)
        .update(dbData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const transformed = transformFromDb ? transformFromDb(result) : result as unknown as T;
      
      // Actualizar cache local
      await updateInLocalCache(table, id, transformed);
      
      return { data: transformed, error: null, isOffline: false };
    } catch (error: any) {
      if (error.message?.includes('network') || error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
        console.log(`[OfflineOps] Network error, saving update to ${table} offline`);
      } else {
        throw error;
      }
    }
  }

  // Guardar offline
  await addOfflineAction({
    type: 'UPDATE',
    table,
    data: { id, ...dbData }
  });

  await updateInLocalCache(table, id, markAsOffline(data as T));

  toast.info('Cambios guardados localmente', {
    description: 'Se sincronizarán cuando haya conexión'
  });

  return { data: { id, ...data } as T, error: null, isOffline: true };
}

/**
 * Ejecuta operación DELETE con soporte offline
 */
export async function offlineDelete(
  table: string,
  id: string,
  isOnline: boolean
): Promise<OfflineOperationResult<void>> {
  // Si es un ID temporal, solo eliminar del cache local
  if (isTempId(id)) {
    await removeFromLocalCache(table, id);
    // También eliminar la acción pendiente de CREATE
    // TODO: Implementar eliminación de acción pendiente
    return { data: null, error: null, isOffline: false };
  }

  if (isOnline) {
    try {
      const { error } = await supabase
        .from(table as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      await removeFromLocalCache(table, id);
      
      return { data: null, error: null, isOffline: false };
    } catch (error: any) {
      if (error.message?.includes('network') || error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
        console.log(`[OfflineOps] Network error, saving delete to ${table} offline`);
      } else {
        throw error;
      }
    }
  }

  // Guardar offline
  await addOfflineAction({
    type: 'DELETE',
    table,
    data: { id }
  });

  await removeFromLocalCache(table, id);

  toast.info('Eliminación guardada localmente', {
    description: 'Se sincronizará cuando haya conexión'
  });

  return { data: null, error: null, isOffline: true };
}

/**
 * Obtiene datos de una tabla con soporte offline
 */
export async function offlineFetch<T>(
  table: string,
  isOnline: boolean,
  fetchFn: () => Promise<T[]>,
  transform?: (data: any[]) => T[]
): Promise<{ data: T[]; isFromCache: boolean }> {
  if (isOnline) {
    try {
      const data = await fetchFn();
      const transformed = transform ? transform(data) : data;
      
      // Guardar en cache
      await cacheTableData(table, transformed);
      
      return { data: transformed, isFromCache: false };
    } catch (error: any) {
      console.warn(`[OfflineOps] Error fetching ${table}, trying cache:`, error.message);
    }
  }

  // Leer del cache
  const { data: cachedData } = await getCachedTableData<T>(table);
  
  if (cachedData && cachedData.length > 0) {
    // APLICAR TRANSFORM también al leer del cache para normalizar formato
    const transformed = transform ? transform(cachedData) : cachedData;
    console.log(`[OfflineOps] Using cached data for ${table}: ${transformed.length} records (transformed)`);
    return { data: transformed, isFromCache: true };
  }

  return { data: [], isFromCache: true };
}

/**
 * Actualiza el cache local con datos frescos
 */
export async function refreshLocalCache<T>(table: string, data: T[]): Promise<void> {
  await cacheTableData(table, data);
  console.log(`[OfflineOps] Cache refreshed for ${table}: ${data.length} records`);
}
