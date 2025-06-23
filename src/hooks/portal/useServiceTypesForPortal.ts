
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ServiceType {
  id: string;
  name: string;
  description: string | null;
  vehicle_info_optional: boolean;
  vehicle_brand_required: boolean;
  vehicle_model_required: boolean;
  license_plate_required: boolean;
}

const fetchServiceTypesForPortal = async (): Promise<ServiceType[]> => {
  const { data, error } = await supabase
    .from('service_types')
    .select('id, name, description, vehicle_info_optional, vehicle_brand_required, vehicle_model_required, license_plate_required')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error loading service types:', error);
    throw new Error('Error al cargar los tipos de servicio');
  }

  return data || [];
};

export const useServiceTypesForPortal = () => {
  const { 
    data: serviceTypes = [], 
    isLoading: loading, 
    refetch: loadServiceTypes 
  } = useQuery<ServiceType[]>({
    queryKey: ['serviceTypesForPortal'],
    queryFn: fetchServiceTypesForPortal
  });

  return {
    serviceTypes,
    loading,
    loadServiceTypes
  };
};
