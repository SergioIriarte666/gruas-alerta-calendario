-- Dos defectos de las métricas de ruta, encontrados sobre el servicio 3266120-1.
--
-- 1. No se descuentan las detenciones declaradas. El tramo de traslado aparece
--    a 38,0 km/h —que sugiere una grúa lenta— cuando la velocidad real fue
--    53,4 km/h: 124 de sus 428 minutos fueron una `ruta_cortada`. Cualquier
--    análisis de costo por hora o de productividad hecho sobre eso está
--    sesgado, y el sesgo castiga justamente al operador que declaró la parada.
--
-- 2. Las métricas matched (Mapbox) no se invalidan al recalcular las crudas.
--    Todas las crudas se recomputaron el 31/07 y las matched quedaron con
--    fecha del 24 al 30, conviviendo con valores incoherentes: 3262047-1 con
--    30,0 km crudos y 6,5 matched; SRV-6856 con 4,5 y 0,1.

BEGIN;

-- ---------------------------------------------------------------------------
-- Columnas nuevas.
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_route_metrics
  ADD COLUMN IF NOT EXISTS stopped_minutes integer,
  ADD COLUMN IF NOT EXISTS en_route_stopped_minutes integer,
  ADD COLUMN IF NOT EXISTS towing_stopped_minutes integer,
  ADD COLUMN IF NOT EXISTS moving_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS matched_skipped_reason text;

COMMENT ON COLUMN public.service_route_metrics.stopped_minutes IS
  'Minutos de detenciones DECLARADAS (service_stop_events) dentro de la ventana operacional. No incluye el vehículo simplemente quieto: sólo lo que el operador registró.';
COMMENT ON COLUMN public.service_route_metrics.moving_duration_minutes IS
  'total_duration_minutes - stopped_minutes. Es el denominador honesto para velocidad y productividad.';
COMMENT ON COLUMN public.service_route_metrics.en_route_stopped_minutes IS
  'Parte de stopped_minutes anterior al hito on_site. NULL cuando no hay hito válido, nunca 0.';
COMMENT ON COLUMN public.service_route_metrics.towing_stopped_minutes IS
  'Parte de stopped_minutes posterior al hito on_site. NULL cuando no hay hito válido, nunca 0.';
COMMENT ON COLUMN public.service_route_metrics.matched_skipped_reason IS
  'Por qué no hay distancia matched: low_confidence, insufficient_points o api_error. NULL cuando el match sirvió.';

