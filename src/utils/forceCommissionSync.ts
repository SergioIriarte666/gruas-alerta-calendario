import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ForceCommissionSync');

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
 * Emergency function to force sync commissions for a specific service
 * IMPORTANTE: Solo sincroniza si el servicio tiene operator_commission > 0
 * y el operador no está excluido
 */
export const forceCommissionSyncForService = async (serviceId: string): Promise<{ success: boolean; message: string }> => {
  try {
    logger.info('🚨 [FORCE_SYNC] Emergency commission sync for service:', serviceId);
    
    const commissionCategoryId = '440296d4-09c2-4f3a-b02b-835f861df4c4';
    
    // PRIMERO: Verificar que el servicio tiene operator_commission > 0
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('folio, service_date, crane_id, operator_commission')
      .eq('id', serviceId)
      .single();

    if (serviceError || !service) {
      logger.error('❌ [FORCE_SYNC] Error fetching service:', serviceError);
      return { success: false, message: `Error al obtener servicio: ${serviceError?.message}` };
    }

    // Si el servicio no tiene comisión configurada, no hay nada que sincronizar
    if (!service.operator_commission || service.operator_commission <= 0) {
      logger.info('ℹ️ [FORCE_SYNC] Service has no commission configured (operator_commission = 0)');
      return { success: true, message: 'El servicio no tiene comisión configurada' };
    }
    
    // Step 1: Get service_resources with commissions
    const { data: serviceResources, error: resourcesError } = await supabase
      .from('service_resources')
      .select(`
        id,
        operator_id,
        commission_amount,
        operators(id, name, rut)
      `)
      .eq('service_id', serviceId)
      .eq('resource_type', 'operator')
      .gt('commission_amount', 0);

    if (resourcesError) {
      logger.error('❌ [FORCE_SYNC] Error fetching service_resources:', resourcesError);
      return { success: false, message: `Error al obtener recursos: ${resourcesError.message}` };
    }

    // Filtrar operadores excluidos
    const validResources = serviceResources?.filter(r => 
      !isOperatorExcluded(r.operators?.name)
    ) || [];

    if (validResources.length === 0) {
      logger.info('ℹ️ [FORCE_SYNC] No valid commissions found (all operators excluded or no commissions)');
      return { success: true, message: 'No hay comisiones válidas para sincronizar' };
    }

    logger.info('✅ [FORCE_SYNC] Found valid commissions to sync:', {
      count: validResources.length,
      commissions: validResources.map(r => ({
        operatorId: r.operator_id,
        amount: r.commission_amount,
        operatorName: r.operators?.name
      }))
    });

    // Step 2: Delete existing commission costs (avoid duplicates)
    const { error: deleteError } = await supabase
      .from('costs')
      .delete()
      .eq('service_id', serviceId)
      .eq('category_id', commissionCategoryId);

    if (deleteError) {
      logger.error('❌ [FORCE_SYNC] Error deleting existing commissions:', deleteError);
      return { success: false, message: `Error al eliminar comisiones existentes: ${deleteError.message}` };
    }

    logger.info('🗑️ [FORCE_SYNC] Deleted existing commission costs');

    // Step 3: Create new commission costs only for valid (non-excluded) operators
    const commissionCosts = validResources.map(resource => ({
      amount: resource.commission_amount,
      category_id: commissionCategoryId,
      service_id: serviceId,
      operator_id: resource.operator_id,
      service_folio: service.folio,
      date: service.service_date,
      description: `Comisión ${resource.operators?.name || 'Operador'}`,
      subcategory: 'comisiones',
      notes: 'Comisión sincronizada manualmente - corrección de emergencia',
      crane_id: service.crane_id,
      created_by: null
    }));

    // Step 4: Insert new commissions
    const { data: insertedCosts, error: insertError } = await supabase
      .from('costs')
      .insert(commissionCosts)
      .select('id, amount, operator_id, description');

    if (insertError) {
      logger.error('❌ [FORCE_SYNC] Error inserting commissions:', insertError);
      return { success: false, message: `Error al crear comisiones: ${insertError.message}` };
    }

    logger.info('🎉 [FORCE_SYNC] Commission sync completed successfully:', {
      serviceId,
      serviceFolio: service.folio,
      commissionsCreated: insertedCosts?.length || 0,
      totalAmount: commissionCosts.reduce((sum, c) => sum + c.amount, 0),
      insertedCosts: insertedCosts?.map(c => ({
        id: c.id,
        amount: c.amount,
        operatorId: c.operator_id,
        description: c.description
      })) || []
    });

    // Step 5: Verify the sync worked
    const { data: verificationCosts } = await supabase
      .from('costs')
      .select('id, amount, description, operator_id')
      .eq('service_id', serviceId)
      .eq('category_id', commissionCategoryId);

    logger.info('✅ [FORCE_SYNC] VERIFICATION - Final costs in database:', {
      count: verificationCosts?.length || 0,
      costs: verificationCosts?.map(c => ({
        id: c.id,
        amount: c.amount,
        description: c.description,
        operatorId: c.operator_id
      })) || []
    });

    return { 
      success: true, 
      message: `Sincronizadas ${insertedCosts?.length || 0} comisiones exitosamente para ${service.folio}` 
    };

  } catch (error) {
    logger.error('💥 [FORCE_SYNC] Critical error:', error);
    return { success: false, message: `Error crítico: ${error}` };
  }
};

/**
 * Diagnose commission sync issues for a service
 */
export const diagnoseCommissionSync = async (serviceId: string) => {
  try {
    const commissionCategoryId = '440296d4-09c2-4f3a-b02b-835f861df4c4';
    
    // Check service_resources
    const { data: serviceResources } = await supabase
      .from('service_resources')
      .select(`
        id,
        operator_id,
        commission_amount,
        operators(id, name, rut)
      `)
      .eq('service_id', serviceId)
      .eq('resource_type', 'operator');

    // Check costs
    const { data: costs } = await supabase
      .from('costs')
      .select('id, amount, description, operator_id')
      .eq('service_id', serviceId)
      .eq('category_id', commissionCategoryId);

    // Check service info
    const { data: service } = await supabase
      .from('services')
      .select('id, folio, service_date')
      .eq('id', serviceId)
      .single();

    const diagnosis = {
      serviceId,
      serviceFolio: service?.folio,
      serviceDate: service?.service_date,
      serviceResources: {
        total: serviceResources?.length || 0,
        withCommissions: serviceResources?.filter(r => r.commission_amount > 0).length || 0,
        details: serviceResources?.map(r => ({
          operatorId: r.operator_id,
          operatorName: r.operators?.name,
          commission: r.commission_amount
        })) || []
      },
      costs: {
        total: costs?.length || 0,
        details: costs?.map(c => ({
          id: c.id,
          amount: c.amount,
          description: c.description,
          operatorId: c.operator_id
        })) || []
      },
      syncNeeded: (serviceResources?.filter(r => r.commission_amount > 0).length || 0) > (costs?.length || 0)
    };

    logger.info('🔍 [DIAGNOSIS] Commission sync status:', diagnosis);
    return diagnosis;

  } catch (error) {
    logger.error('💥 [DIAGNOSIS] Error during diagnosis:', error);
    return null;
  }
};