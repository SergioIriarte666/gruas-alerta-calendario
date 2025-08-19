import { useEffect } from 'react';
import { useUnifiedRealtimeManager } from './useUnifiedRealtimeManager';

/**
 * LEGACY HOOK - AHORA USA EL SISTEMA UNIFICADO
 * 
 * Este hook mantiene la compatibilidad pero delega toda
 * la funcionalidad al nuevo sistema unificado de realtime.
 */
export const useRealtimeSync = () => {
  const { getStatus } = useUnifiedRealtimeManager();

  useEffect(() => {
    console.log('📡 [LEGACY_REALTIME] Usando sistema unificado de realtime');
    console.log('📊 [LEGACY_REALTIME] Estado del sistema:', getStatus());
  }, [getStatus]);
};