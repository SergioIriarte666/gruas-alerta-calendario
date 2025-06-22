import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';

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
}

const fetchClientServices = async (userId: string | undefined): Promise<ClientService[]> => {
  if (!userId) {
    // Si no hay usuario, no se puede hacer la consulta.
    // RLS se encargará de la seguridad, pero esto evita una llamada innecesaria.
    return [];
  }

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
      cranes ( license_plate ),
      operators ( name )
    `)
    // El filtrado por cliente se hace automáticamente gracias a la Política RLS
    // No necesitamos añadir un .eq('client_id', ...) aquí.
    .order('service_date', { ascending: false });

  if (error) {
    console.error('Error fetching client services:', error);
    throw new Error('No se pudieron obtener los servicios.');
  }

  return (data || []).map((service: any) => ({
    id: service.id,
    folio: service.folio,
    service_date: service.service_date,
    status: service.status,
    origin: service.origin,
    destination: service.destination,
    value: service.value,
    crane_license_plate: service.cranes?.license_plate || 'N/A',
    operator_name: service.operators?.name || 'N/A',
  }));
};

export const useClientServices = () => {
  const { user } = useUser();

  return useQuery<ClientService[], Error>({
    queryKey: ['clientServices', user?.id],
    queryFn: () => fetchClientServices(user?.id),
    enabled: !!user, // La consulta solo se ejecutará si hay un usuario logueado.
  });
};

