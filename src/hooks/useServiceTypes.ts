
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ServiceType } from '@/types';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { offlineFetch } from '@/services/offlineOperations';
import { toast } from 'sonner';

// Transformar datos de DB (snake_case) a formato app (camelCase)
const transformFromDb = (serviceType: any): ServiceType => ({
  id: serviceType.id,
  name: serviceType.name,
  description: serviceType.description,
  basePrice: serviceType.base_price,
  isActive: serviceType.is_active,
  vehicleInfoOptional: serviceType.vehicle_info_optional || false,
  purchaseOrderRequired: serviceType.purchase_order_required || false,
  originRequired: serviceType.origin_required !== false,
  destinationRequired: serviceType.destination_required !== false,
  craneRequired: serviceType.crane_required !== false,
  operatorRequired: serviceType.operator_required !== false,
  vehicleBrandRequired: serviceType.vehicle_brand_required !== false,
  vehicleModelRequired: serviceType.vehicle_model_required !== false,
  licensePlateRequired: serviceType.license_plate_required !== false,
  createdAt: serviceType.created_at,
  updatedAt: serviceType.updated_at
});

const fetchServiceTypesFromDb = async (): Promise<any[]> => {
  const { data, error } = await supabase
    .from('service_types')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error loading service types:', error);
    throw new Error('Error loading service types');
  }

  return data || [];
};

export const useServiceTypes = () => {
  const { effectiveIsOnline } = useOfflineMode();

  const { 
    data: serviceTypes = [], 
    isLoading: loading, 
    refetch: loadServiceTypes 
  } = useQuery<ServiceType[]>({
    queryKey: ['serviceTypes'],
    queryFn: async () => {
      const { data, isFromCache } = await offlineFetch<any[]>(
        'service_types',
        effectiveIsOnline,
        fetchServiceTypesFromDb,
        (rawData) => rawData // Cache guarda raw, transformamos después
      );

      const transformed = (data || []).map(transformFromDb);

      if (isFromCache && transformed.length > 0) {
        console.log(`📴 [OFFLINE] ${transformed.length} tipos de servicio cargados desde cache`);
      }

      return transformed;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: effectiveIsOnline,
    refetchOnReconnect: true,
    retry: effectiveIsOnline ? 2 : 0
  });

  return {
    serviceTypes,
    loading,
    loadServiceTypes
  };
};
