
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { useServiceTransformer } from './services/useServiceTransformer';

const fetchOperatorService = async (serviceId: string): Promise<Service | null> => {
  if (!serviceId) return null;

  console.log('Fetching service:', serviceId);

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
    console.error('Error fetching service:', error);
    throw new Error(`Error al cargar el servicio: ${error.message}`);
  }

  if (!data) {
    console.log('No service found with ID:', serviceId);
    return null;
  }

  console.log('Service data received:', data);
  return data as any;
};

export const useOperatorService = (serviceId: string) => {
  const { transformRawServiceData } = useServiceTransformer();

  return useQuery({
    queryKey: ['operatorService', serviceId],
    queryFn: async () => {
      const rawData = await fetchOperatorService(serviceId);
      if (!rawData) return null;
      
      const transformed = transformRawServiceData([rawData]);
      return transformed[0] || null;
    },
    enabled: !!serviceId,
    retry: 2,
  });
};
