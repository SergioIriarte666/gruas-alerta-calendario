
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { useServiceTransformer } from './services/useServiceTransformer';
import { useUser } from '@/contexts/UserContext';

const fetchOperatorServices = async (transformRawServiceData: (data: any[]) => Service[], userId?: string): Promise<Service[]> => {
  if (!userId) {
    console.log('No user ID provided, returning empty array');
    return [];
  }

  console.log('Fetching services for user:', userId);

  // Primero obtener el operator_id del usuario actual
  const { data: operatorData, error: operatorError } = await supabase
    .from('operators')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (operatorError || !operatorData) {
    console.log('No operator found for user:', userId, operatorError);
    return [];
  }

  console.log('Found operator:', operatorData.id);

  // Luego obtener los servicios asignados a este operador
  const { data, error } = await supabase
    .from('services')
    .select(`
      *,
      clients(id, name),
      cranes(id, license_plate, brand, model),
      service_types(id, name)
    `)
    .eq('operator_id', operatorData.id)
    .in('status', ['pending', 'in_progress'])
    .order('service_date', { ascending: true });

  if (error) {
    console.error('Error fetching operator services:', error);
    throw new Error('Could not fetch operator services');
  }

  console.log('Raw services data:', data);
  const transformedServices = transformRawServiceData(data || []);
  console.log('Transformed services:', transformedServices);
  return transformedServices;
};

export const useOperatorServices = () => {
  const { transformRawServiceData } = useServiceTransformer();
  const { user } = useUser();

  const { data: services, isLoading, error } = useQuery({
    queryKey: ['operatorServices', user?.id],
    queryFn: () => fetchOperatorServices(transformRawServiceData, user?.id),
    enabled: !!user?.id,
  });

  return { services, isLoading, error };
};
