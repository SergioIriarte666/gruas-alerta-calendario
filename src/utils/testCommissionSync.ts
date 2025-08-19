import { forceCommissionSyncForService, diagnoseCommissionSync } from './forceCommissionSync';
import { syncCommissionsForService } from './commissionSync';

/**
 * Test function to immediately fix SRV-4107 commission issue
 */
export const testSRV4107Fix = async () => {
  console.log('🚨 [TEST] Starting emergency commission sync for SRV-4107');
  
  // First, let's get the service ID for SRV-4107
  const { supabase } = await import('@/integrations/supabase/client');
  
  const { data: service, error } = await supabase
    .from('services')
    .select('id, folio')
    .eq('folio', 'SRV-4107')
    .single();
    
  if (error || !service) {
    console.error('❌ [TEST] Service SRV-4107 not found:', error);
    return;
  }
  
  console.log('✅ [TEST] Found service:', service);
  
  // Diagnose the issue first
  console.log('🔍 [TEST] Running diagnosis...');
  const diagnosis = await diagnoseCommissionSync(service.id);
  console.log('📊 [TEST] Diagnosis result:', diagnosis);
  
  // Force sync the commissions
  console.log('🔧 [TEST] Running force sync...');
  const syncResult = await forceCommissionSyncForService(service.id);
  console.log('🎉 [TEST] Sync result:', syncResult);
  
  // Run diagnosis again to verify
  console.log('🔍 [TEST] Running verification diagnosis...');
  const verificationDiagnosis = await diagnoseCommissionSync(service.id);
  console.log('✅ [TEST] Verification result:', verificationDiagnosis);
  
  return {
    service,
    diagnosis,
    syncResult,
    verificationDiagnosis
  };
};

// Global function for immediate testing
(window as any).testSRV4107Fix = testSRV4107Fix;