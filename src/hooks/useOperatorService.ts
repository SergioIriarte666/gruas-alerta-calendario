
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
      clients (*),
      cranes (*),
      operators (*),
      service_types (*)
    `)
    .eq('id', serviceId)
    .single();

  if (error) {
    console.error('Error fetching service:', error);
    throw new Error(`Error al cargar el servicio: ${error.message}`);
  }

  if (!data) {
    throw new Error('Servicio no encontrado');
  }

  const transformed = transformRawServiceData([data]);
  return transformed[0] || null;
};

export const useOperatorService = (serviceId: string) => {
  const { transformRawServiceData } = useServiceTransformer();

  return useQuery({
    queryKey: ['operatorService', serviceId],
    queryFn: () => fetchOperatorService(serviceId, transformRawServiceData),
    enabled: !!serviceId,
    retry: 1,
  });
};
