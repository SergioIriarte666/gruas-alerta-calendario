BEGIN;

-- Fase 2 seguimiento publico: cache de ETA (Routes API) y el hito on_site
-- usado para derivar journey_stage server-side en la Edge Function service-tracking.
ALTER TABLE public.service_tracking_links
  ADD COLUMN IF NOT EXISTS eta_seconds integer,
  ADD COLUMN IF NOT EXISTS eta_distance_meters integer,
  ADD COLUMN IF NOT EXISTS eta_polyline text,
  ADD COLUMN IF NOT EXISTS eta_cached_at timestamptz,
  ADD COLUMN IF NOT EXISTS on_site_reached_at timestamptz;

-- Ciclo de vida del token: al cerrar el servicio (completed/cancelled), revocar
-- cualquier link de seguimiento activo. service-tracking ya chequea revoked_at
-- (Fase 1), asi que esto basta para cortar el acceso publico sin tocar la funcion.
CREATE OR REPLACE FUNCTION public.revoke_tracking_links_on_service_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IN ('completed', 'cancelled') AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.service_tracking_links
    SET revoked_at = now()
    WHERE service_id = NEW.id AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_revoke_tracking_links ON public.services;
CREATE TRIGGER trg_revoke_tracking_links
  AFTER UPDATE OF status ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.revoke_tracking_links_on_service_close();

COMMIT;
