
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ServiceStatus } from '@/types';

export interface VehicleHistoryEntry {
  id: string;
  folio: string;
  serviceDate: string;
  status: ServiceStatus;
  serviceType: {
    name: string;
  };
  client: {
    name: string;
  };
  value: number;
  origin: string;
  destination: string;
}

const fetchVehicleHistory = async (licensePlate: string, currentServiceId?: string): Promise<VehicleHistoryEntry[]> => {
  if (!licensePlate) return [];

  console.log('Fetching vehicle history for license plate:', licensePlate);

  let query = supabase
    .from('services')
    .select(`
      id,
      folio,
      service_date,
      status,
      value,
      origin,
      destination,
      service_types!inner(name),
      clients!inner(name)
    `)
    .eq('license_plate', licensePlate);

  if (currentServiceId) {
    query = query.neq('id', currentServiceId);
  }
  
  query = query.order('service_date', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching vehicle history:', error);
    throw new Error('Could not fetch vehicle history');
  }

  console.log(`Found ${data?.length || 0} services for license plate ${licensePlate}:`, data);

  return (data || []).map((item: any) => ({
    id: item.id,
    folio: item.folio,
    serviceDate: item.service_date,
    status: item.status,
    serviceType: item.service_types || { name: 'Desconocido' },
    client: item.clients || { name: 'Desconocido' },
    value: Number(item.value || 0),
    origin: item.origin || '',
    destination: item.destination || ''
  }));
};

export const useVehicleHistory = (licensePlate: string, currentServiceId?: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['vehicleHistory', licensePlate, currentServiceId],
    queryFn: () => fetchVehicleHistory(licensePlate, currentServiceId),
    enabled: !!licensePlate,
  });

  return { history: data ?? [], isLoading, error };
};
