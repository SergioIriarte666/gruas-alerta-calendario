import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { useUnifiedRealtimeManager } from '../useUnifiedRealtimeManager';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useReportsRealtime");
/**
 * LEGACY HOOK - AHORA USA EL SISTEMA UNIFICADO
 */
export const useReportsRealtime = () => {
  const { getStatus } = useUnifiedRealtimeManager();

  useEffect(() => {
    logger.debug('📊 [LEGACY_REPORTS_REALTIME] Usando sistema unificado de realtime');
    logger.debug('📊 [LEGACY_REPORTS_REALTIME] Estado:', getStatus());
  }, [getStatus]);
};