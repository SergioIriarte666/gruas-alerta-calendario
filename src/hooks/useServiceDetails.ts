
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { useServiceTransformer } from './services/useServiceTransformer';

const fetchServiceById = async (serviceId: string, transformRawServiceData: (data: any[]) => Service[]): Promise<Service | null> => {
  if (!serviceId) return null;

  console.log('Fetching service details for:', serviceId);

  const { data, error } = await supabase
    .from('services')
    .select(`
      *,
      clients!inner(id, name, rut, phone, email, address, is_active, created_at, updated_at),
      cranes!inner(id, license_plate, brand, model, type, is_active, circulation_permit_expiry, insurance_expiry, technical_review_expiry, created_at, updated_at),
      operators!inner(id, name, rut, phone, license_number, is_active, exam_expiry, created_at, updated_at),
      service_types!inner(id, name, description, is_active, base_price, vehicle_info_optional, purchase_order_required, origin_required, destination_required, crane_required, operator_required, vehicle_brand_required, vehicle_model_required, license_plate_required, created_at, updated_at)
    `)
    .eq('id', serviceId)
    .single();

  if (error) {
    console.error(`Error fetching service details for id ${serviceId}:`, error);
    throw new Error('No se pudo cargar el servicio');
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
    retry: (failureCount, error) => {
      console.log(`Service details query retry attempt ${failureCount}:`, error.message);
      return failureCount < 2;
    },
    retryDelay: 1000,
  });

  return { data, isLoading, error, isSuccess };
};
