
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ServiceStatus } from '@/types';
import { getServiceValueForClosure } from '@/utils/serviceValueCalculations';

export interface VehicleHistoryEntry {
  id: string;
  folio: string;
  serviceDate: string;
  createdAt: string;
  startTime?: string;
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

const fetchVehicleHistory = async (licensePlate: string): Promise<VehicleHistoryEntry[]> => {
  if (!licensePlate) return [];

  console.log('Fetching vehicle history for license plate:', licensePlate);

  const { data, error } = await supabase
    .from('services')
    .select(`
      id,
      folio,
      service_date,
      created_at,
      start_time,
      status,
      value,
      origin,
      destination,
      custody_total_amount,
      has_excess,
      client_covered_amount,
      service_types(name),
      client:clients!services_client_id_fkey(name),
      third_party_client:clients!services_third_party_client_id_fkey(name)
    `)
    .eq('license_plate', licensePlate)
    .order('service_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching vehicle history:', error);
    throw new Error('Could not fetch vehicle history');
  }

  console.log(`Found ${data?.length || 0} services for license plate ${licensePlate}:`, data);

  return (data || []).map((item: any) => ({
    id: item.id,
    folio: item.folio,
    serviceDate: item.service_date,
    createdAt: item.created_at,
    startTime: item.start_time,
    status: item.status,
    serviceType: item.service_types || { name: 'Desconocido' },
    client: (item.client || item.third_party_client) || { name: 'Desconocido' },
    value: Number(item.value || 0),
    origin: item.origin || '',
    destination: item.destination || '',
    // Agregar campos necesarios para getServiceValueForClosure
    custody_total_amount: item.custody_total_amount,
    has_excess: item.has_excess,
    client_covered_amount: item.client_covered_amount
  }));
};

export const useVehicleHistory = (licensePlate: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['vehicleHistory', licensePlate],
    queryFn: () => fetchVehicleHistory(licensePlate),
    enabled: !!licensePlate,
  });

  // Process entries only if data exists
  const processedEntries = data ? data.map(entry => ({
    ...entry,
    value: getServiceValueForClosure(entry) // Use correct calculation
  })) : [];

  return { history: processedEntries, isLoading, error };
};
