
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ServiceType } from '@/types';

const SERVICE_TYPE_SELECT = `
  id,
  name,
  description,
  base_price,
  is_active,
  vehicle_info_optional,
  is_outsourced,
  purchase_order_required,
  origin_required,
  destination_required,
  crane_required,
  operator_required,
  vehicle_brand_required,
  vehicle_model_required,
  license_plate_required,
  created_at,
  updated_at
`;

const fetchServiceTypes = async (): Promise<ServiceType[]> => {
  const { data, error } = await supabase
    .from('service_types')
    .select(SERVICE_TYPE_SELECT)
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error loading service types:', error);
    throw new Error('Error loading service types');
  }

  const formattedServiceTypes: ServiceType[] = (data || []).map(serviceType => ({
    id: serviceType.id,
    name: serviceType.name,
    description: serviceType.description,
    basePrice: serviceType.base_price,
    isActive: serviceType.is_active,
    vehicleInfoOptional: serviceType.vehicle_info_optional || false,
    isOutsourced: serviceType.is_outsourced || false,
    purchaseOrderRequired: serviceType.purchase_order_required || false,
    originRequired: serviceType.origin_required !== false, // Default true
    destinationRequired: serviceType.destination_required !== false, // Default true
    craneRequired: serviceType.crane_required !== false, // Default true
    operatorRequired: serviceType.operator_required !== false, // Default true
    vehicleBrandRequired: serviceType.vehicle_brand_required !== false, // Default true
    vehicleModelRequired: serviceType.vehicle_model_required !== false, // Default true
    licensePlateRequired: serviceType.license_plate_required !== false, // Default true
    createdAt: serviceType.created_at,
    updatedAt: serviceType.updated_at
  }));

  return formattedServiceTypes;
};

export const useServiceTypes = () => {
  const { 
    data: serviceTypes = [], 
    isLoading: loading, 
    refetch: loadServiceTypes 
  } = useQuery<ServiceType[]>({
    queryKey: ['serviceTypes'],
    queryFn: fetchServiceTypes,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  return {
    serviceTypes,
    loading,
    loadServiceTypes
  };
};
