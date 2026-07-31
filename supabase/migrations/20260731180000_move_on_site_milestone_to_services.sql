-- El hito on_site se muda de service_tracking_links a services.
--
-- Vivía en el link porque nació con la página pública del cliente. Pero si
-- nunca se crea un link, el hito no tiene dónde guardarse: el trigger del
-- 31/07 arregló el caso "el cliente cerró la página" y NO el caso "nunca se
-- compartió el link", que con client_notifications_enabled = false por
-- defecto es el más común. Medido hoy en producción: 7 servicios con GPS sin
-- ningún link, 10 de 12 métricas con low_confidence, 8 sin desglose
-- ida/traslado.
--
-- Llegar al origen es un HECHO OPERACIONAL del servicio. El canal de
-- comunicación con el cliente no puede ser su dueño.
--
-- Las columnas homónimas de service_tracking_links se mantienen y se siguen
-- escribiendo como espejo: la edge function service-tracking desplegada
-- todavía las lee. El DROP va en una migración posterior, cuando esté
-- verificado en producción que nadie las consulta.

BEGIN;

-- ---------------------------------------------------------------------------
-- 2a. Nueva sede del hito.
-- ---------------------------------------------------------------------------
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS on_site_reached_at timestamptz,
  ADD COLUMN IF NOT EXISTS journey_stage_reached text;

COMMENT ON COLUMN public.services.on_site_reached_at IS
  'FUENTE DE VERDAD del hito de llegada al origen. Se graba con el recorded_at del punto GPS, nunca con now(), y puede corregirse hacia atrás si el buffer offline sube un punto anterior que también califica. La columna homónima de service_tracking_links quedó como legado/espejo.';

COMMENT ON COLUMN public.services.journey_stage_reached IS
  'FUENTE DE VERDAD de la etapa máxima alcanzada del viaje (orden en public.journey_stage_rank). Sólo avanza. service_tracking_links.max_stage_reached quedó como legado/espejo.';

-- ---------------------------------------------------------------------------
-- 2b. Backfill.
--
-- Los triggers de `services` se apagan sólo durante estas dos sentencias:
-- `prevent_disposed_crane_records` haría FALLAR el backfill de cualquier
-- servicio histórico cuya grúa fue vendida o dada de baja, y los de auditoría
-- (recovery_audit_services, track_service_changes) escribirían decenas de
-- filas de historial por un movimiento de datos que ningún usuario hizo.
-- ---------------------------------------------------------------------------
ALTER TABLE public.services DISABLE TRIGGER USER;

-- (i) Desde los links existentes: es el hito ya confirmado por la edge
--     function, y manda sobre cualquier reconstrucción.
UPDATE public.services s
SET on_site_reached_at = agg.hito,
    journey_stage_reached = agg.etapa
FROM (
  SELECT
    l.service_id,
    max(l.on_site_reached_at) AS hito,
    (array_agg(l.max_stage_reached ORDER BY public.journey_stage_rank(l.max_stage_reached) DESC))[1] AS etapa
  FROM public.service_tracking_links l
  WHERE l.on_site_reached_at IS NOT NULL
     OR l.max_stage_reached IS NOT NULL
  GROUP BY l.service_id
) agg
WHERE s.id = agg.service_id;

-- (ii) Reconstrucción desde el GPS para los que quedaron sin hito.
--
-- Sobre recorded_at, NUNCA created_at: con buffer offline la llegada real es
-- la primera CAPTURADA, no la primera en subir. El 31/07 llegaron 76 puntos
-- con hasta 388 s de atraso de subida.
--
-- Los servicios con paradas quedan fuera: ese flujo tiene su propio motor de
-- hitos (service_stops.reached_at) y no se toca desde aquí.
UPDATE public.services s
SET on_site_reached_at = calc.on_site_at,
    journey_stage_reached = CASE WHEN calc.se_alejo THEN 'towing' ELSE 'on_site' END
