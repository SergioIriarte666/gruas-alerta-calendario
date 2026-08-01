-- El hito on_site deja de tener copia en service_tracking_links.
--
-- La migración 20260731180000 lo mudó a `services` y dejó las columnas del link
-- escribiéndose como ESPEJO, para no romper la edge function desplegada. El
-- espejo duró un día y ya se desincronizó: 4 de 8 links con servicio que tenía
-- hito quedaron en NULL, incluido 3266120-1 (servicio 12:32:12 UTC, link NULL).
-- Esos datos ya se repararon a mano; esto cierra la causa.
--
-- DECISIÓN: se ELIMINAN las columnas en vez de agregar un trigger que las
-- propague. La alternativa —un AFTER UPDATE OF on_site_reached_at ON services—
-- mantendría dos fuentes de verdad para el mismo hecho, y una copia que hay que
-- mantener sincronizada vuelve a desincronizarse: es exactamente el defecto que
-- se está cerrando, con un trigger encima.
--
-- Motivo por el que ahora se puede: la inspección del código muestra que ya no
-- queda ningún lector.
--   · compute_service_route_metrics  -> lee services (migración 20260731180000)
--   · compute-matched-route-metrics  -> reapuntado a services en este mismo commit
--   · service-tracking               -> reapuntado a services en este mismo commit
-- Las dos edge functions se DESPLIEGAN ANTES de aplicar esta migración: al
-- revés, quedarían pidiendo columnas que ya no existen.

BEGIN;

-- ---------------------------------------------------------------------------
-- El trigger de hitos deja de espejar al link.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_on_site_from_point()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_service record;
  v_distance_m double precision;
BEGIN
  BEGIN
    IF NEW.service_id IS NULL OR NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT s.status, s.origin_lat, s.origin_lng, s.on_site_reached_at, s.journey_stage_reached
    INTO v_service
    FROM public.services s
    WHERE s.id = NEW.service_id;

    IF NOT FOUND
       OR v_service.status NOT IN ('in_progress', 'inspection_completed')
       OR v_service.origin_lat IS NULL
       OR v_service.origin_lng IS NULL THEN
      RETURN NEW;
    END IF;

    -- El multidestino tiene su propio motor de hitos: los dos no pueden
    -- pisarse. Un servicio con paradas se rige por mark_reached_service_stops.
    IF EXISTS (SELECT 1 FROM public.service_stops st WHERE st.service_id = NEW.service_id) THEN
      RETURN NEW;
    END IF;

    v_distance_m := public.service_stops_distance_meters(
      NEW.latitude, NEW.longitude, v_service.origin_lat, v_service.origin_lng
    );

    -- SIEMPRE NEW.recorded_at, NUNCA now(): con el buffer offline un punto
    -- puede subirse minutos después de ser capturado y now() grabaría un hito
    -- falso. Por lo mismo el hito se corrige HACIA ATRÁS si llega un punto más
    -- antiguo que también califica: la llegada real es la primera, no la
    -- primera en subir.
    IF v_distance_m < 300
       AND (v_service.on_site_reached_at IS NULL OR NEW.recorded_at < v_service.on_site_reached_at) THEN
      UPDATE public.services
      SET on_site_reached_at = NEW.recorded_at,
          journey_stage_reached = CASE
            WHEN public.journey_stage_rank(journey_stage_reached) < public.journey_stage_rank('on_site')
              THEN 'on_site'
            ELSE journey_stage_reached
          END
      WHERE id = NEW.service_id;

    ELSIF v_service.on_site_reached_at IS NOT NULL AND v_distance_m > 500 THEN
      -- Ya estuvo en el origen y ahora se aleja: va cargado. La etapa nunca
      -- baja, por eso el UPDATE está condicionado al rango persistido.
      UPDATE public.services
      SET journey_stage_reached = 'towing'
      WHERE id = NEW.service_id
        AND public.journey_stage_rank(journey_stage_reached) < public.journey_stage_rank('towing');
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Un punto GPS jamás puede perderse por este trigger. El hito es
    -- informativo; la posición es el dato.
    NULL;
  END;

  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Los invalidadores dejan de limpiar columnas del link que ya no existen. El
-- hito en `services` lo sigue limpiando clear_service_milestone_on_reset
-- (BEFORE UPDATE), que no cambia.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invalidate_tracking_route_on_location_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.service_tracking_links
  SET eta_seconds = NULL,
      eta_distance_meters = NULL,
      eta_polyline = NULL,
      eta_cached_at = NULL,
      eta_target_stop_id = NULL,
      eta_target_kind = NULL
  WHERE service_id = NEW.id
    AND revoked_at IS NULL;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_tracking_lifecycle_when_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status::text = 'pending'
     AND OLD.status::text IS DISTINCT FROM 'pending' THEN
    UPDATE public.service_tracking_links
    SET
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
$function$;

-- ---------------------------------------------------------------------------
-- Fuera las copias.
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_tracking_links
  DROP COLUMN IF EXISTS on_site_reached_at,
  DROP COLUMN IF EXISTS max_stage_reached;

COMMIT;
