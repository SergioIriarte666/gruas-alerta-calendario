import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import type { Database } from '@/integrations/supabase/types';

const logger = createLogger('ServiceProgress');

type LiveProgressRow = Database['public']['Functions']['get_service_live_progress']['Returns'][number];

/**
 * El generador de tipos de Supabase declara todas las columnas de una función
 * `RETURNS TABLE` como no nulas, y casi todas éstas sí lo son: sin ETA vigente,
 * sin detención abierta o sin un solo punto GPS, la fila viene con NULL. Tipar
 * la nulabilidad aquí evita que el componente asuma un número donde no hay dato.
 */
export type ServiceLiveProgress = {
  [K in keyof LiveProgressRow]: LiveProgressRow[K] | null;
};

/** Cada cuánto se considera vieja la cinta y cada cuánto se repregunta. */
export const PROGRESS_STALE_MS = 15_000;
export const PROGRESS_REFETCH_MS = 30_000;

interface UseServiceProgressOptions {
  serviceId?: string | null;
  /**
   * Servicio EN CURSO. La cinta no tiene sentido —ni debe gastar consultas—
   * sobre un servicio asignado pero no iniciado o ya cerrado.
   */
  isActive?: boolean;
}

/**
 * Telemetría en vivo del servicio en curso: los mismos números que hoy sólo
 * aparecen al cerrar el servicio (service_route_metrics), pero mientras el
 * viaje ocurre.
 *
 * Los tiempos de refresco se declaran explícitamente porque el `staleTime`
 * global del proyecto es de minutos: heredarlo dejaría la cinta congelada
 * durante todo el traslado, que es exactamente lo contrario de lo que es.
 */
export const useServiceProgress = ({ serviceId, isActive = false }: UseServiceProgressOptions) =>
  useQuery({
    queryKey: ['service-live-progress', serviceId],
    enabled: Boolean(serviceId) && isActive,
    staleTime: PROGRESS_STALE_MS,
    refetchInterval: PROGRESS_REFETCH_MS,
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async (): Promise<ServiceLiveProgress | null> => {
      const { data, error } = await supabase.rpc('get_service_live_progress', {
        p_service_id: serviceId as string,
      });

      if (error) {
        logger.warn('No se pudo leer el progreso en vivo del servicio', error);
        throw error;
      }

      // La RPC es `RETURNS TABLE`: PostgREST devuelve un arreglo. Pedirla con
      // `.maybeSingle()` responde 406 aunque la fila exista.
      const [row] = (data ?? []) as ServiceLiveProgress[];
      return row ?? null;
    },
  });
