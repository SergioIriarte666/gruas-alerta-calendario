BEGIN;

-- Bloque 3 de la consolidación post primer servicio real (folio 2743720).
--
-- Problema: compute_service_route_metrics tomaba TODOS los puntos GPS asociados
-- al servicio sin acotarlos temporalmente. En el servicio real la sesión de
-- tracking se asoció al folio desde la noche ANTERIOR (cuando era "próximo
-- servicio"), así que la métrica salió con ~890 min y km contaminados.
--
-- Corrección:
--  a. Acotar los puntos a [transición real a in_progress, transición a estado
--     final], leídos de service_change_history. Fallback a primer/último punto
--     si no hay historial.
--  b. Duración total = ventana del servicio (inicio real -> cierre), NO max-min
--     de puntos: si el GPS muere antes del cierre, la duración igual es la real.
--  c. Desglose ida/traslado con on_site_reached_at: si el hito no existe O no hay
--     puntos posteriores al hito, dejar los campos de traslado en NULL (nunca 0
--     ni negativos) y marcar low_confidence=true.
--  d. low_confidence también true cuando el último punto precede al cierre por
--     más de 30 min (tramo final sin registro).
--
-- Referencia de calibración (folio 2743720, recálculo manual):
--   207.8 km ida / 306 min ida / traslado NULL / duración 581 min / low_confidence true.
CREATE OR REPLACE FUNCTION public.compute_service_route_metrics(p_service_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

  SELECT on_site_reached_at INTO v_on_site_at
  FROM public.service_tracking_links
  WHERE service_id = p_service_id AND on_site_reached_at IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

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
$$;

-- CREATE OR REPLACE conserva privilegios, pero se re-aplican explícitamente por
-- consistencia con el patrón del proyecto (función SECURITY DEFINER que escribe
-- bypassando RLS: nunca invocable por anon).
REVOKE ALL ON FUNCTION public.compute_service_route_metrics(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compute_service_route_metrics(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.compute_service_route_metrics(uuid) TO authenticated;

-- (e) Backfill idempotente: recalcular con la ventana acotada todos los
-- servicios que ya tienen métrica, más cualquier servicio en estado final con
-- puntos GPS que aún no la tenga.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT service_id AS id FROM public.service_route_metrics
    UNION
    SELECT DISTINCT s.id
    FROM public.services s
    JOIN public.operator_location_points p ON p.service_id = s.id
    WHERE s.status IN ('completed', 'cancelled', 'failed', 'invoiced', 'partially_invoiced')
  LOOP
    PERFORM public.compute_service_route_metrics(r.id);
  END LOOP;
END;
$$;

COMMIT;
