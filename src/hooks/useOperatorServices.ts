
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { useServiceTransformer } from './services/useServiceTransformer';
import { toast } from 'sonner';

const fetchOperatorServices = async (userId: string): Promise<any[]> => {
  try {
    console.log('Fetching operator services for user:', userId);
    
    // Primero, obtener el operator_id basado en el user_id
    const { data: operatorData, error: operatorError } = await supabase
      .from('operators')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (operatorError) {
      console.error('Error fetching operator by user_id:', operatorError);
      throw new Error(`No se encontró operador para el usuario: ${operatorError.message}`);
    }

    if (!operatorData) {
      console.log('No operator found for user:', userId);
      throw new Error('No se encontró un operador asociado a este usuario');
    }

    console.log('Found operator:', operatorData.id);

    // Ahora obtener los servicios para este operador - incluir inspection_completed
    const { data: services, error } = await supabase
      .from('services')
      .select(`
        id,
        folio,
        request_date,
        service_date,
        start_time,
        end_time,
        crane_mileage,
        client_id,
        service_type_id,
        crane_id,
        operator_id,
        vehicle_brand,
        vehicle_model,
        license_plate,
        origin,
        destination,
        value,
        operator_commission,
        status,
        observations,
        purchase_order,
        created_at,
        updated_at,
        client:clients!services_client_id_fkey (
          id,
          name,
          rut,
          phone,
          email,
          address,
          department,
          is_active,
          created_at,
          updated_at
        ),
        service_types!services_service_type_id_fkey (
          id,
          name,
          description,
          base_price,
          is_active,
          vehicle_info_optional,
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
        ),
        cranes!services_crane_id_fkey (
          id,
          license_plate,
          brand,
          model,
          type,
          is_active,
          circulation_permit_expiry,
          insurance_expiry,
          technical_review_expiry,
          created_at,
          updated_at
        ),
        operators!services_operator_id_fkey (
          id,
          name,
          rut,
          phone,
          license_number,
          is_active,
          exam_expiry,
          created_at,
          updated_at
        )
      `)
      .eq('operator_id', operatorData.id)
      .in('status', ['pending', 'in_progress', 'inspection_completed', 'completed'])
      .order('service_date', { ascending: true });

    if (error) {
      console.error('Error fetching operator services:', error);
      throw new Error(`Error al obtener servicios: ${error.message}`);
    }

    console.log('Operator services fetched successfully:', services?.length || 0, 'services');
    return services || [];
  } catch (error: any) {
    console.error('Unexpected error in fetchOperatorServices:', error);
    throw error;
  }
};

export const useOperatorServices = (userId?: string) => {
  const { transformRawServiceData } = useServiceTransformer();

  return useQuery<Service[], Error>({
    queryKey: ['operator-services', userId],
    queryFn: () => fetchOperatorServices(userId!),
    enabled: !!userId,
    staleTime: 0,
    gcTime: 0,
    select: (data) => {
      try {
        return transformRawServiceData(data).filter(Boolean) as Service[];
      } catch (error) {
        console.error('Error transforming operator services:', error);
        return [];
      }
    },
    retry: (failureCount, error) => {
      console.log(`Operator services query retry attempt ${failureCount}:`, error.message);
      if (error.message.includes('permission') || error.message.includes('No se encontró operador')) {
        toast.error('Error de acceso', {
          description: 'No tienes acceso a servicios como operador. Contacta al administrador.',
        });
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: 1000,
    meta: {
      onError: (error: Error) => {
        console.error('Operator services query error:', error);
        toast.error('Error al cargar servicios', {
          description: 'No se pudieron cargar los servicios asignados. Por favor, intenta recargar la página.',
        });
      },
    },
  });
};
