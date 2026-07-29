-- Volver un servicio a pending inicia un nuevo ciclo operacional. Los hitos
-- pegajosos del viaje anterior no pueden seguir publicados al cliente.

BEGIN;

CREATE OR REPLACE FUNCTION public.reset_tracking_lifecycle_when_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status::text = 'pending'
     AND OLD.status::text IS DISTINCT FROM 'pending' THEN
    UPDATE public.service_tracking_links
    SET
      on_site_reached_at = NULL,
      max_stage_reached = NULL,
      eta_seconds = NULL,
      eta_distance_meters = NULL,
      eta_polyline = NULL,
      eta_cached_at = NULL,
      eta_target_stop_id = NULL,
      eta_target_kind = NULL
    WHERE service_id = NEW.id
      AND revoked_at IS NULL;

    UPDATE public.service_stops
    SET
      armed_at = NULL,
      reached_at = NULL
    WHERE service_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.reset_tracking_lifecycle_when_pending() IS
  'Reinicia hitos, paradas y ETA cuando un servicio vuelve a pendiente.';

DROP TRIGGER IF EXISTS reset_tracking_lifecycle_when_pending_trigger
  ON public.services;
CREATE TRIGGER reset_tracking_lifecycle_when_pending_trigger
AFTER UPDATE OF status ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.reset_tracking_lifecycle_when_pending();

REVOKE ALL ON FUNCTION public.reset_tracking_lifecycle_when_pending()
  FROM PUBLIC, anon, authenticated;

-- Reparación inmediata para servicios que ya estaban pending al instalar esta
-- defensa (incluye el servicio de prueba TEST_GPS).
UPDATE public.service_tracking_links link
SET
  on_site_reached_at = NULL,
  max_stage_reached = NULL,
  eta_seconds = NULL,
  eta_distance_meters = NULL,
  eta_polyline = NULL,
  eta_cached_at = NULL,
  eta_target_stop_id = NULL,
  eta_target_kind = NULL
FROM public.services service
WHERE link.service_id = service.id
  AND service.status::text = 'pending'
  AND link.revoked_at IS NULL
  AND (
    link.on_site_reached_at IS NOT NULL
    OR link.max_stage_reached IS NOT NULL
    OR link.eta_seconds IS NOT NULL
    OR link.eta_distance_meters IS NOT NULL
    OR link.eta_polyline IS NOT NULL
    OR link.eta_cached_at IS NOT NULL
    OR link.eta_target_stop_id IS NOT NULL
    OR link.eta_target_kind IS NOT NULL
  );

UPDATE public.service_stops stop
SET
  armed_at = NULL,
  reached_at = NULL
FROM public.services service
WHERE stop.service_id = service.id
  AND service.status::text = 'pending'
  AND (stop.armed_at IS NOT NULL OR stop.reached_at IS NOT NULL);

COMMIT;
