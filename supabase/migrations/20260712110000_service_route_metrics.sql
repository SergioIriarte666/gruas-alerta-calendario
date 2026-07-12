BEGIN;

-- Métricas de recorrido (km y tiempo) por servicio, materializadas al cierre.
-- Los puntos GPS crudos en operator_location_points son efímeros (retención
-- 180 días via pg_cron operator-tracking-points-retention), así que esta
-- tabla es el registro permanente. Se calcula UNA vez al cerrar el servicio,
-- no on-demand.
CREATE TABLE IF NOT EXISTS public.service_route_metrics (
  service_id uuid PRIMARY KEY REFERENCES public.services(id) ON DELETE CASCADE,
  total_distance_km numeric(8,1) NOT NULL,
  total_duration_minutes integer NOT NULL,
  en_route_distance_km numeric(8,1),
  en_route_duration_minutes integer,
  towing_distance_km numeric(8,1),
  towing_duration_minutes integer,
  points_count integer NOT NULL,
  gaps_count integer NOT NULL,
  low_confidence boolean NOT NULL DEFAULT false,
  first_point_at timestamptz NOT NULL,
  last_point_at timestamptz NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_route_metrics ENABLE ROW LEVEL SECURITY;

-- Solo lectura desde el cliente (admin/viewer), siguiendo el patrón de
-- service_disputes. Las filas las escribe exclusivamente la función
-- compute_service_route_metrics (SECURITY DEFINER) via trigger o backfill.
DROP POLICY IF EXISTS "service_route_metrics_admin_select" ON public.service_route_metrics;
CREATE POLICY "service_route_metrics_admin_select"
  ON public.service_route_metrics
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "service_route_metrics_viewer_select" ON public.service_route_metrics;
CREATE POLICY "service_route_metrics_viewer_select"
  ON public.service_route_metrics
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'::public.app_role));

GRANT SELECT ON public.service_route_metrics TO authenticated;

-- Calcula (o recalcula, idempotente) las métricas de recorrido de un servicio
-- a partir de los puntos GPS del operador. Descarta tramos con velocidad
-- implícita > 150 km/h (jitter GPS / reconexión tras zona sin señal) para no
-- inflar la distancia; esos tramos igual cuentan como "gap" si superan 5 min.
CREATE OR REPLACE FUNCTION public.compute_service_route_metrics(p_service_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_points_count integer;
  v_first_point_at timestamptz;
  v_last_point_at timestamptz;
  v_on_site_at timestamptz;
  v_has_breakdown boolean;
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
  INTO v_points_count, v_first_point_at, v_last_point_at
  FROM public.operator_location_points
  WHERE service_id = p_service_id;

  IF v_points_count IS NULL OR v_points_count = 0 THEN
    RETURN;
  END IF;

  SELECT on_site_reached_at INTO v_on_site_at
  FROM public.service_tracking_links
  WHERE service_id = p_service_id AND on_site_reached_at IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  v_has_breakdown := v_on_site_at IS NOT NULL;

  FOR rec IN
    SELECT latitude, longitude, recorded_at
    FROM public.operator_location_points
    WHERE service_id = p_service_id
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

        IF v_has_breakdown THEN
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
    v_prev_at := rec.recorded_at;
  END LOOP;

  v_total_duration_minutes := ROUND(GREATEST(0, EXTRACT(EPOCH FROM (v_last_point_at - v_first_point_at)) / 60.0))::integer;

  IF v_has_breakdown THEN
    v_en_route_duration_minutes := ROUND(GREATEST(0, EXTRACT(EPOCH FROM (LEAST(v_on_site_at, v_last_point_at) - v_first_point_at)) / 60.0))::integer;
    v_towing_duration_minutes := GREATEST(0, v_total_duration_minutes - v_en_route_duration_minutes);
  END IF;

  v_low_confidence := v_points_count < 10 OR v_gaps_count > 3 OR v_total_duration_minutes < 5;

  INSERT INTO public.service_route_metrics (
    service_id, total_distance_km, total_duration_minutes,
    en_route_distance_km, en_route_duration_minutes,
    towing_distance_km, towing_duration_minutes,
    points_count, gaps_count, low_confidence,
    first_point_at, last_point_at, computed_at
  ) VALUES (
    p_service_id, ROUND(v_total_distance_km, 1), v_total_duration_minutes,
    CASE WHEN v_has_breakdown THEN ROUND(v_en_route_distance_km, 1) ELSE NULL END, v_en_route_duration_minutes,
    CASE WHEN v_has_breakdown THEN ROUND(v_towing_distance_km, 1) ELSE NULL END, v_towing_duration_minutes,
    v_points_count, v_gaps_count, v_low_confidence,
    v_first_point_at, v_last_point_at, now()
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

GRANT EXECUTE ON FUNCTION public.compute_service_route_metrics(uuid) TO authenticated;

-- Trigger separado de trg_revoke_tracking_links (no se toca ese trigger).
-- Se dispara al entrar a un estado final del servicio.
CREATE OR REPLACE FUNCTION public.trg_compute_route_metrics_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IN ('completed', 'cancelled', 'invoiced', 'partially_invoiced')
     AND OLD.status NOT IN ('completed', 'cancelled', 'invoiced', 'partially_invoiced') THEN
    PERFORM public.compute_service_route_metrics(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Igual que revoke_tracking_links_on_service_close: función de trigger
-- SECURITY DEFINER que no debe ser invocable directamente via RPC público.
REVOKE ALL ON FUNCTION public.trg_compute_route_metrics_fn() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_compute_route_metrics_fn() FROM anon;
REVOKE ALL ON FUNCTION public.trg_compute_route_metrics_fn() FROM authenticated;

DROP TRIGGER IF EXISTS trg_compute_route_metrics ON public.services;
CREATE TRIGGER trg_compute_route_metrics
  AFTER UPDATE OF status ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_compute_route_metrics_fn();

-- Backfill: servicios ya en estado final que tengan puntos GPS. Idempotente
-- (compute_service_route_metrics hace upsert y no inserta si no hay puntos).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT s.id
    FROM public.services s
    JOIN public.operator_location_points p ON p.service_id = s.id
    WHERE s.status IN ('completed', 'cancelled', 'invoiced', 'partially_invoiced')
  LOOP
    PERFORM public.compute_service_route_metrics(r.id);
  END LOOP;
END;
$$;

COMMIT;
