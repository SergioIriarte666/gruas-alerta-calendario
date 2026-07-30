import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isTrustedLiveLocationPoint } from '@/lib/liveLocationQuality';

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
  // La RPC conserva todos los puntos crudos, pero solo permite que una lectura
  // con precisión <= 50 m y coordenadas válidas desplace el marcador visible.
  // Compartir esta selección con los demás mapas evita tres umbrales distintos.
  const { data, error } = await supabase
    .rpc('get_best_service_location_point', { p_service_id: serviceId })
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'No se pudo cargar la última ubicación confiable del operador');
  }

  if (!data || !isTrustedLiveLocationPoint({
    latitude: data.latitude,
    longitude: data.longitude,
    accuracyMeters: data.accuracy_meters,
  })) {
    return null;
  }

  return data;
};

export const useServiceLatestOperatorLocation = (serviceId?: string | null) =>
  useQuery({
    queryKey: ['service-latest-operator-location', serviceId],
    queryFn: () => fetchServiceLatestOperatorLocation(serviceId as string),
    enabled: Boolean(serviceId),
    staleTime: 15000,
    refetchInterval: 30000,
  });
