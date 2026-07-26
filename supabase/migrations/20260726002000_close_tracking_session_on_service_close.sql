-- El cierre de la sesión de tracking al completar el servicio deja de depender
-- del WebView.
--
-- Prueba en terreno del 25/07: al cerrar el servicio, el primer intento no
-- generó el PDF de entrega ni cerró la sesión (WebView zombi); un reintento 18
-- min después completó todo. Mientras tanto la sesión seguía `active` y la
-- central seguía viendo una grúa "transmitiendo" un servicio ya terminado.
--
-- El cierre del servicio ya cierra detenciones (close_stop_events_on_service_
-- close) y revoca links (revoke_tracking_links_on_service_close). La sesión de
-- ubicación es la tercera pieza del mismo hecho y le faltaba: ahora viaja en la
-- misma transacción, del lado del servidor, pase lo que pase con el teléfono.

BEGIN;

CREATE OR REPLACE FUNCTION public.close_location_sessions_on_service_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status::text IN ('completed', 'cancelled', 'failed') THEN
    UPDATE public.operator_location_sessions
    SET status = 'stopped',
        ended_at = now(),
        ended_reason = 'service_closed'
    WHERE service_id = NEW.id
      AND status = 'active';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.close_location_sessions_on_service_close() IS
  'Cierra las sesiones de ubicación del servicio cuando este termina. Server-side a propósito: el corte no puede depender de que la app del operador siga viva al final del flujo de entrega.';

DROP TRIGGER IF EXISTS trg_close_location_sessions_on_service_close ON public.services;
CREATE TRIGGER trg_close_location_sessions_on_service_close
  AFTER UPDATE OF status ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.close_location_sessions_on_service_close();

REVOKE ALL ON FUNCTION public.close_location_sessions_on_service_close() FROM PUBLIC, anon, authenticated;

-- Higiene: sesiones que quedaron colgadas de servicios ya cerrados (idempotente).
UPDATE public.operator_location_sessions s
SET status = 'stopped',
    ended_at = COALESCE(s.last_point_at, s.started_at),
    ended_reason = 'service_closed'
FROM public.services sv
WHERE s.service_id = sv.id
  AND s.status = 'active'
  AND sv.status IN ('completed', 'cancelled', 'failed');

COMMIT;
