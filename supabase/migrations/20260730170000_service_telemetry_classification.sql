BEGIN;

-- La categoría comercial y los campos obligatorios no describen por sí solos
-- si un servicio debe generar GPS. La clasificación queda explícita en el tipo
-- y se copia al servicio para preservar el criterio histórico.
ALTER TABLE public.service_types
  ADD COLUMN IF NOT EXISTS telemetry_mode text;

UPDATE public.service_types
SET telemetry_mode = CASE
  WHEN is_outsourced OR service_category = 'externo_tercero' THEN 'external'
  WHEN crane_required THEN 'crane'
  WHEN operator_required THEN 'operator'
  ELSE 'none'
END
WHERE telemetry_mode IS NULL;

ALTER TABLE public.service_types
  ALTER COLUMN telemetry_mode SET DEFAULT 'none',
  ALTER COLUMN telemetry_mode SET NOT NULL;

ALTER TABLE public.service_types
  DROP CONSTRAINT IF EXISTS service_types_telemetry_mode_check;

ALTER TABLE public.service_types
  ADD CONSTRAINT service_types_telemetry_mode_check
  CHECK (telemetry_mode IN ('none', 'operator', 'crane', 'external'));

COMMENT ON COLUMN public.service_types.telemetry_mode IS
  'Política configurable del tipo: none, operator, crane o external.';

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS telemetry_mode text;

-- Es un backfill técnico de una columna nueva: no cambia estado, asignación,
-- grúa ni datos comerciales. Se suspenden temporalmente los triggers de usuario
-- para no disparar auditorías/notificaciones masivas y para permitir completar
-- snapshots de servicios históricos ligados a grúas hoy vendidas. Las
-- restricciones y FKs permanecen activas; ALTER TABLE es transaccional, por lo
-- que un error también revierte este cambio de estado de los triggers.
ALTER TABLE public.services DISABLE TRIGGER USER;

UPDATE public.services service
SET telemetry_mode = type.telemetry_mode
FROM public.service_types type
WHERE type.id = service.service_type_id
  AND service.telemetry_mode IS NULL;

UPDATE public.services
SET telemetry_mode = 'none'
WHERE telemetry_mode IS NULL;

ALTER TABLE public.services ENABLE TRIGGER USER;

ALTER TABLE public.services
  ALTER COLUMN telemetry_mode SET DEFAULT 'none',
  ALTER COLUMN telemetry_mode SET NOT NULL;

ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_telemetry_mode_check;

ALTER TABLE public.services
  ADD CONSTRAINT services_telemetry_mode_check
  CHECK (telemetry_mode IN ('none', 'operator', 'crane', 'external'));

COMMENT ON COLUMN public.services.telemetry_mode IS
  'Snapshot histórico de la política de telemetría vigente al crear o cambiar el tipo del servicio.';

CREATE OR REPLACE FUNCTION public.set_service_telemetry_mode_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.service_type_id IS DISTINCT FROM OLD.service_type_id THEN
    SELECT type.telemetry_mode
    INTO NEW.telemetry_mode
    FROM public.service_types type
    WHERE type.id = NEW.service_type_id;

    NEW.telemetry_mode := COALESCE(NEW.telemetry_mode, 'none');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_service_telemetry_mode_snapshot ON public.services;
CREATE TRIGGER trg_set_service_telemetry_mode_snapshot
  BEFORE INSERT OR UPDATE OF service_type_id
  ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.set_service_telemetry_mode_snapshot();

CREATE INDEX IF NOT EXISTS idx_services_service_date_telemetry_mode
  ON public.services (service_date DESC, telemetry_mode);

