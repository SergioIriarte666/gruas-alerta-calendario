-- El pin real de un lugar y el punto que conoce el motor de rutas no siempre
-- coinciden (accesos privados, retornos nuevos, caminos internos o faenas).
-- El acceso vial es dato configurable del catálogo, nunca lógica por folio.

BEGIN;

ALTER TABLE public.saved_locations
  ADD COLUMN IF NOT EXISTS routing_access_latitude double precision,
  ADD COLUMN IF NOT EXISTS routing_access_longitude double precision;

ALTER TABLE public.service_tracking_links
  ADD COLUMN IF NOT EXISTS eta_routing_access_signature text;

COMMENT ON COLUMN public.saved_locations.routing_access_latitude IS
  'Latitud opcional del acceso vial usado sólo para calcular rutas; no mueve el pin real.';
COMMENT ON COLUMN public.saved_locations.routing_access_longitude IS
  'Longitud opcional del acceso vial usado sólo para calcular rutas; no mueve el pin real.';
COMMENT ON COLUMN public.service_tracking_links.eta_routing_access_signature IS
  'Firma de los accesos viales usados por el ETA cacheado; evita reutilizar una ruta con anclas distintas.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saved_locations_routing_access_pair_check'
      AND conrelid = 'public.saved_locations'::regclass
  ) THEN
    ALTER TABLE public.saved_locations
      ADD CONSTRAINT saved_locations_routing_access_pair_check
      CHECK (
        (routing_access_latitude IS NULL AND routing_access_longitude IS NULL)
        OR
        (routing_access_latitude IS NOT NULL AND routing_access_longitude IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saved_locations_routing_access_chile_check'
      AND conrelid = 'public.saved_locations'::regclass
  ) THEN
    ALTER TABLE public.saved_locations
      ADD CONSTRAINT saved_locations_routing_access_chile_check
      CHECK (
        routing_access_latitude IS NULL
        OR (
          routing_access_latitude BETWEEN -56.5 AND -17
          AND routing_access_longitude BETWEEN -76 AND -66
        )
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.invalidate_tracking_eta_on_routing_access_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_changed boolean;
BEGIN
  v_changed := CASE TG_OP
    WHEN 'INSERT' THEN
      NEW.routing_access_latitude IS NOT NULL
    WHEN 'DELETE' THEN
      OLD.routing_access_latitude IS NOT NULL
    ELSE
      OLD.routing_access_latitude IS DISTINCT FROM NEW.routing_access_latitude
      OR OLD.routing_access_longitude IS DISTINCT FROM NEW.routing_access_longitude
  END;

  IF v_changed THEN
    UPDATE public.service_tracking_links
    SET
      eta_seconds = NULL,
      eta_distance_meters = NULL,
      eta_polyline = NULL,
      eta_cached_at = NULL,
      eta_target_stop_id = NULL,
      eta_target_kind = NULL,
      eta_routing_access_signature = NULL
    WHERE revoked_at IS NULL
      AND expires_at > now();
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.invalidate_tracking_eta_on_routing_access_change() IS
  'Invalida rutas activas cuando cambia un acceso vial del catálogo.';

REVOKE ALL ON FUNCTION public.invalidate_tracking_eta_on_routing_access_change()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS invalidate_tracking_eta_on_routing_access_change_trigger
  ON public.saved_locations;
CREATE TRIGGER invalidate_tracking_eta_on_routing_access_change_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.saved_locations
FOR EACH ROW
EXECUTE FUNCTION public.invalidate_tracking_eta_on_routing_access_change();

-- Primera configuración operativa. Es una fila editable del catálogo, no una
-- excepción en el código: el ancla corresponde a la calzada de salida después
-- del retorno cercano a las instalaciones de G5N.
UPDATE public.saved_locations location
SET
  routing_access_latitude = -27.34747,
  routing_access_longitude = -70.63322,
  updated_at = now()
WHERE location.is_active
  AND (
    public.normalize_service_location_text(location.name) = 'gruas 5 norte'
    OR EXISTS (
      SELECT 1
      FROM unnest(coalesce(location.aliases, '{}'::text[])) alias
      WHERE public.normalize_service_location_text(alias) IN (
        'custodia g5n',
        'instalaciones g5n'
      )
    )
  );

COMMIT;
