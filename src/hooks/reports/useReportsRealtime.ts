import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { useUnifiedRealtimeManager } from '../useUnifiedRealtimeManager';

/**
 * LEGACY HOOK - AHORA USA EL SISTEMA UNIFICADO
 */
export const useReportsRealtime = () => {
  const { getStatus } = useUnifiedRealtimeManager();

  useEffect(() => {
    console.log('📊 [LEGACY_REPORTS_REALTIME] Usando sistema unificado de realtime');
    console.log('📊 [LEGACY_REPORTS_REALTIME] Estado:', getStatus());
  }, [getStatus]);
};