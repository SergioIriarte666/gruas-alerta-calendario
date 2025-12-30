/**
 * Hook para sincronización offline
 * Intercepta operaciones de escritura y las guarda localmente cuando no hay conexión
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { openOfflineDatabase } from '@/services/offlineDb';

export interface OfflineAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  table: string;
  data: any;
  timestamp: number;
  retries: number;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  errorMessage?: string;
}

const STORE_NAME = '_offlineActions';
const DATA_CACHE_STORE = '_offlineDataCache';
const MAX_RETRIES = 3;

// Usar la función unificada de openDatabase
async function openDatabase(): Promise<IDBDatabase> {
  return openOfflineDatabase();
}

// Funciones para cache de datos local
export async function cacheTableData(table: string, data: any[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DATA_CACHE_STORE, 'readwrite');
    const store = transaction.objectStore(DATA_CACHE_STORE);
    
    store.put({
      key: table,
      table,
      data,
      updatedAt: Date.now()
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getCachedTableData<T>(table: string): Promise<{ data: T[] | null; updatedAt: number | null }> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DATA_CACHE_STORE, 'readonly');
    const store = transaction.objectStore(DATA_CACHE_STORE);
    const request = store.get(table);

    request.onsuccess = () => {
      if (request.result) {
        resolve({ data: request.result.data, updatedAt: request.result.updatedAt });
      } else {
        resolve({ data: null, updatedAt: null });
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function addToLocalCache(table: string, record: any): Promise<void> {
  const { data: existingData } = await getCachedTableData<any>(table);
  const updatedData = existingData ? [...existingData, record] : [record];
  await cacheTableData(table, updatedData);
}

export async function updateInLocalCache(table: string, id: string, updates: any): Promise<void> {
  const { data: existingData } = await getCachedTableData<any>(table);
  if (existingData) {
    const updatedData = existingData.map((item: any) => 
      item.id === id ? { ...item, ...updates } : item
    );
    await cacheTableData(table, updatedData);
  }
}

export async function removeFromLocalCache(table: string, id: string): Promise<void> {
  const { data: existingData } = await getCachedTableData<any>(table);
  if (existingData) {
    const updatedData = existingData.filter((item: any) => item.id !== id);
    await cacheTableData(table, updatedData);
  }
}

export function useOfflineSync() {
  const { effectiveIsOnline, isForceOffline } = useOfflineMode();
  const [isOnline, setIsOnline] = useState(effectiveIsOnline);
  const [pendingActions, setPendingActions] = useState<OfflineAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const syncInProgress = useRef(false);

  // Sincronizar con effectiveIsOnline del contexto
  useEffect(() => {
    const wasOffline = !isOnline;
    setIsOnline(effectiveIsOnline);
    
    if (wasOffline && effectiveIsOnline) {
      toast.success('Conexión restaurada', {
        description: 'Sincronizando datos pendientes...'
      });
      syncPendingActions();
    } else if (!wasOffline && !effectiveIsOnline) {
      toast.warning(isForceOffline ? 'Modo offline activado' : 'Sin conexión', {
        description: 'Los cambios se guardarán localmente'
      });
    }
  }, [effectiveIsOnline, isForceOffline]);

  // Cargar acciones pendientes al iniciar
  useEffect(() => {
    loadPendingActions();
  }, []);

  // Escuchar mensajes del Service Worker
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_STARTED') {
        setIsSyncing(true);
      } else if (event.data?.type === 'SYNC_COMPLETED') {
        setIsSyncing(false);
        setLastSyncTime(new Date());
        loadPendingActions();
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, []);

  const loadPendingActions = async () => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const actions = (request.result || []).filter(
          (a: OfflineAction) => a.status === 'pending' || a.status === 'failed'
        );
        setPendingActions(actions);
      };
    } catch (error) {
      console.error('[OfflineSync] Error loading pending actions:', error);
    }
  };

  const addOfflineAction = async (action: Omit<OfflineAction, 'id' | 'timestamp' | 'retries' | 'status'>): Promise<string> => {
    const db = await openDatabase();
    const id = `${action.table}-${action.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const fullAction: OfflineAction = {
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

      transaction.oncomplete = () => {
        loadPendingActions();
        resolve(id);
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  };

  const updateActionStatus = async (id: string, status: OfflineAction['status'], errorMessage?: string) => {
    const db = await openDatabase();

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        if (getRequest.result) {
          const updated = {
            ...getRequest.result,
            status,
            retries: getRequest.result.retries + (status === 'failed' ? 1 : 0),
            errorMessage
          };
          store.put(updated);
        }
      };

      transaction.oncomplete = () => {
        loadPendingActions();
        resolve();
      };

      transaction.onerror = () => reject(transaction.error);
    });
  };

  const removeAction = async (id: string) => {
    const db = await openDatabase();

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(id);

      transaction.oncomplete = () => {
        loadPendingActions();
        resolve();
      };

      transaction.onerror = () => reject(transaction.error);
    });
  };

  const syncPendingActions = useCallback(async () => {
    if (syncInProgress.current || !effectiveIsOnline) return;
    syncInProgress.current = true;
    setIsSyncing(true);

    try {
      const db = await openDatabase();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = async () => {
        const actions = (request.result || [])
          .filter((a: OfflineAction) => 
            (a.status === 'pending' || a.status === 'failed') && 
            a.retries < MAX_RETRIES
          )
          .sort((a: OfflineAction, b: OfflineAction) => a.timestamp - b.timestamp);

        let successCount = 0;
        let failCount = 0;

        for (const action of actions) {
          try {
            await updateActionStatus(action.id, 'processing');
            await executeAction(action);
            await removeAction(action.id);
            successCount++;
          } catch (error: any) {
            console.error(`[OfflineSync] Failed to sync action ${action.id}:`, error);
            await updateActionStatus(action.id, 'failed', error.message);
            failCount++;
          }
        }

        if (successCount > 0) {
          toast.success('Sincronización completada', {
            description: `${successCount} acciones sincronizadas correctamente`
          });
        }

        if (failCount > 0) {
          toast.error('Algunas acciones fallaron', {
            description: `${failCount} acciones no pudieron sincronizarse`
          });
        }

        setLastSyncTime(new Date());
        loadPendingActions();
      };
    } catch (error) {
      console.error('[OfflineSync] Sync error:', error);
    } finally {
      syncInProgress.current = false;
      setIsSyncing(false);
    }
  }, []);

  const executeAction = async (action: OfflineAction) => {
    const { type, table, data } = action;

    switch (type) {
      case 'CREATE':
        const { error: createError } = await supabase
          .from(table as any)
          .insert(data);
        if (createError) throw createError;
        break;

      case 'UPDATE':
        const { id: updateId, ...updateData } = data;
        const { error: updateError } = await supabase
          .from(table as any)
          .update(updateData)
          .eq('id', updateId);
        if (updateError) throw updateError;
        break;

      case 'DELETE':
        const { error: deleteError } = await supabase
          .from(table as any)
          .delete()
          .eq('id', data.id);
        if (deleteError) throw deleteError;
        break;
    }
  };

  /**
   * Wrapper para operaciones de Supabase que funciona offline
   */
  const executeWithOfflineSupport = async <T>(
    operation: () => Promise<{ data: T | null; error: any }>,
    offlineAction: Omit<OfflineAction, 'id' | 'timestamp' | 'retries' | 'status'>
  ): Promise<{ data: T | null; error: any; isOffline: boolean }> => {
    if (effectiveIsOnline) {
      try {
        const result = await operation();
        return { ...result, isOffline: false };
      } catch (error: any) {
        // Si falla por red, guardar offline
        if (error.message?.includes('network') || error.message?.includes('fetch')) {
          const actionId = await addOfflineAction(offlineAction);
          return { 
            data: { ...offlineAction.data, _offlineId: actionId } as any, 
            error: null, 
            isOffline: true 
          };
        }
        throw error;
      }
    }

    // Si no hay conexión, guardar localmente
    const actionId = await addOfflineAction(offlineAction);
    return { 
      data: { ...offlineAction.data, _offlineId: actionId } as any, 
      error: null, 
      isOffline: true 
    };
  };

  const clearAllPendingActions = async () => {
    const db = await openDatabase();

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();

      transaction.oncomplete = () => {
        loadPendingActions();
        resolve();
      };

      transaction.onerror = () => reject(transaction.error);
    });
  };

  return {
    isOnline,
    isSyncing,
    pendingActions,
    lastSyncTime,
    addOfflineAction,
    syncPendingActions,
    executeWithOfflineSupport,
    clearAllPendingActions,
    pendingCount: pendingActions.length
  };
}
