import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useClientServices");
export interface ClientService {
  id: string;
  folio: string;
  service_date: string;
  status: string;
  origin: string;
  destination: string;
  value: number;
  crane_license_plate: string;
  operator_name: string;
  service_type_name: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  license_plate?: string;
}

const fetchClientServices = async (clientId: string | undefined): Promise<ClientService[]> => {
  if (!clientId) {
    logger.debug('No client ID provided for client services fetch');
    return [];
  }

  try {
    logger.debug('Fetching client services for client ID:', clientId);
    
    const { data, error } = await supabase
      .from('services')
      .select(`
        id,
        folio,
        service_date,
        status,
        origin,
        destination,
        value,
        license_plate,
        vehicle_brand,
        vehicle_model,
        cranes ( license_plate ),
        operators ( name ),
        service_types ( name )
      `)
      .eq('client_id', clientId)
      .order('service_date', { ascending: false });

    if (error) {
      logger.error('Error fetching client services:', error);
      throw new Error(`Error al obtener servicios: ${error.message}`);
    }

    logger.debug('Client services fetched successfully:', data?.length || 0, 'services');

    return (data || []).map((service: any) => ({
      id: service.id,
      folio: service.folio,
      service_date: service.service_date,
      status: service.status,
      origin: service.origin,
      destination: service.destination,
      value: service.value,
      license_plate: service.license_plate || '',
      vehicle_brand: service.vehicle_brand || '',
      vehicle_model: service.vehicle_model || '',
      crane_license_plate: service.cranes?.license_plate || 'N/A',
      operator_name: service.operators?.name || 'N/A',
      service_type_name: service.service_types?.name || 'N/A',
    }));
  } catch (error: any) {
    logger.error('Unexpected error in fetchClientServices:', error);
    throw error;
  }
};

export const useClientServices = () => {
  const { user } = useUser();

  return useQuery<ClientService[], Error>({
    queryKey: ['clientServices', user?.client_id],
    queryFn: () => fetchClientServices(user?.client_id),
    enabled: !!user?.client_id,
    retry: (failureCount, error) => {
      logger.debug(`Client services query retry attempt ${failureCount}:`, error.message);
      if (error.message.includes('permission')) {
        toast.error('Error de permisos', {
          description: 'No tienes acceso a esta información. Contacta al administrador.',
        });
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: 1000,
    meta: {
      onError: (error: Error) => {
        logger.error('Client services query error:', error);
        toast.error('Error al cargar servicios', {
          description: 'No se pudieron cargar tus servicios. Por favor, intenta recargar la página.',
        });
      },
    },
  });
};