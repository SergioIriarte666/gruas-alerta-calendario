import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useActiveServiceTrackingLink');

/**
 * ¿Este servicio tiene un link de seguimiento vivo?
 *
 * Importa para el formulario porque el trigger `validate_service_location_snapshot`
 * rechaza cualquier UPDATE que deje sin origen/destino confirmados a un servicio
 * con link activo. Saberlo antes permite bloquear en el wizard en vez de mostrar
 * el error de Postgres después de que el usuario ya escribió todo.
 *
 * Sólo los admin pueden leer `service_tracking_links` (RLS). Para el resto la
 * consulta devuelve vacío y el bloqueo lo termina haciendo la base.
 */
export const useActiveServiceTrackingLink = (serviceId?: string | null) => {
  return useQuery({
    queryKey: ['service-tracking-link-active', serviceId],
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_tracking_links')
        .select('id')
        .eq('service_id', serviceId as string)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .limit(1);

      if (error) {
        logger.warn('No se pudo consultar el link de seguimiento activo', error);
        throw error;
      }

      return (data?.length ?? 0) > 0;
    },
  });
};
