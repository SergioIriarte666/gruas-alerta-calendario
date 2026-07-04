BEGIN;

CREATE OR REPLACE FUNCTION public.get_operator_live_locations()
RETURNS TABLE (
  operator_id uuid,
  operator_name text,
  session_id uuid,
  session_status text,
  started_reason text,
  ended_reason text,
  session_started_at timestamptz,
  session_ended_at timestamptz,
  service_id uuid,
  service_folio text,
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  speed_mps double precision,
  heading_degrees double precision,
  recorded_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    o.id AS operator_id,
    o.name AS operator_name,
    s.id AS session_id,
    s.status AS session_status,
    s.started_reason,
    s.ended_reason,
    s.started_at AS session_started_at,
    s.ended_at AS session_ended_at,
    s.service_id,
    sv.folio AS service_folio,
    p.latitude,
    p.longitude,
    p.accuracy_meters,
    p.speed_mps,
    p.heading_degrees,
    p.recorded_at
  FROM public.operators o
  LEFT JOIN LATERAL (
    SELECT ols.*
    FROM public.operator_location_sessions ols
    WHERE ols.operator_id = o.id
    ORDER BY ols.started_at DESC
    LIMIT 1
  ) s ON true
  LEFT JOIN public.services sv ON sv.id = s.service_id
  LEFT JOIN LATERAL (
    SELECT olp.latitude, olp.longitude, olp.accuracy_meters, olp.speed_mps, olp.heading_degrees, olp.recorded_at
    FROM public.operator_location_points olp
    WHERE olp.operator_id = o.id
    ORDER BY olp.recorded_at DESC
    LIMIT 1
  ) p ON true
  WHERE o.is_active IS TRUE;
$$;

COMMENT ON FUNCTION public.get_operator_live_locations() IS
  'Estado de rastreo en vivo por operador activo: última sesión (cualquier status) + último punto conocido + folio del servicio asociado. SECURITY INVOKER: aplican las policies de admin sobre operator_location_sessions/points.';

REVOKE ALL ON FUNCTION public.get_operator_live_locations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_operator_live_locations() TO authenticated;

COMMIT;
