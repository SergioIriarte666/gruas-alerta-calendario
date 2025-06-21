
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ServiceType {
  id: string;
  name: string;
  description?: string;
  basePrice?: number;
  isActive: boolean;
  vehicleInfoOptional: boolean;
  // Nuevos campos de configuración
  purchaseOrderRequired: boolean;
  originRequired: boolean;
  destinationRequired: boolean;
  craneRequired: boolean;
  operatorRequired: boolean;
  vehicleBrandRequired: boolean;
  vehicleModelRequired: boolean;
  licensePlateRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

const fetchServiceTypes = async (): Promise<ServiceType[]> => {
  const { data, error } = await supabase
    .from('service_types')
    .select('*')
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
    queryFn: fetchServiceTypes
  });

  return {
    serviceTypes,
    loading,
    loadServiceTypes
  };
};
