import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/logger";

const logger = createLogger("useClientTrackingToken");

/**
 * Obtiene el token de seguimiento en vivo del servicio indicado, generándolo
 * si hace falta, a través de la RPC ownership-gated
 * `get_client_service_tracking_token` (el cliente solo puede pedir el token de
 * sus propios servicios).
 *
 * Degrada en silencio: si la función aún no está desplegada, el usuario no
 * tiene permiso, o el servicio no le pertenece, `data` queda undefined y quien
 * consume el hook debe caer a su comportamiento previo en vez de romper.
 */
export const useClientTrackingToken = (serviceId?: string) =>
  useQuery({
    queryKey: ["client-tracking-token", serviceId],
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_client_service_tracking_token",
        { p_service_id: serviceId! },
      );

      if (error) {
        // No es fatal: el hero seguirá mostrando el fallback.
        logger.debug("No se pudo obtener el token de seguimiento:", error.message);
        return null;
      }

      return (data as string | null) ?? null;
    },
  });