FROM (
  SELECT c.id, llegada.on_site_at, alejamiento.se_alejo
  FROM (
    SELECT s2.id, s2.origin_lat, s2.origin_lng
    FROM public.services s2
    WHERE s2.on_site_reached_at IS NULL
      AND s2.origin_lat IS NOT NULL
      AND s2.origin_lng IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.service_stops st WHERE st.service_id = s2.id)
  ) c
  CROSS JOIN LATERAL (
    SELECT min(p.recorded_at) AS on_site_at
    FROM public.operator_location_points p
    WHERE p.service_id = c.id
      AND p.latitude IS NOT NULL
      AND p.longitude IS NOT NULL
      AND public.service_stops_distance_meters(p.latitude, p.longitude, c.origin_lat, c.origin_lng) < 300
  ) llegada
  CROSS JOIN LATERAL (
    SELECT EXISTS (
      SELECT 1
      FROM public.operator_location_points p2
      WHERE p2.service_id = c.id
        AND p2.latitude IS NOT NULL
        AND p2.longitude IS NOT NULL
        AND p2.recorded_at > llegada.on_site_at
        AND public.service_stops_distance_meters(p2.latitude, p2.longitude, c.origin_lat, c.origin_lng) > 500
    ) AS se_alejo
  ) alejamiento
  WHERE llegada.on_site_at IS NOT NULL
) calc
WHERE s.id = calc.id;

ALTER TABLE public.services ENABLE TRIGGER USER;

-- ---------------------------------------------------------------------------
-- 2c. El trigger escribe en services y ya no necesita un link para actuar.
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
  v_new_stage text;
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
      v_new_stage := 'on_site';

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
      v_new_stage := 'towing';

      UPDATE public.services
      SET journey_stage_reached = 'towing'
      WHERE id = NEW.service_id
        AND public.journey_stage_rank(journey_stage_reached) < public.journey_stage_rank('towing');
    END IF;

    -- Espejo hacia el link vigente mientras la edge function desplegada siga
    -- leyendo sus columnas. Es copia, no fuente: si no hay link, el hito ya
    -- quedó guardado igual, que es el punto entero de esta migración.
    IF v_new_stage IS NOT NULL THEN
      UPDATE public.service_tracking_links l
      SET on_site_reached_at = CASE
            WHEN v_new_stage = 'on_site' THEN NEW.recorded_at
            ELSE l.on_site_reached_at
          END,
          max_stage_reached = CASE
            WHEN public.journey_stage_rank(l.max_stage_reached) < public.journey_stage_rank(v_new_stage)
              THEN v_new_stage
            ELSE l.max_stage_reached
          END
      WHERE l.service_id = NEW.service_id
        AND l.revoked_at IS NULL;
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
-- Invalidación del hito EN LA FUENTE.
--
-- Ya existen dos invalidadores (invalidate_tracking_route_on_location_change y
-- reset_tracking_lifecycle_when_pending) que limpian las columnas del link.
-- Ambos son AFTER: no pueden tocar la fila de `services` sin un UPDATE
-- recursivo que además dispararía toda la auditoría. Este es un BEFORE que
-- viaja en el MISMO UPDATE, sin fila extra ni historial falso.
--
-- Si no existiera, mover el hito habría dejado a los invalidadores borrando
-- sólo la copia y conservando viva la fuente: exactamente al revés.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clear_service_milestone_on_reset()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Origen movido: el hito se midió contra un punto que ya no es el origen.
  IF NEW.origin IS DISTINCT FROM OLD.origin
     OR NEW.origin_lat IS DISTINCT FROM OLD.origin_lat
     OR NEW.origin_lng IS DISTINCT FROM OLD.origin_lng THEN
    NEW.on_site_reached_at := NULL;
    NEW.journey_stage_reached := NULL;
  END IF;

  -- `pending` es una asignación nueva, no la continuación del viaje anterior.
  IF NEW.status::text = 'pending' AND OLD.status::text IS DISTINCT FROM 'pending' THEN
    NEW.on_site_reached_at := NULL;
    NEW.journey_stage_reached := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_clear_service_milestone_on_reset ON public.services;
CREATE TRIGGER trg_clear_service_milestone_on_reset
  BEFORE UPDATE OF origin, origin_lat, origin_lng, status ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.clear_service_milestone_on_reset();

