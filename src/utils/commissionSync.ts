import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('CommissionSync');

// Operadores excluidos de comisiones según reglas de negocio
const EXCLUDED_OPERATOR_NAMES = ['Jorge Iriarte', 'Sergio Iriarte', 'Jorge Ignacio Iriarte'];

/**
 * Valida si un operador está excluido de comisiones
 */
const isOperatorExcluded = (operatorName: string | null | undefined): boolean => {
  if (!operatorName) return false;
  return EXCLUDED_OPERATOR_NAMES.some(excluded => 
    operatorName.toLowerCase().includes(excluded.toLowerCase())
  );
};

/**
 * Utility to synchronize commissions from service_resources to costs table
 * IMPORTANTE: Solo sincroniza si el servicio tiene operator_commission > 0
 * y el operador no está excluido
 */
export const syncCommissionsForService = async (serviceId: string): Promise<{ success: boolean; message: string }> => {
  try {
    logger.info('🔄 [SYNC_SINGLE] Starting commission sync for service:', serviceId);
    
    const commissionCategoryId = '440296d4-09c2-4f3a-b02b-835f861df4c4';
    
    // PRIMERO: Verificar que el servicio tiene operator_commission > 0
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('folio, service_date, crane_id, operator_commission')
      .eq('id', serviceId)
      .single();

    if (serviceError) {
      logger.error('❌ [SYNC_SINGLE] Error fetching service:', serviceError);
      return { success: false, message: `Error al obtener servicio: ${serviceError.message}` };
    }

    // Si el servicio no tiene comisión configurada, no hay nada que sincronizar
    if (!service.operator_commission || service.operator_commission <= 0) {
      logger.info('ℹ️ [SYNC_SINGLE] Service has no commission configured (operator_commission = 0)');
      return { success: true, message: 'El servicio no tiene comisión configurada' };
    }

    // Get service_resources with commissions, excluding exempt operators
    const { data: serviceResources, error: resourcesError } = await supabase
      .from('service_resources')
      .select(`
        id,
        operator_id,
        commission_amount,
        operators(id, name, rut, commission_exempt)
      `)
      .eq('service_id', serviceId)
      .eq('resource_type', 'operator')
      .gt('commission_amount', 0);

    if (resourcesError) {
      logger.error('❌ [SYNC_SINGLE] Error fetching service_resources:', resourcesError);
      return { success: false, message: `Error al obtener recursos: ${resourcesError.message}` };
    }

    // Filter out commission-exempt operators
    const validResources = serviceResources?.filter(r => 
      !(r.operators as any)?.commission_exempt
    ) || [];

    if (validResources.length === 0) {
      logger.info('ℹ️ [SYNC_SINGLE] No valid commissions found (all operators excluded or no commissions)');
      return { success: true, message: 'No hay comisiones válidas para sincronizar' };
    }

    // Delete existing commission costs
    const { error: deleteError } = await supabase
      .from('costs')
      .delete()
      .eq('service_id', serviceId)
      .eq('category_id', commissionCategoryId);

    if (deleteError) {
      logger.error('❌ [SYNC_SINGLE] Error deleting existing commissions:', deleteError);
      return { success: false, message: `Error al eliminar comisiones existentes: ${deleteError.message}` };
    }

    // Create new commission costs only for valid (non-excluded) operators
    const commissionCosts = validResources.map(resource => ({
      amount: resource.commission_amount,
      category_id: commissionCategoryId,
      service_id: serviceId,
      operator_id: resource.operator_id,
      service_folio: service.folio,
      date: service.service_date,
      description: `Comisión ${resource.operators?.name || 'Operador'}`,
      subcategory: 'comisiones',
      notes: 'Comisión sincronizada automáticamente',
      crane_id: service.crane_id,
      created_by: null
    }));

    const { data: insertedCosts, error: insertError } = await supabase
      .from('costs')
      .insert(commissionCosts)
      .select('id, amount, operator_id');

    if (insertError) {
      logger.error('❌ [SYNC_SINGLE] Error inserting commissions:', insertError);
      return { success: false, message: `Error al crear comisiones: ${insertError.message}` };
    }

    logger.info('✅ [SYNC_SINGLE] Commission sync completed successfully:', {
      serviceId,
      commissionsCreated: insertedCosts?.length || 0,
      totalAmount: commissionCosts.reduce((sum, c) => sum + c.amount, 0)
    });

    return { 
      success: true, 
      message: `Sincronizadas ${insertedCosts?.length || 0} comisiones exitosamente` 
    };

  } catch (error) {
    logger.error('💥 [SYNC_SINGLE] Critical error:', error);
    return { success: false, message: `Error crítico: ${error}` };
  }
};

