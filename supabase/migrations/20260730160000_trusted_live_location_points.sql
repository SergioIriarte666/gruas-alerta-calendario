-- Los puntos GPS crudos son evidencia y nunca se eliminan por baja precisión.
-- Los mapas en vivo, en cambio, no deben mover el marcador con una lectura que
-- el propio dispositivo declara imprecisa. Esta migración centraliza la
-- política de visualización para que mapa admin, modal de servicio y link
-- público no implementen umbrales distintos.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_trusted_live_location_point(
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(
    p_latitude BETWEEN -56.5 AND -17.0
    AND p_longitude BETWEEN -76.0 AND -66.0
    AND p_accuracy_meters BETWEEN 0.0 AND 50.0,
    false
  );
$$;

COMMENT ON FUNCTION public.is_trusted_live_location_point IS
  'Política única de visualización GPS: coordenadas válidas en Chile y precisión informada de 0 a 50 metros. No decide qué puntos se almacenan.';

CREATE OR REPLACE FUNCTION public.get_best_session_location_point(
  p_session_id uuid
)
RETURNS TABLE (
  id uuid,
  session_id uuid,
  operator_id uuid,
  service_id uuid,
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  speed_mps double precision,
  heading_degrees double precision,
  recorded_at timestamptz,
  is_offline_sync boolean,
  source text,
  platform text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    p.id,
    p.session_id,
    p.operator_id,
    p.service_id,
    p.latitude,
    p.longitude,
    p.accuracy_meters,
    p.speed_mps,
    p.heading_degrees,
    p.recorded_at,
    p.is_offline_sync,
    p.source,
    p.platform
  FROM public.operator_location_points p
  WHERE p.session_id = p_session_id
    AND public.is_trusted_live_location_point(
      p.latitude,
      p.longitude,
      p.accuracy_meters
    )
  ORDER BY p.recorded_at DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_best_session_location_point IS
  'Último punto confiable de una sesión para mapas en vivo. Los puntos crudos de baja precisión permanecen disponibles para auditoría.';

CREATE OR REPLACE FUNCTION public.get_best_service_location_point(
  p_service_id uuid
)
RETURNS TABLE (
  id uuid,
  session_id uuid,
  operator_id uuid,
  service_id uuid,
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  speed_mps double precision,
  heading_degrees double precision,
  recorded_at timestamptz,
  is_offline_sync boolean,
  source text,
  platform text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    p.id,
    p.session_id,
    p.operator_id,
    p.service_id,
    p.latitude,
    p.longitude,
    p.accuracy_meters,
    p.speed_mps,
    p.heading_degrees,
    p.recorded_at,
    p.is_offline_sync,
    p.source,
    p.platform
  FROM public.operator_location_points p
  WHERE p.service_id = p_service_id
    AND public.is_trusted_live_location_point(
      p.latitude,
      p.longitude,
      p.accuracy_meters
    )
  ORDER BY p.recorded_at DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_best_service_location_point IS
  'Último punto confiable asociado a un servicio, sin eliminar ni ocultar la telemetría cruda en las vistas históricas.';

REVOKE ALL ON FUNCTION public.is_trusted_live_location_point FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_best_session_location_point FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_best_service_location_point FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_trusted_live_location_point TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_best_session_location_point TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_best_service_location_point TO authenticated, service_role;

-- El mapa administrativo conserva la última sesión como fuente de estado, pero
-- toma la posición exclusivamente desde la política confiable central.
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
  LEFT JOIN LATERAL public.get_best_session_location_point(s.id) p ON true
  WHERE o.is_active IS TRUE
    AND o.tracking_enabled IS TRUE;
$$;

COMMENT ON FUNCTION public.get_operator_live_locations() IS
  'Última sesión de cada operador rastreable y último punto confiable de esa sesión. Una lectura de baja precisión no desplaza el marcador en vivo.';

REVOKE ALL ON FUNCTION public.get_operator_live_locations FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_operator_live_locations TO authenticated;

COMMIT;
