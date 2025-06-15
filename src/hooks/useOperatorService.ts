
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
      clients(id, name, rut, phone, email, address, is_active),
      cranes(id, license_plate, brand, model, type, is_active),
      operators(id, name, rut, phone, license_number, is_active),
      service_types(id, name, description, is_active)
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
