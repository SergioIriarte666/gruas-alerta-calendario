-- Correcciones posteriores a la revisión profunda del rastreo:
-- 1. el mapa vuelve a respetar tracking_enabled;
-- 2. cada punto debe pertenecer realmente a la sesión declarada.

BEGIN;

CREATE OR REPLACE FUNCTION public.record_operator_location_point(
  p_session_id uuid,
  p_operator_id uuid,
  p_user_id uuid,
  p_service_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision,
  p_speed_mps double precision,
  p_heading_degrees double precision,
  p_altitude_meters double precision,
  p_recorded_at timestamptz,
  p_is_offline_sync boolean DEFAULT false,
  p_source text DEFAULT 'mobile_app',
  p_platform text DEFAULT 'ios'
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session public.operator_location_sessions%ROWTYPE;
BEGIN
  -- La fila queda bloqueada hasta terminar la escritura: no puede cambiar de
  -- dueño/servicio entre la validación y el INSERT.
  SELECT *
  INTO v_session
  FROM public.operator_location_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'La sesión de ubicación indicada no existe o no es accesible';
  END IF;

  IF v_session.operator_id <> p_operator_id
     OR v_session.user_id <> p_user_id
     OR v_session.service_id IS DISTINCT FROM p_service_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'El punto no corresponde al operador, usuario o servicio de la sesión';
  END IF;

  INSERT INTO public.operator_location_points (
    session_id, operator_id, user_id, service_id,
    latitude, longitude, accuracy_meters, speed_mps,
    heading_degrees, altitude_meters, recorded_at,
    is_offline_sync, source, platform
  ) VALUES (
    p_session_id, p_operator_id, p_user_id, p_service_id,
    p_latitude, p_longitude, p_accuracy_meters, p_speed_mps,
    p_heading_degrees, p_altitude_meters, p_recorded_at,
    COALESCE(p_is_offline_sync, false),
    COALESCE(p_source, 'mobile_app'),
    COALESCE(p_platform, 'ios')
  )
  ON CONFLICT (operator_id, recorded_at, latitude, longitude) DO NOTHING;

  UPDATE public.operator_location_sessions
  SET last_point_at = GREATEST(COALESCE(last_point_at, p_recorded_at), p_recorded_at)
  WHERE id = p_session_id;
END;
$$;

COMMENT ON FUNCTION public.record_operator_location_point IS
  'Valida que sesión, operador, usuario y servicio correspondan; guarda el punto y adelanta last_point_at atómicamente sin hacerlo retroceder.';

REVOKE ALL ON FUNCTION public.record_operator_location_point FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_operator_location_point TO authenticated, service_role;

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
    SELECT olp.latitude, olp.longitude, olp.accuracy_meters, olp.speed_mps,
           olp.heading_degrees, olp.recorded_at
    FROM public.operator_location_points olp
    WHERE olp.session_id = s.id
    ORDER BY olp.recorded_at DESC
    LIMIT 1
  ) p ON true
  WHERE o.is_active IS TRUE
    AND o.tracking_enabled IS TRUE;
$$;

COMMENT ON FUNCTION public.get_operator_live_locations() IS
  'Última sesión por operador activo con tracking habilitado y último punto de esa misma sesión.';

REVOKE ALL ON FUNCTION public.get_operator_live_locations FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_operator_live_locations TO authenticated;

COMMIT;
