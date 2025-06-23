
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { useServiceTransformer } from './services/useServiceTransformer';

const fetchOperatorService = async (serviceId: string, transformRawServiceData: (data: any[]) => Service[]): Promise<Service | null> => {
  if (!serviceId) return null;

  console.log('🔍 Fetching operator service details for:', serviceId);

  // First, check if the service exists at all
  const { data: serviceCheck, error: serviceCheckError } = await supabase
    .from('services')
    .select('id')
    .eq('id', serviceId)
    .single();

  if (serviceCheckError || !serviceCheck) {
    console.error('❌ Service does not exist:', serviceId);
    throw new Error('El servicio no existe en el sistema');
  }

  // Fetch the complete service with all related data using left joins
  const { data, error } = await supabase
    .from('services')
    .select(`
      *,
      clients (
        id, name, rut, phone, email, address, is_active
      ),
      cranes (
        id, license_plate, brand, model, type, is_active
      ),
      operators (
        id, name, rut, phone, license_number, is_active
      ),
      service_types (
        id, name, description, is_active, base_price,
        vehicle_info_optional, purchase_order_required,
        origin_required, destination_required, crane_required,
        operator_required, vehicle_brand_required, vehicle_model_required,
        license_plate_required, created_at, updated_at
      )
    `)
    .eq('id', serviceId)
    .single();

  if (error) {
    console.error(`❌ Error fetching operator service ${serviceId}:`, error);
    if (error.code === 'PGRST116') {
      throw new Error('No tienes permisos para acceder a este servicio');
    }
    throw new Error(`Error al cargar el servicio: ${error.message}`);
  }

  if (!data) {
    console.log('⚠️ No service data found for ID:', serviceId);
    throw new Error('No se encontró información del servicio');
  }

  console.log('✅ Service data fetched successfully:', {
    id: data.id,
    folio: data.folio,
    hasClient: !!data.clients,
    hasOperator: !!data.operators,
    hasCrane: !!data.cranes,
    hasServiceType: !!data.service_types
  });
  
  // Transform the data ensuring all relationships are properly handled
  try {
    const transformed = transformRawServiceData([data]);
    const service = transformed[0];
    
    if (!service) {
      throw new Error('Error al procesar los datos del servicio');
    }
    
    console.log('✅ Service transformed successfully:', service.folio);
    return service;
  } catch (transformError) {
    console.error('❌ Error transforming service data:', transformError);
    throw new Error('Error al procesar la información del servicio');
  }
};

export const useOperatorService = (serviceId: string) => {
  const { transformRawServiceData } = useServiceTransformer();

  return useQuery({
    queryKey: ['operatorService', serviceId],
    queryFn: () => fetchOperatorService(serviceId, transformRawServiceData),
    enabled: !!serviceId,
    retry: (failureCount, error) => {
      console.log(`🔄 Operator service query retry attempt ${failureCount}:`, error.message);
      // Don't retry on permission or not found errors
      if (error.message.includes('permisos') || error.message.includes('no existe')) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: 1000,
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: false,
  });
};