-- ---------------------------------------------------------------------------
-- 2d. El cálculo de métricas lee el hito desde services.
--
-- Cambia UNA cosa: de dónde sale v_on_site_at. Todo lo demás —umbral de
-- 150 km/h, gap de 5 min, ventana operacional, redondeos y las reglas de
-- low_confidence— queda idéntico a propósito: si algo más se moviera, los
-- números históricos dejarían de ser comparables.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_service_route_metrics(p_service_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_overall_count integer;
  v_overall_first timestamptz;
  v_overall_last timestamptz;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_on_site_at timestamptz;
  v_has_onsite boolean;
  v_points_after_onsite integer := 0;
  v_inwindow_count integer;
  v_win_first timestamptz;
  v_win_last timestamptz;
  v_total_distance_km numeric := 0;
  v_en_route_distance_km numeric := 0;
  v_towing_distance_km numeric := 0;
  v_total_duration_minutes integer;
  v_en_route_duration_minutes integer;
  v_towing_duration_minutes integer;
  v_gaps_count integer := 0;
  v_low_confidence boolean;
  rec record;
  v_prev_lat double precision;
  v_prev_lng double precision;
  v_prev_at timestamptz;
  v_seg_km numeric;
  v_seg_minutes numeric;
  v_seg_speed_kmh numeric;
BEGIN
  SELECT count(*), min(recorded_at), max(recorded_at)
  INTO v_overall_count, v_overall_first, v_overall_last
  FROM public.operator_location_points
  WHERE service_id = p_service_id;

  IF v_overall_count IS NULL OR v_overall_count = 0 THEN
    RETURN;
  END IF;

  -- (a) Inicio real: primera transición a in_progress (fallback: primer punto).
  SELECT min(changed_at) INTO v_start_at
  FROM public.service_change_history
  WHERE service_id = p_service_id
    AND field_name = 'status'
    AND new_value = 'in_progress';

  -- (a) Cierre real: primera transición a un estado final operacional posterior
  -- al inicio (fallback: último punto). Los estados administrativos posteriores
  -- (invoiced/partially_invoiced) NO cuentan como cierre operacional.
  SELECT min(changed_at) INTO v_end_at
  FROM public.service_change_history
  WHERE service_id = p_service_id
    AND field_name = 'status'
    AND new_value IN ('completed', 'cancelled', 'failed')
    AND (v_start_at IS NULL OR changed_at >= v_start_at);

  v_start_at := COALESCE(v_start_at, v_overall_first);
  v_end_at   := COALESCE(v_end_at, v_overall_last);

  -- Ventana inválida (sin historial coherente): caer al rango completo de puntos.
  IF v_end_at <= v_start_at THEN
    v_start_at := v_overall_first;
    v_end_at   := v_overall_last;
  END IF;

  -- Puntos acotados a la ventana operacional.
  SELECT count(*), min(recorded_at), max(recorded_at)
  INTO v_inwindow_count, v_win_first, v_win_last
  FROM public.operator_location_points
  WHERE service_id = p_service_id
    AND recorded_at >= v_start_at
    AND recorded_at <= v_end_at;

  -- Desalineación total (la ventana no contiene puntos): usar el rango completo
  -- para no perder el registro y marcar como baja confianza más abajo.
  IF v_inwindow_count IS NULL OR v_inwindow_count = 0 THEN
    v_start_at       := v_overall_first;
    v_end_at         := v_overall_last;
    v_inwindow_count := v_overall_count;
    v_win_first      := v_overall_first;
    v_win_last       := v_overall_last;
  END IF;

  -- El hito vive en el SERVICIO: antes salía del link de seguimiento y por eso
  -- un servicio cuyo link nunca se creó quedaba sin desglose ida/traslado.
  SELECT on_site_reached_at INTO v_on_site_at
  FROM public.services
  WHERE id = p_service_id;

  -- (c) El hito solo es válido para el desglose si cae dentro de la ventana.
  v_has_onsite := v_on_site_at IS NOT NULL
                  AND v_on_site_at >= v_start_at
                  AND v_on_site_at <= v_end_at;

  IF v_has_onsite THEN
    SELECT count(*) INTO v_points_after_onsite
    FROM public.operator_location_points
    WHERE service_id = p_service_id
      AND recorded_at > v_on_site_at
      AND recorded_at <= v_end_at;
  END IF;

  -- Suma de segmentos SOLO dentro de la ventana. Descarta tramos con velocidad
  -- implícita > 150 km/h (jitter GPS / reconexión) para no inflar la distancia;
  -- esos tramos igual cuentan como "gap" si superan 5 min.
  FOR rec IN
    SELECT latitude, longitude, recorded_at
    FROM public.operator_location_points
    WHERE service_id = p_service_id
      AND recorded_at >= v_start_at
      AND recorded_at <= v_end_at
    ORDER BY recorded_at ASC
  LOOP
    IF v_prev_at IS NOT NULL THEN
      v_seg_minutes := EXTRACT(EPOCH FROM (rec.recorded_at - v_prev_at)) / 60.0;

      IF v_seg_minutes > 5 THEN
        v_gaps_count := v_gaps_count + 1;
      END IF;

      v_seg_km := 6371 * 2 * asin(sqrt(
        power(sin(radians(rec.latitude - v_prev_lat) / 2), 2) +
        cos(radians(v_prev_lat)) * cos(radians(rec.latitude)) *
        power(sin(radians(rec.longitude - v_prev_lng) / 2), 2)
      ));

      v_seg_speed_kmh := CASE WHEN v_seg_minutes > 0 THEN v_seg_km / (v_seg_minutes / 60.0) ELSE 0 END;

      IF v_seg_speed_kmh <= 150 THEN
        v_total_distance_km := v_total_distance_km + v_seg_km;

        IF v_has_onsite THEN
          IF rec.recorded_at <= v_on_site_at THEN
            v_en_route_distance_km := v_en_route_distance_km + v_seg_km;
          ELSE
            v_towing_distance_km := v_towing_distance_km + v_seg_km;
          END IF;
        END IF;
      END IF;
    END IF;

    v_prev_lat := rec.latitude;
    v_prev_lng := rec.longitude;
    v_prev_at  := rec.recorded_at;
  END LOOP;

  -- (b) Duración total = ventana operacional, con redondeo hacia arriba (CEIL).
  v_total_duration_minutes := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_end_at - v_start_at)) / 60.0))::integer;

  IF v_has_onsite THEN
    -- Ida: inicio real -> hito (acotado a la ventana).
    v_en_route_duration_minutes := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (LEAST(v_on_site_at, v_end_at) - v_start_at)) / 60.0))::integer;

    -- (c) Traslado: solo si hay puntos posteriores al hito. Si no, dejar en NULL
    -- (nunca 0 ni negativo) porque no se registró el tramo de traslado.
    IF v_points_after_onsite > 0 THEN
      v_towing_duration_minutes := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_end_at - v_on_site_at)) / 60.0))::integer;
    ELSE
      v_towing_duration_minutes := NULL;
      v_towing_distance_km := NULL;
    END IF;
  ELSE
    -- Sin hito válido no se puede separar ida/traslado.
    v_en_route_duration_minutes := NULL;
    v_towing_duration_minutes := NULL;
  END IF;

  -- (c)+(d) Baja confianza: pocos puntos, muchos gaps, ventana mínima, hito
  -- ausente, sin puntos tras el hito, o el último punto precede al cierre por
  -- más de 30 min (tramo final sin registro).
  v_low_confidence :=
    v_inwindow_count < 10
    OR v_gaps_count > 3
    OR v_total_duration_minutes < 5
    OR NOT v_has_onsite
    OR (v_has_onsite AND v_points_after_onsite = 0)
    OR (v_win_last < v_end_at - interval '30 minutes');

  INSERT INTO public.service_route_metrics (
    service_id, total_distance_km, total_duration_minutes,
    en_route_distance_km, en_route_duration_minutes,
    towing_distance_km, towing_duration_minutes,
    points_count, gaps_count, low_confidence,
    first_point_at, last_point_at, computed_at
  ) VALUES (
    p_service_id, ROUND(v_total_distance_km, 1), v_total_duration_minutes,
    CASE WHEN v_has_onsite THEN ROUND(v_en_route_distance_km, 1) ELSE NULL END,
    v_en_route_duration_minutes,
    CASE WHEN v_has_onsite AND v_points_after_onsite > 0 THEN ROUND(v_towing_distance_km, 1) ELSE NULL END,
    v_towing_duration_minutes,
    v_inwindow_count, v_gaps_count, v_low_confidence,
    v_win_first, v_win_last, now()
  )
  ON CONFLICT (service_id) DO UPDATE SET
    total_distance_km = EXCLUDED.total_distance_km,
    total_duration_minutes = EXCLUDED.total_duration_minutes,
    en_route_distance_km = EXCLUDED.en_route_distance_km,
    en_route_duration_minutes = EXCLUDED.en_route_duration_minutes,
    towing_distance_km = EXCLUDED.towing_distance_km,
    towing_duration_minutes = EXCLUDED.towing_duration_minutes,
    points_count = EXCLUDED.points_count,
    gaps_count = EXCLUDED.gaps_count,
    low_confidence = EXCLUDED.low_confidence,
    first_point_at = EXCLUDED.first_point_at,
    last_point_at = EXCLUDED.last_point_at,
    computed_at = EXCLUDED.computed_at;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2f. Recalcular las métricas ya existentes con el hito recuperado.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_id uuid;
BEGIN
  FOR v_id IN SELECT service_id FROM public.service_route_metrics LOOP
    PERFORM public.compute_service_route_metrics(v_id);
  END LOOP;
END;
$$;

COMMIT;
