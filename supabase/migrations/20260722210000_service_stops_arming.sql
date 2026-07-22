BEGIN;

-- Guard de "armado" para paradas multidestino (bug SRV-6853): una parada solo
-- puede marcarse alcanzada DESPUÉS de que el móvil haya estado lejos de ella
-- (>1 km). Evita marcar paradas al crear el servicio con el móvil ya dentro
-- del geofence (p. ej. cargando el servicio en la base a metros de una parada
-- urbana). armed_at es sticky, mismo patrón que reached_at.
ALTER TABLE public.service_stops
  ADD COLUMN IF NOT EXISTS armed_at timestamptz;

-- Distancia haversine en metros (mismas constantes que el edge function).
CREATE OR REPLACE FUNCTION public.service_stops_distance_meters(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )));
$$;

-- Trigger sobre cada punto GPS: arma y marca paradas del servicio de la
-- sesión aunque nadie esté mirando la página pública (el edge function
-- service-tracking evalúa las mismas reglas en cada poll, como espejo).
-- Reglas:
--   · Armado: pendiente + sin armar + con coordenadas + punto a >1.000 m.
--   · Marcado (geofence directo o catch-up en orden): solo paradas ARMADAS
--     dentro de 300 m; se detiene en la primera pendiente no alcanzada para
--     no saltar el orden del itinerario.
-- Nunca debe romper la ingesta de GPS: todo el cuerpo va en un bloque con
-- EXCEPTION WHEN OTHERS THEN NULL.
CREATE OR REPLACE FUNCTION public.mark_reached_service_stops()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_service_id uuid;
  v_stop record;
BEGIN
  BEGIN
    IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT service_id INTO v_service_id
    FROM public.operator_location_sessions
    WHERE id = NEW.session_id;

    IF v_service_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Solo servicios en fase operacional (espejo de ACTIVE_TRACKING_STATUSES).
    IF NOT EXISTS (
      SELECT 1 FROM public.services
      WHERE id = v_service_id
        AND status IN ('pending', 'in_progress', 'inspection_completed')
    ) THEN
      RETURN NEW;
    END IF;

    -- Armado (sticky): el móvil estuvo a más de 1 km de la parada pendiente.
    UPDATE public.service_stops s
    SET armed_at = now()
    WHERE s.service_id = v_service_id
      AND s.reached_at IS NULL
      AND s.armed_at IS NULL
      AND s.lat IS NOT NULL
      AND s.lng IS NOT NULL
      AND public.service_stops_distance_meters(NEW.latitude, NEW.longitude, s.lat, s.lng) > 1000;

    -- Marcado en orden con catch-up: varias paradas pueden caer en el mismo
    -- radio; se corta en la primera que no cumple (armada + <300 m).
    FOR v_stop IN
      SELECT id, lat, lng, armed_at
      FROM public.service_stops
      WHERE service_id = v_service_id
        AND reached_at IS NULL
        AND lat IS NOT NULL
        AND lng IS NOT NULL
      ORDER BY stop_order
    LOOP
      IF v_stop.armed_at IS NOT NULL
        AND public.service_stops_distance_meters(NEW.latitude, NEW.longitude, v_stop.lat, v_stop.lng) < 300
      THEN
        UPDATE public.service_stops SET reached_at = now() WHERE id = v_stop.id;
      ELSE
        EXIT;
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_reached_service_stops ON public.operator_location_points;
CREATE TRIGGER trg_mark_reached_service_stops
  AFTER INSERT ON public.operator_location_points
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_reached_service_stops();

COMMIT;
