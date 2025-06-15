
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { useServiceTransformer } from './services/useServiceTransformer';

const fetchOperatorServices = async (transformRawServiceData: (data: any[]) => Service[]): Promise<Service[]> => {
  const { data, error } = await supabase
    .from('services')
    .select(`
      *,
      clients(id, name),
      cranes(id, license_plate, brand, model),
      service_types(id, name)
    `)
    .in('status', ['pending', 'in_progress'])
    .order('service_date', { ascending: true });

  if (error) {
    console.error('Error fetching operator services:', error);
    throw new Error('Could not fetch operator services');
  }

  return transformRawServiceData(data || []);
};

export const useOperatorServices = () => {
  const { transformRawServiceData } = useServiceTransformer();

  const { data: services, isLoading, error } = useQuery({
    queryKey: ['operatorServices'],
    queryFn: () => fetchOperatorServices(transformRawServiceData),
  });

  return { services, isLoading, error };
};
