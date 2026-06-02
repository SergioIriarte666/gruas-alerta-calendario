import { useEffect } from 'react';
import { useUnifiedRealtimeManager } from './useUnifiedRealtimeManager';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useRealtimeSync");
/**
 * LEGACY HOOK - AHORA USA EL SISTEMA UNIFICADO
 * 
 * Este hook mantiene la compatibilidad pero delega toda
 * la funcionalidad al nuevo sistema unificado de realtime.
 */
export const useRealtimeSync = () => {
  const { getStatus } = useUnifiedRealtimeManager();

  useEffect(() => {
    logger.debug('📡 [LEGACY_REALTIME] Usando sistema unificado de realtime');
    logger.debug('📊 [LEGACY_REALTIME] Estado del sistema:', getStatus());
  }, [getStatus]);
};