/**
 * Bulk synchronization for all services that have commissions in service_resources but not in costs
 */
export const bulkSyncAllCommissions = async (): Promise<{ success: boolean; message: string; details: any }> => {
  try {
    logger.info('🔄 [BULK_SYNC] Starting bulk commission synchronization');
    
    const commissionCategoryId = '440296d4-09c2-4f3a-b02b-835f861df4c4';
    
    // Find services with service_resources that have commissions but no corresponding costs
    const { data: servicesWithMissingCommissions, error: queryError } = await supabase
      .from('service_resources')
      .select(`
        service_id,
        services!inner(folio, service_date, crane_id)
      `)
      .eq('resource_type', 'operator')
      .gt('commission_amount', 0);

    if (queryError) {
      logger.error('❌ [BULK_SYNC] Error querying services:', queryError);
      return { success: false, message: `Error en consulta: ${queryError.message}`, details: null };
    }

    if (!servicesWithMissingCommissions || servicesWithMissingCommissions.length === 0) {
      logger.info('ℹ️ [BULK_SYNC] No services with commissions found');
      return { success: true, message: 'No hay servicios para sincronizar', details: { processed: 0 } };
    }

    // Get unique service IDs
    const uniqueServiceIds = [...new Set(servicesWithMissingCommissions.map(s => s.service_id))];
    
    logger.info('📋 [BULK_SYNC] Found services to process:', {
      totalServices: uniqueServiceIds.length,
      serviceIds: uniqueServiceIds
    });

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process each service
    for (const serviceId of uniqueServiceIds) {
      results.processed++;
      
      const result = await syncCommissionsForService(serviceId);
      
      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
        results.errors.push(`${serviceId}: ${result.message}`);
      }
    }

    logger.info('🎉 [BULK_SYNC] Bulk synchronization completed:', results);

    return {
      success: results.failed === 0,
      message: `Procesados ${results.processed} servicios: ${results.successful} exitosos, ${results.failed} fallidos`,
      details: results
    };

  } catch (error) {
    logger.error('💥 [BULK_SYNC] Critical error in bulk sync:', error);
    return { success: false, message: `Error crítico: ${error}`, details: null };
  }
};

/**
 * Check which services need commission synchronization
 */
export const checkCommissionSyncStatus = async (): Promise<{ needsSync: string[]; upToDate: string[] }> => {
  try {
    const commissionCategoryId = '440296d4-09c2-4f3a-b02b-835f861df4c4';
    
    // Get all services with commissions in service_resources
    const { data: servicesWithResources } = await supabase
      .from('service_resources')
      .select('service_id, services!inner(folio)')
      .eq('resource_type', 'operator')
      .gt('commission_amount', 0);

    // Get all services with commissions in costs
    const { data: servicesWithCosts } = await supabase
      .from('costs')
      .select('service_id, services!inner(folio)')
      .eq('category_id', commissionCategoryId);

    const resourceServiceIds = new Set(servicesWithResources?.map(s => s.service_id) || []);
    const costServiceIds = new Set(servicesWithCosts?.map(s => s.service_id) || []);

    const needsSync = Array.from(resourceServiceIds).filter(id => !costServiceIds.has(id));
    const upToDate = Array.from(resourceServiceIds).filter(id => costServiceIds.has(id));

    return { needsSync, upToDate };
  } catch (error) {
    logger.error('Error checking sync status:', error);
    return { needsSync: [], upToDate: [] };
  }
};