-- Devuelve una fila agregada por servicio. Los puntos crudos permanecen como
-- evidencia, pero velocidad, distancia y cobertura solo usan coordenadas con
-- precisión declarada <= 50 m y dentro de Chile.
CREATE OR REPLACE FUNCTION public.get_service_telemetry(
  p_date_from date,
  p_date_to date,
  p_speed_limit_kmh double precision DEFAULT 80
)
RETURNS TABLE (
  service_id uuid,
  service_date date,
  folio text,
  service_status text,
  service_type_name text,
  telemetry_mode text,
  operator_id uuid,
  operator_name text,
  crane_id uuid,
  crane_label text,
  tracking_expected boolean,
  operational_started_at timestamptz,
  start_at timestamptz,
  end_at timestamptz,
  total_duration_minutes integer,
  reliable_distance_km double precision,
  raw_points_count bigint,
  trusted_points_count bigint,
  gaps_count integer,
  low_confidence boolean,
  max_speed_kmh double precision,
  average_moving_speed_kmh double precision,
  percentile95_speed_kmh double precision,
  over_limit_episodes bigint,
  speed_samples_count bigint,
  coverage_status text,
  unexpected_telemetry boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH selected_services AS (
    SELECT
      service.id,
      service.service_date,
      service.folio,
      service.status::text AS service_status,
      btrim(type.name) AS service_type_name,
      service.telemetry_mode,
      COALESCE(service.operator_id, reporter.operator_id) AS operator_id,
      COALESCE(assigned_operator.name, reporter_operator.name, 'Sin operador asignado') AS operator_name,
      service.crane_id,
      COALESCE(upper(crane.license_plate), 'Sin grúa asignada') AS crane_label,
      history.started_at AS operational_started_at,
      history.ended_at AS operational_ended_at,
      route.total_duration_minutes AS route_duration_minutes,
      route.first_point_at AS route_first_point_at,
      route.last_point_at AS route_last_point_at,
      route.low_confidence AS route_low_confidence,
      point_bounds.first_point_at,
      point_bounds.last_point_at,
      (
        service.telemetry_mode IN ('operator', 'crane')
        AND (
          history.started_at IS NOT NULL
          OR service.status::text IN (
            'in_progress',
            'inspection_completed',
            'completed',
            'invoiced',
            'with_purchase_order',
            'failed'
          )
        )
      ) AS tracking_expected
    FROM public.services service
    JOIN public.service_types type
      ON type.id = service.service_type_id
    LEFT JOIN public.operators assigned_operator
      ON assigned_operator.id = service.operator_id
    LEFT JOIN public.cranes crane
      ON crane.id = service.crane_id
    LEFT JOIN public.service_route_metrics route
      ON route.service_id = service.id
    LEFT JOIN LATERAL (
      SELECT
        min(change.changed_at) FILTER (
          WHERE change.new_value = 'in_progress'
        ) AS started_at,
        min(change.changed_at) FILTER (
          WHERE change.new_value IN ('completed', 'cancelled', 'failed')
        ) AS ended_at
      FROM public.service_change_history change
      WHERE change.service_id = service.id
        AND change.field_name = 'status'
    ) history ON true
    LEFT JOIN LATERAL (
      SELECT
        min(point.recorded_at) AS first_point_at,
        max(point.recorded_at) AS last_point_at
      FROM public.operator_location_points point
      WHERE point.service_id = service.id
    ) point_bounds ON true
    LEFT JOIN LATERAL (
      SELECT point.operator_id
      FROM public.operator_location_points point
      WHERE point.service_id = service.id
      ORDER BY point.recorded_at ASC
      LIMIT 1
    ) reporter ON true
    LEFT JOIN public.operators reporter_operator
      ON reporter_operator.id = reporter.operator_id
    WHERE service.service_date BETWEEN p_date_from AND p_date_to
      AND (
        service.telemetry_mode IN ('operator', 'crane')
        OR point_bounds.first_point_at IS NOT NULL
      )
  ),
  bounded_services AS (
    SELECT
      selected.*,
      COALESCE(
        selected.operational_started_at,
        selected.route_first_point_at,
        selected.first_point_at
      ) AS window_start,
      COALESCE(
        CASE
          WHEN selected.operational_ended_at >= selected.operational_started_at
            THEN selected.operational_ended_at
          ELSE NULL
        END,
        selected.route_last_point_at,
        selected.last_point_at
      ) AS window_end
    FROM selected_services selected
  ),
  raw_points AS (
    SELECT
      bounded.id AS service_id,
      point.latitude,
      point.longitude,
      point.accuracy_meters,
      point.speed_mps,
      point.recorded_at,
      public.is_trusted_live_location_point(
        point.latitude,
        point.longitude,
        point.accuracy_meters
      ) AS trusted
    FROM bounded_services bounded
    JOIN public.operator_location_points point
      ON point.service_id = bounded.id
    WHERE (bounded.window_start IS NULL OR point.recorded_at >= bounded.window_start)
      AND (bounded.window_end IS NULL OR point.recorded_at <= bounded.window_end)
  ),
  point_stats AS (
    SELECT
      point.service_id,
      count(*) AS raw_points_count,
      count(*) FILTER (WHERE point.trusted) AS trusted_points_count,
      min(point.recorded_at) FILTER (WHERE point.trusted) AS start_at,
      max(point.recorded_at) FILTER (WHERE point.trusted) AS end_at
    FROM raw_points point
    GROUP BY point.service_id
  ),
  trusted_ordered AS (
    SELECT
      point.*,
      lag(point.latitude) OVER service_points AS previous_latitude,
      lag(point.longitude) OVER service_points AS previous_longitude,
      lag(point.recorded_at) OVER service_points AS previous_recorded_at
    FROM raw_points point
    WHERE point.trusted
    WINDOW service_points AS (
      PARTITION BY point.service_id
      ORDER BY point.recorded_at
    )
  ),
  trusted_segments AS (
    SELECT
      point.*,
      EXTRACT(EPOCH FROM (point.recorded_at - point.previous_recorded_at)) AS elapsed_seconds,
      6371.0 * 2.0 * asin(sqrt(LEAST(
        1.0,
        power(sin(radians(point.latitude - point.previous_latitude) / 2.0), 2)
        + cos(radians(point.previous_latitude))
          * cos(radians(point.latitude))
          * power(sin(radians(point.longitude - point.previous_longitude) / 2.0), 2)
      ))) AS segment_distance_km
    FROM trusted_ordered point
    WHERE point.previous_recorded_at IS NOT NULL
      AND point.recorded_at > point.previous_recorded_at
  ),
  segment_stats AS (
    SELECT
      segment.service_id,
      round(COALESCE(sum(segment.segment_distance_km) FILTER (
        WHERE segment.segment_distance_km
          / (segment.elapsed_seconds / 3600.0) <= 150.0
      ), 0)::numeric, 1)::double precision AS reliable_distance_km,
      count(*) FILTER (WHERE segment.elapsed_seconds > 300)::integer AS gaps_count
    FROM trusted_segments segment
    GROUP BY segment.service_id
  ),
  speed_series AS (
    SELECT
      point.service_id,
      point.recorded_at,
      point.speed_mps * 3.6 AS speed_kmh,
      lag(point.speed_mps * 3.6 > p_speed_limit_kmh) OVER service_speeds AS previous_over_limit,
      lag(point.recorded_at) OVER service_speeds AS previous_recorded_at
    FROM raw_points point
    WHERE point.trusted
      AND point.speed_mps IS NOT NULL
      AND point.speed_mps >= 0
      AND point.speed_mps * 3.6 <= 150
    WINDOW service_speeds AS (
      PARTITION BY point.service_id
      ORDER BY point.recorded_at
    )
  ),
  speed_stats AS (
    SELECT
      speed.service_id,
      max(speed.speed_kmh) AS max_speed_kmh,
      avg(speed.speed_kmh) FILTER (
        WHERE speed.speed_kmh >= 5
      ) AS average_moving_speed_kmh,
      percentile_cont(0.95) WITHIN GROUP (
        ORDER BY speed.speed_kmh
      ) FILTER (
        WHERE speed.speed_kmh >= 5
      ) AS percentile95_speed_kmh,
      count(*) FILTER (
        WHERE speed.speed_kmh > p_speed_limit_kmh
          AND (
            NOT COALESCE(speed.previous_over_limit, false)
            OR speed.previous_recorded_at IS NULL
            OR speed.recorded_at - speed.previous_recorded_at > interval '60 seconds'
          )
      ) AS over_limit_episodes,
      count(*) AS speed_samples_count
    FROM speed_series speed
    GROUP BY speed.service_id
  ),
  combined AS (
    SELECT
      bounded.*,
      COALESCE(points.raw_points_count, 0) AS raw_points_count,
      COALESCE(points.trusted_points_count, 0) AS trusted_points_count,
      points.start_at,
      points.end_at,
      COALESCE(segments.reliable_distance_km, 0) AS reliable_distance_km,
      COALESCE(segments.gaps_count, 0) AS gaps_count,
      speeds.max_speed_kmh,
      speeds.average_moving_speed_kmh,
      speeds.percentile95_speed_kmh,
      COALESCE(speeds.over_limit_episodes, 0) AS over_limit_episodes,
      COALESCE(speeds.speed_samples_count, 0) AS speed_samples_count,
      (
        COALESCE(points.trusted_points_count, 0) < 10
        OR COALESCE(segments.gaps_count, 0) > 3
        OR (
          COALESCE(points.raw_points_count, 0) > 0
          AND COALESCE(points.trusted_points_count, 0)::numeric
            / points.raw_points_count::numeric < 0.8
        )
        OR COALESCE(bounded.route_low_confidence, false)
      ) AS low_confidence
    FROM bounded_services bounded
    LEFT JOIN point_stats points
      ON points.service_id = bounded.id
    LEFT JOIN segment_stats segments
      ON segments.service_id = bounded.id
    LEFT JOIN speed_stats speeds
      ON speeds.service_id = bounded.id
  )
  SELECT
    combined.id AS service_id,
    combined.service_date,
    combined.folio,
    combined.service_status,
    combined.service_type_name,
    combined.telemetry_mode,
    combined.operator_id,
    combined.operator_name,
    combined.crane_id,
    combined.crane_label,
    combined.tracking_expected,
    combined.operational_started_at,
    combined.start_at,
    combined.end_at,
    COALESCE(
      combined.route_duration_minutes,
      CASE
        WHEN combined.start_at IS NOT NULL AND combined.end_at >= combined.start_at
          THEN ceil(EXTRACT(EPOCH FROM (combined.end_at - combined.start_at)) / 60.0)::integer
        ELSE NULL
      END
    ) AS total_duration_minutes,
    combined.reliable_distance_km,
    combined.raw_points_count,
    combined.trusted_points_count,
    combined.gaps_count,
    combined.low_confidence,
    combined.max_speed_kmh,
    combined.average_moving_speed_kmh,
    combined.percentile95_speed_kmh,
    combined.over_limit_episodes,
    combined.speed_samples_count,
    CASE
      WHEN combined.telemetry_mode = 'none' THEN 'unexpected'
      WHEN combined.telemetry_mode = 'external' THEN 'external'
      WHEN NOT combined.tracking_expected AND combined.raw_points_count = 0 THEN 'not_started'
      WHEN combined.tracking_expected AND combined.trusted_points_count = 0 THEN 'missing'
      WHEN combined.trusted_points_count > 0 AND combined.low_confidence THEN 'review'
      WHEN combined.trusted_points_count > 0 THEN 'reliable'
      ELSE 'not_started'
    END AS coverage_status,
    combined.telemetry_mode = 'none'
      AND combined.raw_points_count > 0 AS unexpected_telemetry
  FROM combined
  ORDER BY combined.service_date DESC, combined.folio DESC;
$$;

COMMENT ON FUNCTION public.get_service_telemetry IS
  'Telemetría agregada por servicio: excluye actividades sin GPS esperado, conserva GPS inesperado como anomalía y agrupa excesos de velocidad en episodios.';

REVOKE ALL ON FUNCTION public.get_service_telemetry(date, date, double precision)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_service_telemetry(date, date, double precision)
  TO authenticated;

COMMIT;
