
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { useServiceTransformer } from './services/useServiceTransformer';

const fetchOperatorService = async (serviceId: string, transformRawServiceData: (data: any[]) => Service[]): Promise<Service | null> => {
  if (!serviceId) return null;

  console.log('🔍 Fetching operator service details for:', serviceId);

  const { data, error } = await supabase
    .from('services')
    .select(`
      *,
      clients(id, name, rut, phone, email, address, is_active),
      cranes(id, license_plate, brand, model, type, is_active),
      operators(id, name, rut, phone, license_number, is_active),
      service_types(id, name, description, is_active)
    `)
    .eq('id', serviceId)
    .single();

  if (error) {
    console.error(`❌ Error fetching operator service ${serviceId}:`, error);
    throw new Error(`No se pudo cargar el servicio: ${error.message}`);
  }

  if (!data) {
    console.log('⚠️ No service data found for ID:', serviceId);
    return null;
  }

  console.log('✅ Service data fetched successfully:', data);
  
  const transformed = transformRawServiceData([data]);
  return transformed[0] || null;
};

export const useOperatorService = (serviceId: string) => {
  const { transformRawServiceData } = useServiceTransformer();

  return useQuery({
    queryKey: ['operatorService', serviceId],
    queryFn: () => fetchOperatorService(serviceId, transformRawServiceData),
    enabled: !!serviceId,
    retry: (failureCount, error) => {
      console.log(`🔄 Operator service query retry attempt ${failureCount}:`, error.message);
      return failureCount < 2;
    },
    retryDelay: 1000,
  });
};
