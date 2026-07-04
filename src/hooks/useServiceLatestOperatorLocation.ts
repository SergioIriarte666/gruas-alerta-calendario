import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ServiceLatestOperatorLocation {
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  recorded_at: string;
  operator_id: string;
  service_id: string | null;
  session_id: string;
  is_offline_sync: boolean;
}

const fetchServiceLatestOperatorLocation = async (
  serviceId: string,
): Promise<ServiceLatestOperatorLocation | null> => {
  const { data, error } = await (supabase as any)
    .from('operator_location_points')
    .select('session_id, operator_id, service_id, latitude, longitude, accuracy_meters, recorded_at, is_offline_sync')
    .eq('service_id', serviceId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'No se pudo cargar la ultima ubicacion del operador');
  }

  return (data as ServiceLatestOperatorLocation | null) ?? null;
};

export const useServiceLatestOperatorLocation = (serviceId?: string | null) =>
  useQuery({
    queryKey: ['service-latest-operator-location', serviceId],
    queryFn: () => fetchServiceLatestOperatorLocation(serviceId as string),
    enabled: Boolean(serviceId),
    staleTime: 15000,
    refetchInterval: 30000,
  });
