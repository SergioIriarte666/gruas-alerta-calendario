
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { useServiceTransformer } from './services/useServiceTransformer';

const fetchOperatorService = async (serviceId: string, transformRawServiceData: (data: any[]) => Service[]): Promise<Service | null> => {
  if (!serviceId) return null;

  const { data, error } = await supabase
    .from('services')
    .select(`
      *,
      clients(id, name),
      cranes(id, license_plate, brand, model),
      service_types(id, name)
    `)
    .eq('id', serviceId)
    .single();

  if (error) {
    console.error(`Error fetching service ${serviceId}:`, error);
    throw new Error('Could not fetch service');
  }

  if (!data) return null;
  
  const transformed = transformRawServiceData([data]);
  return transformed[0] || null;
};

export const useOperatorService = (serviceId: string) => {
  const { transformRawServiceData } = useServiceTransformer();

  return useQuery({
    queryKey: ['operatorService', serviceId],
    queryFn: () => fetchOperatorService(serviceId, transformRawServiceData),
    enabled: !!serviceId,
  });
};