-- ---------------------------------------------------------------------------
-- compute_service_route_metrics: se agrega el descuento de detenciones y la
-- invalidación de las matched. NO se toca la ventana operacional (arranque en
-- in_progress, cierre en completed/cancelled/failed), ni el descarte de tramos
-- > 150 km/h, ni el gap de 5 min, ni las reglas de low_confidence: están
-- validados contra datos reales.
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
  v_stopped_seconds numeric := 0;
  v_en_route_stopped_seconds numeric := 0;
  v_stopped_minutes integer := 0;
  v_en_route_stopped_minutes integer;
  v_towing_stopped_minutes integer;
  v_moving_duration_minutes integer;
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

  -- Detenciones DECLARADAS, recortadas a la ventana operacional. Una detención
  -- todavía abierta al cierre se corta en v_end_at. La que cruza el hito se
  -- parte en dos: lo anterior es ida, lo posterior traslado.
  SELECT
    COALESCE(SUM(EXTRACT(EPOCH FROM (ov.ov_end - ov.ov_start))), 0),
    COALESCE(SUM(
      CASE
        WHEN NOT v_has_onsite THEN 0
        WHEN ov.ov_start >= v_on_site_at THEN 0
        ELSE EXTRACT(EPOCH FROM (LEAST(ov.ov_end, v_on_site_at) - ov.ov_start))
      END
    ), 0)
  INTO v_stopped_seconds, v_en_route_stopped_seconds
  FROM (
    SELECT
      GREATEST(e.started_at, v_start_at) AS ov_start,
      LEAST(COALESCE(e.ended_at, v_end_at), v_end_at) AS ov_end
    FROM public.service_stop_events e
    WHERE e.service_id = p_service_id
  ) ov
  WHERE ov.ov_end > ov.ov_start;

  v_stopped_minutes := GREATEST(0, ROUND(v_stopped_seconds / 60.0))::integer;

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
  v_moving_duration_minutes := GREATEST(0, v_total_duration_minutes - v_stopped_minutes);

  IF v_has_onsite THEN
    -- Ida: inicio real -> hito (acotado a la ventana).
    v_en_route_duration_minutes := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (LEAST(v_on_site_at, v_end_at) - v_start_at)) / 60.0))::integer;

    -- El reparto se cierra por resta para que las dos partes SIEMPRE sumen el
    -- total: dos redondeos independientes se desalinean y dejan un minuto
    -- huérfano que después nadie sabe explicar.
    v_en_route_stopped_minutes := LEAST(
      v_stopped_minutes,
      GREATEST(0, ROUND(v_en_route_stopped_seconds / 60.0))::integer
    );
    v_towing_stopped_minutes := v_stopped_minutes - v_en_route_stopped_minutes;

    -- (c) Traslado: solo si hay puntos posteriores al hito. Si no, dejar en NULL
    -- (nunca 0 ni negativo) porque no se registró el tramo de traslado.
    IF v_points_after_onsite > 0 THEN
      v_towing_duration_minutes := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_end_at - v_on_site_at)) / 60.0))::integer;
    ELSE
      v_towing_duration_minutes := NULL;
      v_towing_distance_km := NULL;
    END IF;
  ELSE
    -- Sin hito válido no se puede separar ida/traslado. Mismo criterio para las
    -- detenciones: el total sí se conoce, el reparto no.
    v_en_route_duration_minutes := NULL;
    v_towing_duration_minutes := NULL;
    v_en_route_stopped_minutes := NULL;
    v_towing_stopped_minutes := NULL;
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
    first_point_at, last_point_at, computed_at,
    stopped_minutes, en_route_stopped_minutes, towing_stopped_minutes,
    moving_duration_minutes
  ) VALUES (
    p_service_id, ROUND(v_total_distance_km, 1), v_total_duration_minutes,
    CASE WHEN v_has_onsite THEN ROUND(v_en_route_distance_km, 1) ELSE NULL END,
    v_en_route_duration_minutes,
    CASE WHEN v_has_onsite AND v_points_after_onsite > 0 THEN ROUND(v_towing_distance_km, 1) ELSE NULL END,
    v_towing_duration_minutes,
    v_inwindow_count, v_gaps_count, v_low_confidence,
    v_win_first, v_win_last, now(),
    v_stopped_minutes, v_en_route_stopped_minutes, v_towing_stopped_minutes,
    v_moving_duration_minutes
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
    computed_at = EXCLUDED.computed_at,
    stopped_minutes = EXCLUDED.stopped_minutes,
    en_route_stopped_minutes = EXCLUDED.en_route_stopped_minutes,
    towing_stopped_minutes = EXCLUDED.towing_stopped_minutes,
    moving_duration_minutes = EXCLUDED.moving_duration_minutes,
    -- Las matched describen ESTOS mismos puntos por vía. Si las crudas se
    -- recalculan, las matched dejan de corresponder al mismo cálculo y hay que
    -- rehacerlas: ponerlas en NULL las devuelve a la cola del sweeper, que sólo
    -- mira filas con matched_computed_at IS NULL. Sin esto quedaban congeladas
    -- para siempre contradiciendo a las crudas.
    matched_total_distance_km = NULL,
    matched_en_route_distance_km = NULL,
    matched_towing_distance_km = NULL,
    matching_confidence = NULL,
    matched_computed_at = NULL,
    matched_skipped_reason = NULL;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Backfill.
--
-- Recalcular reescribe las crudas CON detenciones y, por el ON CONFLICT de
-- arriba, deja las matched en NULL: el sweeper de 10 min las reprocesa solo.
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

-- Red de seguridad para filas que el recálculo no haya tocado (por ejemplo,
-- métricas cuyo servicio se quedó sin puntos y la función retorna temprano).
UPDATE public.service_route_metrics
SET matched_total_distance_km = NULL,
    matched_en_route_distance_km = NULL,
    matched_towing_distance_km = NULL,
    matching_confidence = NULL,
    matched_computed_at = NULL,
    matched_skipped_reason = NULL
WHERE matched_computed_at IS NOT NULL
  AND matched_computed_at < computed_at;

COMMIT;
