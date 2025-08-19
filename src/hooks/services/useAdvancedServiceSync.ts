import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { useQueryClient } from '@tanstack/react-query';

const logger = createLogger('AdvancedServiceSync');

/**
 * FASE 2: SINCRONIZACIÓN AUTOMÁTICA REFORZADA
 * 
 * Hook avanzado que garantiza sincronización robusta entre:
 * - services table (campos legacy: operator_id, operator_commission)
 * - service_resources table (operadores múltiples)
 * - costs table (comisiones)
 * 
 * Incluye:
 * ✅ Sincronización de campos legacy automática
 * ✅ Verificación de consistencia en tiempo real
 * ✅ Reparación automática de inconsistencias
 * ✅ Logging detallado para auditoría
 */
export const useAdvancedServiceSync = () => {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState<string>('idle');
  const queryClient = useQueryClient();

  /**
   * SINCRONIZACIÓN ROBUSTA DE COMISIONES
   * Extiende la funcionalidad básica con campos legacy
   */
  const syncCommissionsRobust = useCallback(async (
    serviceId: string, 
    serviceData: any, 
    operators: any[]
  ): Promise<{ success: boolean; details: any }> => {
    setSyncing(true);
    logger.info('🔧 [ROBUST_SYNC] Iniciando sincronización robusta', { serviceId, operators: operators.length });

    try {
      const commissionCategoryId = '440296d4-09c2-4f3a-b02b-835f861df4c4';
      
      // PASO 1: Verificar si hay comisiones que sincronizar
      const hasCommissions = operators?.some(op => op.commission > 0) || serviceData.operatorCommission > 0;
      
      if (!hasCommissions) {
        logger.info('🚫 [ROBUST_SYNC] No hay comisiones - sync no requerido');
        setLastSyncStatus('no_commissions');
        return { success: true, details: { reason: 'no_commissions', operators: 0 } };
      }

      // PASO 2: Sincronizar campos legacy en services table
      const primaryOperator = operators.find(op => op.role === 'Principal') || operators[0];
      const legacyUpdate = {
        operator_id: primaryOperator?.operatorId || null,
        operator_commission: primaryOperator?.commission || 0,
        updated_at: new Date().toISOString()
      };

      const { error: legacyError } = await supabase
        .from('services')
        .update(legacyUpdate)
        .eq('id', serviceId);

      if (legacyError) {
        logger.error('❌ [ROBUST_SYNC] Error actualizando campos legacy:', legacyError);
        throw legacyError;
      }

      logger.info('✅ [ROBUST_SYNC] Campos legacy actualizados', legacyUpdate);

      // PASO 3: Limpiar comisiones existentes para evitar duplicados
      const { error: deleteError } = await supabase
        .from('costs')
        .delete()
        .match({ 
          service_id: serviceId, 
          category_id: commissionCategoryId 
        });

      if (deleteError) {
        logger.error('❌ [ROBUST_SYNC] Error limpiando comisiones existentes:', deleteError);
        throw deleteError;
      }

      // PASO 4: Crear nuevas comisiones desde service_resources
      const { data: serviceResources, error: resourcesError } = await supabase
        .from('service_resources')
        .select('operator_id, commission_amount, is_primary')
        .eq('service_id', serviceId)
        .eq('resource_type', 'operator')
        .gt('commission_amount', 0);

      if (resourcesError) {
        logger.error('❌ [ROBUST_SYNC] Error obteniendo service_resources:', resourcesError);
        throw resourcesError;
      }

      if (serviceResources && serviceResources.length > 0) {
        const commissionsToCreate = serviceResources.map(resource => ({
          service_id: serviceId,
          category_id: commissionCategoryId,
          operator_id: resource.operator_id,
          description: `Comisión operador ${resource.is_primary ? '(Principal)' : '(Auxiliar)'} - Servicio ${serviceData.folio}`,
          amount: resource.commission_amount,
          date: serviceData.serviceDate || serviceData.service_date,
          subcategory: 'comisiones',
          service_folio: serviceData.folio,
          crane_id: serviceData.craneId || serviceData.crane_id
        }));

        const { error: insertError } = await supabase
          .from('costs')
          .insert(commissionsToCreate);

        if (insertError) {
          logger.error('❌ [ROBUST_SYNC] Error creando comisiones:', insertError);
          throw insertError;
        }

        logger.info(`✅ [ROBUST_SYNC] ${commissionsToCreate.length} comisiones creadas desde service_resources`);
      }

      // PASO 5: Verificar consistencia final
      const consistencyCheck = await verifyConsistency(serviceId);
      
      setLastSyncStatus('success');
      logger.info('✅ [ROBUST_SYNC] Sincronización robusta completada', { 
        serviceId, 
        commissionsCreated: serviceResources?.length || 0,
        consistencyStatus: consistencyCheck.consistent 
      });

      return { 
        success: true, 
        details: { 
          commissionsCreated: serviceResources?.length || 0,
          legacyFieldsUpdated: true,
          consistencyVerified: consistencyCheck.consistent
        }
      };

    } catch (error) {
      logger.error('❌ [ROBUST_SYNC] Error en sincronización robusta:', error);
      setLastSyncStatus('error');
      throw error;
    } finally {
      setSyncing(false);
    }
  }, []);

  /**
   * VERIFICACIÓN AUTOMÁTICA DE CONSISTENCIA
   * Detecta inconsistencias entre las tres tablas principales
   */
  const verifyConsistency = useCallback(async (serviceId: string): Promise<{
    consistent: boolean;
    issues: string[];
    details: any;
  }> => {
    logger.info('🔍 [CONSISTENCY_CHECK] Verificando consistencia', { serviceId });

    try {
      // Obtener datos del servicio
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('operator_id, operator_commission, folio')
        .eq('id', serviceId)
        .single();

      if (serviceError) throw serviceError;

      // Obtener service_resources
      const { data: resources, error: resourcesError } = await supabase
        .from('service_resources')
        .select('operator_id, commission_amount, is_primary')
        .eq('service_id', serviceId)
        .eq('resource_type', 'operator');

      if (resourcesError) throw resourcesError;

      // Obtener costs (comisiones)
      const { data: costs, error: costsError } = await supabase
        .from('costs')
        .select('operator_id, amount')
        .eq('service_id', serviceId)
        .eq('category_id', '440296d4-09c2-4f3a-b02b-835f861df4c4');

      if (costsError) throw costsError;

      const issues: string[] = [];

      // VERIFICACIÓN 1: Campos legacy vs service_resources
      const primaryResource = resources?.find(r => r.is_primary);
      if (primaryResource) {
        if (service.operator_id !== primaryResource.operator_id) {
          issues.push('services.operator_id no coincide con service_resources principal');
        }
        if (service.operator_commission !== primaryResource.commission_amount) {
          issues.push('services.operator_commission no coincide con service_resources principal');
        }
      }

      // VERIFICACIÓN 2: service_resources vs costs
      const resourcesWithCommissions = resources?.filter(r => r.commission_amount > 0) || [];
      const costsOperators = costs?.map(c => c.operator_id) || [];
      
      for (const resource of resourcesWithCommissions) {
        if (!costsOperators.includes(resource.operator_id)) {
          issues.push(`Operador ${resource.operator_id} tiene comisión en service_resources pero no en costs`);
        }
      }

      // VERIFICACIÓN 3: costs vs service_resources
      for (const cost of costs || []) {
        const matchingResource = resourcesWithCommissions.find(r => r.operator_id === cost.operator_id);
        if (!matchingResource) {
          issues.push(`Operador ${cost.operator_id} tiene comisión en costs pero no en service_resources`);
        } else if (matchingResource.commission_amount !== cost.amount) {
          issues.push(`Monto de comisión no coincide para operador ${cost.operator_id}`);
        }
      }

      const consistent = issues.length === 0;
      
      logger.info(`🔍 [CONSISTENCY_CHECK] Verificación completada`, { 
        consistent, 
        issuesFound: issues.length,
        serviceId 
      });

      return {
        consistent,
        issues,
        details: {
          service: service,
          resourcesCount: resources?.length || 0,
          costsCount: costs?.length || 0,
          resourcesWithCommissions: resourcesWithCommissions.length
        }
      };

    } catch (error) {
      logger.error('❌ [CONSISTENCY_CHECK] Error en verificación:', error);
      return {
        consistent: false,
        issues: ['Error al verificar consistencia: ' + (error as Error).message],
        details: {}
      };
    }
  }, []);

  /**
   * REPARACIÓN AUTOMÁTICA DE INCONSISTENCIAS
   * Detecta y repara automáticamente datos inconsistentes
   */
  const autoRepair = useCallback(async (serviceId: string): Promise<{
    repaired: boolean;
    actions: string[];
  }> => {
    logger.info('🔧 [AUTO_REPAIR] Iniciando reparación automática', { serviceId });

    try {
      const consistencyCheck = await verifyConsistency(serviceId);
      
      if (consistencyCheck.consistent) {
        logger.info('✅ [AUTO_REPAIR] No se requiere reparación - datos consistentes');
        return { repaired: false, actions: ['No se requiere reparación'] };
      }

      const actions: string[] = [];

      // Obtener datos actuales
      const { data: service } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .single();

      const { data: resources } = await supabase
        .from('service_resources')
        .select('*')
        .eq('service_id', serviceId)
        .eq('resource_type', 'operator');

      if (service && resources) {
        // Realizar sincronización robusta completa
        await syncCommissionsRobust(serviceId, service, resources.map(r => ({
          operatorId: r.operator_id,
          commission: r.commission_amount,
          role: r.is_primary ? 'Principal' : 'Auxiliar'
        })));

        actions.push('Sincronización robusta ejecutada');
        actions.push('Campos legacy actualizados');
        actions.push('Comisiones resincronizadas');

        // Invalidar queries para refrescar UI
        queryClient.invalidateQueries({ queryKey: ['services'] });
        queryClient.invalidateQueries({ queryKey: ['service-costs', serviceId] });
        queryClient.invalidateQueries({ queryKey: ['costs'] });
      }

      logger.info('✅ [AUTO_REPAIR] Reparación automática completada', { actions });
      return { repaired: true, actions };

    } catch (error) {
      logger.error('❌ [AUTO_REPAIR] Error en reparación automática:', error);
      return { 
        repaired: false, 
        actions: ['Error en reparación: ' + (error as Error).message] 
      };
    }
  }, [syncCommissionsRobust, verifyConsistency, queryClient]);

  return {
    syncCommissionsRobust,
    verifyConsistency,
    autoRepair,
    syncing,
    lastSyncStatus
  };
};