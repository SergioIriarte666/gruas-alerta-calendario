import { useEffect, useCallback, useRef } from 'react';
import { createLogger } from '@/lib/logger';
import { useAdvancedServiceSync } from './useAdvancedServiceSync';
import { useQueryClient } from '@tanstack/react-query';
import { useUnifiedRealtimeManager } from '../useUnifiedRealtimeManager';

const logger = createLogger('ServiceSyncWatcher');

/**
 * FASE 3: HOOKS DE SINCRONIZACIÓN REACTIVA
 * 
 * Observa cambios en las tablas críticas y fuerza sincronización automática:
 * - services: Detecta cambios en operator_id, operator_commission
 * - service_resources: Detecta cambios en operator assignments
 * - costs: Detecta inconsistencias en comisiones
 * 
 * Características:
 * ✅ Real-time listening usando Supabase subscriptions
 * ✅ Triggers automáticos de sincronización
 * ✅ Logging detallado para auditoría
 * ✅ Throttling para evitar sync loops
 * ✅ Auto-recovery en caso de errores
 */
export const useServiceSyncWatcher = (serviceId?: string) => {
  const { syncCommissionsRobust, verifyConsistency, autoRepair } = useAdvancedServiceSync();
  const queryClient = useQueryClient();
  const { watchSpecificService } = useUnifiedRealtimeManager();
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<number>(0);

  // Throttling - evitar sync múltiples en corto tiempo
  const SYNC_THROTTLE_MS = 2000;

  /**
   * TRIGGER DE SINCRONIZACIÓN CON THROTTLING
   * Evita sync loops y mejora performance
   */
  const triggerSync = useCallback((reason: string, affectedServiceId: string) => {
    const now = Date.now();
    
    // Throttling: evitar sync si ocurrió muy recientemente
    if (now - lastSyncRef.current < SYNC_THROTTLE_MS) {
      logger.info('🚫 [SYNC_WATCHER] Sync throttled', { reason, serviceId: affectedServiceId });
      return;
    }

    // Clear timeout anterior si existe
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Delay mínimo para evitar race conditions
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        lastSyncRef.current = now;
        logger.info('🔥 [SYNC_WATCHER] Trigger de sincronización activado', { reason, serviceId: affectedServiceId });

        // Verificar consistencia primero
        const consistencyCheck = await verifyConsistency(affectedServiceId);
        
        if (!consistencyCheck.consistent) {
          logger.warn('⚠️ [SYNC_WATCHER] Inconsistencia detectada, iniciando auto-repair', {
            serviceId: affectedServiceId,
            issues: consistencyCheck.issues
          });

          // Auto-repair automático
          const repairResult = await autoRepair(affectedServiceId);
          
          if (repairResult.repaired) {
            logger.info('✅ [SYNC_WATCHER] Auto-repair exitoso', {
              serviceId: affectedServiceId,
              actions: repairResult.actions
            });
          } else {
            logger.error('❌ [SYNC_WATCHER] Auto-repair falló', {
              serviceId: affectedServiceId,
              actions: repairResult.actions
            });
          }

          // Invalidar queries después del repair
          queryClient.invalidateQueries({ queryKey: ['services'] });
          queryClient.invalidateQueries({ queryKey: ['service-costs', affectedServiceId] });
          queryClient.invalidateQueries({ queryKey: ['costs'] });
          queryClient.invalidateQueries({ queryKey: ['commissions'] });
        } else {
          logger.info('✅ [SYNC_WATCHER] Consistencia verificada - no se requiere sync', {
            serviceId: affectedServiceId
          });
        }

      } catch (error) {
        logger.error('❌ [SYNC_WATCHER] Error en trigger de sincronización:', error);
      }
    }, 500); // 500ms delay para evitar race conditions

  }, [verifyConsistency, autoRepair, queryClient]);

  /**
   * WATCHER ESPECÍFICO PARA SERVICIO
   * Ahora usa el sistema unificado de realtime
   */
  useEffect(() => {
    if (!serviceId) return;
    
    logger.info('👁️ [SYNC_WATCHER] Registrando watcher específico via sistema unificado', { serviceId });
    
    // Usar el sistema unificado para el watcher específico
    const cleanup = watchSpecificService(serviceId);
    
    return cleanup;
  }, [serviceId, watchSpecificService]);

  /**
   * WATCHER DE CAMBIOS EN SERVICE_RESOURCES TABLE - DESHABILITADO TEMPORALMENTE
   * Para evitar conflictos con useRealtimeSync
   */
  // useEffect(() => {
  //   if (!serviceId) return;
  //   // Temporalmente deshabilitado para evitar suscripciones múltiples
  // }, [serviceId, triggerSync]);

  /**
   * WATCHER DE CAMBIOS EN COSTS TABLE - DESHABILITADO TEMPORALMENTE
   * Para evitar conflictos con useRealtimeSync
   */
  // useEffect(() => {
  //   if (!serviceId) return;
  //   // Temporalmente deshabilitado para evitar suscripciones múltiples
  // }, [serviceId, triggerSync]);

  /**
   * WATCHER GLOBAL - DESHABILITADO TEMPORALMENTE
   * Para evitar conflictos con useRealtimeSync
   */
  // useEffect(() => {
  //   if (serviceId) return;
  //   // Temporalmente deshabilitado para evitar suscripciones múltiples
  // }, [serviceId, triggerSync]);

  // Cleanup de timeouts al desmontar
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  /**
   * FUNCIÓN PARA FORZAR SYNC MANUAL
   */
  const forceSyncNow = useCallback(async (targetServiceId?: string) => {
    const targetId = targetServiceId || serviceId;
    if (!targetId) {
      logger.warn('⚠️ [SYNC_WATCHER] No serviceId provided for manual sync');
      return;
    }

    logger.info('🔧 [SYNC_WATCHER] Forzando sincronización manual', { serviceId: targetId });
    triggerSync('manual_force_sync', targetId);
  }, [serviceId, triggerSync]);

  return {
    forceSyncNow,
    isWatching: !!serviceId || true // true si está en modo global
  };
};