
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
}

const fetchVehicleHistory = async (licensePlate: string, currentServiceId: string): Promise<VehicleHistoryEntry[]> => {
  if (!licensePlate) return [];

  const { data, error } = await supabase
    .from('services')
    .select(`
      id,
      folio,
      service_date,
      status,
      service_types(name)
    `)
    .eq('license_plate', licensePlate)
    .neq('id', currentServiceId)
    .order('service_date', { ascending: false });

  if (error) {
    console.error('Error fetching vehicle history:', error);
    throw new Error('Could not fetch vehicle history');
  }

  return (data || []).map((item: any) => ({
      id: item.id,
      folio: item.folio,
      serviceDate: item.service_date,
      status: item.status,
      serviceType: item.service_types || { name: 'Desconocido' },
  }));
};

export const useVehicleHistory = (licensePlate: string, currentServiceId: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['vehicleHistory', licensePlate, currentServiceId],
    queryFn: () => fetchVehicleHistory(licensePlate, currentServiceId),
    enabled: !!licensePlate && !!currentServiceId,
  });

  return { history: data ?? [], isLoading, error };
};
