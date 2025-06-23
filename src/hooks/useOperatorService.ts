
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { useServiceTransformer } from './services/useServiceTransformer';

const fetchOperatorService = async (serviceId: string): Promise<Service | null> => {
  if (!serviceId || serviceId === 'undefined') {
    console.log('⚠️ Invalid service ID provided:', serviceId);
    return null;
  }

  console.log('🔍 Fetching service:', serviceId);

  try {
    const { data, error } = await supabase
      .from('services')
      .select(`
        *,
        clients (*),
        cranes (*),
        operators (*),
        service_types (*)
      `)
      .eq('id', serviceId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching service:', error);
      throw new Error(`Error al cargar el servicio: ${error.message}`);
    }

    if (!data) {
      console.log('⚠️ No service found with ID:', serviceId);
      return null;
    }

    console.log('✅ Service data received:', data);
    return data as any;
  } catch (error) {
    console.error('💥 Unexpected error:', error);
    throw error;
  }
};

export const useOperatorService = (serviceId: string) => {
  const { transformRawServiceData } = useServiceTransformer();

  return useQuery({
    queryKey: ['operatorService', serviceId],
    queryFn: async () => {
      console.log('🚀 Starting service fetch for:', serviceId);
      
      if (!serviceId || serviceId === 'undefined') {
        console.log('❌ No valid service ID provided');
        return null;
      }
      
      const rawData = await fetchOperatorService(serviceId);
      
      if (!rawData) {
        console.log('📭 No raw data found');
        return null;
      }
      
      console.log('🔄 Transforming service data...');
      const transformed = transformRawServiceData([rawData]);
      const result = transformed[0] || null;
      
      console.log('✨ Transformation complete:', result?.folio || 'NO FOLIO');
      return result;
    },
    enabled: !!serviceId && serviceId !== 'undefined',
    retry: (failureCount, error) => {
      console.log(`Service fetch retry attempt ${failureCount}:`, error.message);
      if (error.message.includes('permission')) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};
