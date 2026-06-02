import { forceCommissionSyncForService, diagnoseCommissionSync } from './forceCommissionSync';
import { syncCommissionsForService } from './commissionSync';
import { createLogger } from "@/lib/logger";


const logger = createLogger("testCommissionSync");
/**
 * Test function to immediately fix SRV-4107 commission issue
 */
export const testSRV4107Fix = async () => {
  logger.debug('🚨 [TEST] Starting emergency commission sync for SRV-4107');
  
  // First, let's get the service ID for SRV-4107
  const { supabase } = await import('@/integrations/supabase/client');
  
  const { data: service, error } = await supabase
    .from('services')
    .select('id, folio')
    .eq('folio', 'SRV-4107')
    .single();
    
  if (error || !service) {
    logger.error('❌ [TEST] Service SRV-4107 not found:', error);
    return;
  }
  
  logger.debug('✅ [TEST] Found service:', service);
  
  // Diagnose the issue first
  logger.debug('🔍 [TEST] Running diagnosis...');
  const diagnosis = await diagnoseCommissionSync(service.id);
  logger.debug('📊 [TEST] Diagnosis result:', diagnosis);
  
  // Force sync the commissions
  logger.debug('🔧 [TEST] Running force sync...');
  const syncResult = await forceCommissionSyncForService(service.id);
  logger.debug('🎉 [TEST] Sync result:', syncResult);
  
  // Run diagnosis again to verify
  logger.debug('🔍 [TEST] Running verification diagnosis...');
  const verificationDiagnosis = await diagnoseCommissionSync(service.id);
  logger.debug('✅ [TEST] Verification result:', verificationDiagnosis);
  
  return {
    service,
    diagnosis,
    syncResult,
    verificationDiagnosis
  };
};

// Global function for immediate testing
(window as any).testSRV4107Fix = testSRV4107Fix;