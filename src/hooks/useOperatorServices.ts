
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { useServiceTransformer } from './services/useServiceTransformer';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import { operatorServicesKeys } from './operatorServicesQueryKeys';

const logger = createLogger('useOperatorServices');

const OPERATOR_SERVICES_SELECT = `
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
`;

const fetchOperatorServices = async (userId: string): Promise<any[]> => {
  try {
    logger.debug('Fetching operator services for user:', userId);
    
    // Primero, obtener el operator_id basado en el user_id
    const { data: operatorData, error: operatorError } = await supabase
      .from('operators')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (operatorError) {
      logger.error('Error fetching operator by user_id:', operatorError);
      throw new Error(`No se encontró operador para el usuario: ${operatorError.message}`);
    }

    if (!operatorData) {
      logger.debug('No operator found for user:', userId);
      throw new Error('No se encontró un operador asociado a este usuario');
    }

    logger.debug('Found operator:', operatorData.id);

    const statusFilter = ['pending', 'in_progress', 'inspection_completed', 'completed'] as const;

    const [{ data: directServices, error: directError }, { data: resourceLinks, error: resourceError }] = await Promise.all([
      supabase
        .from('services')
        .select(OPERATOR_SERVICES_SELECT)
        .eq('operator_id', operatorData.id)
        .in('status', statusFilter)
        .order('service_date', { ascending: true }),
      supabase
        .from('service_resources')
        .select('service_id')
        .eq('resource_type', 'operator')
        .eq('operator_id', operatorData.id),
    ]);

    if (directError) {
      logger.error('Error fetching operator services (direct):', directError);
      throw new Error(`Error al obtener servicios: ${directError.message}`);
    }
    if (resourceError) {
      logger.error('Error fetching operator services (service_resources):', resourceError);
      throw new Error(`Error al obtener asignaciones: ${resourceError.message}`);
    }

    const serviceIdsFromResources = Array.from(
      new Set((resourceLinks || []).map(r => r.service_id).filter(Boolean))
    );

    let resourceServices: any[] = [];
    if (serviceIdsFromResources.length > 0) {
      const { data: resServices, error: resServicesError } = await supabase
        .from('services')
        .select(OPERATOR_SERVICES_SELECT)
        .in('id', serviceIdsFromResources)
        .in('status', statusFilter)
        .order('service_date', { ascending: true });

      if (resServicesError) {
        logger.error('Error fetching operator services (by service_resources):', resServicesError);
        throw new Error(`Error al obtener servicios asignados: ${resServicesError.message}`);
      }

      resourceServices = resServices || [];
    }

    const mergedById = new Map<string, any>();
    for (const s of (directServices || [])) mergedById.set((s as any).id, s);
    for (const s of resourceServices) mergedById.set((s as any).id, s);

    const merged = Array.from(mergedById.values());
    logger.debug('Operator services fetched successfully:', merged.length, 'services');
    return merged;
  } catch (error: any) {
    logger.error('Unexpected error in fetchOperatorServices:', error);
    throw error;
  }
};

export const useOperatorServices = (userId?: string) => {
  const { transformRawServiceData } = useServiceTransformer();

  return useQuery<Service[], Error>({
    // NOTE: include a minor version tag to avoid stale selected-cache issues when the transformer changes.
    queryKey: operatorServicesKeys.byUser(userId),
    queryFn: () => fetchOperatorServices(userId!),
    enabled: !!userId,
    select: (data) => {
      try {
        return transformRawServiceData(data).filter(Boolean) as Service[];
      } catch (error) {
        logger.error('Error transforming operator services:', error);
        return [];
      }
    },
    retry: (failureCount, error) => {
      logger.debug(`Operator services query retry attempt ${failureCount}:`, error.message);
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
        logger.error('Operator services query error:', error);
        toast.error('Error al cargar servicios', {
          description: 'No se pudieron cargar los servicios asignados. Por favor, intenta recargar la página.',
        });
      },
    },
  });
};
