import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ServiceStatus } from '@/types';

export interface ClientHistoryEntry {
  id: string;
  folio: string;
  serviceDate: string;
  status: ServiceStatus;
  serviceType: {
    name: string;
  };
  value: number;
  origin: string;
  destination: string;
  licensePlate: string;
}

const fetchClientHistory = async (clientId: string): Promise<ClientHistoryEntry[]> => {
  if (!clientId) return [];

  const { data, error } = await supabase
    .from('services')
    .select(`
      id,
      folio,
      service_date,
      status,
      value,
      origin,
      destination,
      license_plate,
      service_types(name)
    `)
    .eq('client_id', clientId)
    .order('service_date', { ascending: false });

  if (error) {
    console.error('Error fetching client history:', error);
    throw new Error('Could not fetch client history');
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    folio: item.folio,
    serviceDate: item.service_date,
    status: item.status,
    serviceType: item.service_types || { name: 'Desconocido' },
    value: Number(item.value || 0),
    origin: item.origin || '',
    destination: item.destination || '',
    licensePlate: item.license_plate || 'N/A'
  }));
};

export const useClientHistory = (clientId: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['clientHistory', clientId],
    queryFn: () => fetchClientHistory(clientId),
    enabled: !!clientId,
  });

  return { history: data ?? [], isLoading, error };
};
