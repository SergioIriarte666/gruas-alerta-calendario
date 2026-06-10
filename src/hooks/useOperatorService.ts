
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { useServiceTransformer } from './services/useServiceTransformer';
import { operatorServiceKeys } from './operatorServicesQueryKeys';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useOperatorService");
const fetchOperatorService = async (serviceId: string): Promise<Service | null> => {
  if (!serviceId || serviceId === 'undefined') {
    logger.debug('⚠️ Invalid service ID provided:', serviceId);
    return null;
  }

  logger.debug('🔍 Fetching service:', serviceId);

  try {
    const { data, error } = await supabase
      .from('services')
      .select(`
        *,
        start_time,
        end_time,
        crane_mileage,
        client:clients!services_client_id_fkey (*),
        third_party_client:clients!services_third_party_client_id_fkey (*),
        cranes (*),
        operators (*),
        service_types (*)
      `)
      .eq('id', serviceId)
      .maybeSingle();

    if (error) {
      logger.error('❌ Error fetching service:', error);
      throw new Error(`Error al cargar el servicio: ${error.message}`);
    }

    if (!data) {
      logger.debug('⚠️ No service found with ID:', serviceId);
      return null;
    }

    logger.debug('✅ Service data received:', data);
    return data as any;
  } catch (error) {
    logger.error('💥 Unexpected error:', error);
    throw error;
  }
};

export const useOperatorService = (serviceId: string) => {
  const { transformRawServiceData } = useServiceTransformer();

  return useQuery({
    queryKey: operatorServiceKeys.detail(serviceId),
    queryFn: async () => {
      logger.debug('🚀 Starting service fetch for:', serviceId);
      
      if (!serviceId || serviceId === 'undefined') {
        logger.debug('❌ No valid service ID provided');
        return null;
      }
      
      const rawData = await fetchOperatorService(serviceId);
      
      if (!rawData) {
        logger.debug('📭 No raw data found');
        return null;
      }
      
      logger.debug('🔄 Transforming service data...');
      const transformed = transformRawServiceData([rawData]);
      const result = transformed[0] || null;
      
      logger.debug('✨ Transformation complete:', result?.folio || 'NO FOLIO');
      return result;
    },
    enabled: !!serviceId && serviceId !== 'undefined',
    retry: (failureCount, error) => {
      logger.debug(`Service fetch retry attempt ${failureCount}:`, error.message);
      if (error.message.includes('permission')) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};
