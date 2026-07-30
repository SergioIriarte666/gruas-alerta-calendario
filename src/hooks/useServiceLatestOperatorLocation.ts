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
  // Se lee el arreglo en vez de .maybeSingle(): sobre un RPC (POST) maybeSingle
  // igual manda `Accept: application/vnd.pgrst.object+json`, así que cero filas
  // devuelve 406 y supabase-js lo traga por dentro. Funcionaba, pero llenaba los
  // logs de PostgREST de 406 en el caso NORMAL — la enorme mayoría de los
  // servicios no tiene ningún punto GPS confiable.
  const { data, error } = await supabase
    .rpc('get_best_service_location_point', { p_service_id: serviceId });

  if (error) {
    throw new Error(error.message || 'No se pudo cargar la última ubicación confiable del operador');
  }

  const point = data?.[0] ?? null;

  if (!point || !isTrustedLiveLocationPoint({
    latitude: point.latitude,
    longitude: point.longitude,
    accuracyMeters: point.accuracy_meters,
  })) {
    return null;
  }

  return point;
};

export const useServiceLatestOperatorLocation = (serviceId?: string | null) =>
  useQuery({
    queryKey: ['service-latest-operator-location', serviceId],
    queryFn: () => fetchServiceLatestOperatorLocation(serviceId as string),
    enabled: Boolean(serviceId),
    staleTime: 15000,
    refetchInterval: 30000,
  });
