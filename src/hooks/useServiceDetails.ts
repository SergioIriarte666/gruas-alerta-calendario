
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { useServiceTransformer } from './services/useServiceTransformer';

const fetchServiceById = async (serviceId: string, transformRawServiceData: (data: any[]) => Service[]): Promise<Service | null> => {
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
    console.error(`Error fetching service details for id ${serviceId}:`, error);
    return null;
  }

  if (!data) return null;
  
  const formattedServices = transformRawServiceData([data]);
  return formattedServices[0];
};

export const useServiceDetails = (serviceId: string | null) => {
  const { transformRawServiceData } = useServiceTransformer();
  
  const { data, isLoading, error, isSuccess } = useQuery({
    queryKey: ['serviceDetails', serviceId],
    queryFn: () => fetchServiceById(serviceId!, transformRawServiceData),
    enabled: !!serviceId,
  });

  return { data, isLoading, error, isSuccess };
};
