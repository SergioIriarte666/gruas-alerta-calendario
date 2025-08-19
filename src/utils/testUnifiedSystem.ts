import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('UnifiedSystemTest');

/**
 * Test function to verify the unified service system works correctly
 * This function can be called from the browser console or anywhere in the app
 */
export const testUnifiedSystem = async () => {
  logger.info('🧪 Starting unified system verification test');
  
  try {
    // Test 1: Check service SRV-4107 has operators in service_resources
    const { data: serviceResources, error: resourcesError } = await supabase
      .from('service_resources')
      .select(`
        id,
        service_id,
        operator_id,
        commission_amount,
        services(folio)
      `)
      .eq('services.folio', 'SRV-4107')
      .eq('resource_type', 'operator');

    if (resourcesError) {
      logger.error('❌ Error checking service_resources:', resourcesError);
      return { success: false, error: resourcesError.message };
    }

    logger.info('📋 Service resources for SRV-4107:', serviceResources);

    // Test 2: Check if corresponding commission costs exist
    const commissionCategoryId = '440296d4-09c2-4f3a-b02b-835f861df4c4';
    const { data: commissionCosts, error: costsError } = await supabase
      .from('costs')
      .select(`
        id,
        amount,
        operator_id,
        service_folio,
        description,
        subcategory
      `)
      .eq('service_folio', 'SRV-4107')
      .eq('category_id', commissionCategoryId);

    if (costsError) {
      logger.error('❌ Error checking commission costs:', costsError);
      return { success: false, error: costsError.message };
    }

    logger.info('💰 Commission costs for SRV-4107:', commissionCosts);

    // Test 3: Verify synchronization
    const operatorsWithCommission = serviceResources?.filter(r => r.commission_amount > 0) || [];
    const expectedCommissions = operatorsWithCommission.length;
    const actualCommissions = commissionCosts?.length || 0;

    const isSync = expectedCommissions === actualCommissions;

    const result = {
      success: true,
      serviceId: 'SRV-4107',
      operatorsInResources: serviceResources?.length || 0,
      operatorsWithCommission: expectedCommissions,
      commissionCostsFound: actualCommissions,
      isInSync: isSync,
      serviceResources,
      commissionCosts,
      message: isSync 
        ? '✅ System is properly synchronized!' 
        : `❌ SYNC ISSUE: Expected ${expectedCommissions} commission costs, found ${actualCommissions}`
    };

    logger.info('🎯 Test results:', result);
    return result;

  } catch (error) {
    logger.error('💥 Error in unified system test:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Test function specifically for commission synchronization
 */
export const testCommissionSync = async (serviceId: string) => {
  logger.info(`🔍 Testing commission sync for service: ${serviceId}`);
  
  try {
    // Get service resources
    const { data: resources } = await supabase
      .from('service_resources')
      .select('*')
      .eq('service_id', serviceId)
      .eq('resource_type', 'operator');

    // Get commission costs
    const { data: costs } = await supabase
      .from('costs')
      .select('*')
      .eq('service_id', serviceId)
      .eq('category_id', '440296d4-09c2-4f3a-b02b-835f861df4c4');

    const operatorsWithCommission = resources?.filter(r => r.commission_amount > 0) || [];
    
    return {
      serviceId,
      resourcesCount: resources?.length || 0,
      operatorsWithCommission: operatorsWithCommission.length,
      commissionCostsCount: costs?.length || 0,
      isInSync: operatorsWithCommission.length === (costs?.length || 0),
      resources,
      costs
    };
  } catch (error) {
    logger.error('Error testing commission sync:', error);
    return { error: error.message };
  }
};

// Export to window for easy console testing
if (typeof window !== 'undefined') {
  (window as any).testUnifiedSystem = testUnifiedSystem;
  (window as any).testCommissionSync = testCommissionSync;
}