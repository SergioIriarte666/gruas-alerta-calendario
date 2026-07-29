-- Tres correcciones de la revisión del 29/07 sobre la ronda 4.

BEGIN;

-- ── 1. detect_tracking_silence dejaba teléfonos a la vista ─────────────────
--
-- Es SECURITY DEFINER, devuelve `operator_phone` y estaba concedida a
-- `authenticated`. O sea: cualquier operador con sesión podía listar los
-- teléfonos de toda la flota saltándose las RLS de `operators`. No era la
-- intención —la función existe para el cron y para que un admin pueda preguntar
-- "¿quién está callado ahora?"— pero la intención no es un control de acceso.
--
-- La guarda va DENTRO en vez de solo revocar el GRANT: así el admin conserva la
-- capacidad de auditar, que es la mitad útil de la función.
CREATE OR REPLACE FUNCTION public.detect_tracking_silence()
RETURNS TABLE (
  service_id uuid,
  folio text,
  operator_id uuid,
  operator_name text,
  operator_phone text,
  last_point_at timestamptz,
  silent_minutes integer,
  open_stop_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- auth.uid() NULL = llamada desde el servidor (pg_cron / service_role).
  -- Con sesión de usuario, solo administradores.
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede consultar el silencio de telemetría'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.folio,
    s.operator_id,
    o.name,
    o.phone,
    lp.last_point_at,
    GREATEST(0, (EXTRACT(EPOCH FROM (now() - COALESCE(lp.last_point_at, ses.started_at))) / 60)::integer),
    se.reason
  FROM public.services s
  JOIN public.operators o ON o.id = s.operator_id
  LEFT JOIN LATERAL (
    SELECT MAX(p.recorded_at) AS last_point_at
    FROM public.operator_location_points p
    WHERE p.service_id = s.id
  ) lp ON true
  -- Ancla del silencio cuando el servicio nunca llegó a producir un punto: el
  -- comienzo de su sesión de transmisión. NO se usa `services.updated_at`, que
  -- un trigger reescribe con cualquier edición del servicio.
  LEFT JOIN LATERAL (
    SELECT MAX(x.started_at) AS started_at
    FROM public.operator_location_sessions x
    WHERE x.service_id = s.id
  ) ses ON true
  LEFT JOIN LATERAL (
    SELECT e.reason
    FROM public.service_stop_events e
    WHERE e.service_id = s.id AND e.ended_at IS NULL
    ORDER BY e.started_at DESC
    LIMIT 1
  ) se ON true
  WHERE s.status IN ('in_progress', 'inspection_completed')
    AND s.operator_id IS NOT NULL
    AND public.service_has_active_tracking_link(s.id)
    AND COALESCE(lp.last_point_at, ses.started_at) IS NOT NULL
    AND COALESCE(lp.last_point_at, ses.started_at) < now() - (
      CASE WHEN se.reason IS NULL THEN interval '10 minutes' ELSE interval '20 minutes' END
    );
END;
$$;

COMMENT ON FUNCTION public.detect_tracking_silence() IS
  'Traslados en curso con link vigente que llevan 10 min sin puntos (20 con detención abierta). Devuelve el teléfono del operador, así que exige rol admin cuando la llama un usuario; el cron entra sin sesión.';

REVOKE ALL ON FUNCTION public.detect_tracking_silence() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.detect_tracking_silence() TO authenticated, service_role;

-- ── 2. El dedupe del watchdog ignoraba de quién era el silencio ────────────
--
-- La llave era servicio + último punto. Si durante un mismo episodio de
-- silencio se reasigna el servicio, el operador ENTRANTE no recibe aviso: la
-- llave ya está tomada por el saliente, que quizás ni siquiera tiene el
-- teléfono encendido. Justo el escenario del relevo del 28/07.
--
-- Con el operador en la llave, cada uno recibe su aviso una vez por episodio.
CREATE OR REPLACE FUNCTION public.enqueue_tracking_silence_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row record;
  v_key text;
  v_enqueued integer := 0;
BEGIN
  FOR v_row IN SELECT * FROM public.detect_tracking_silence() LOOP
    v_key := 'operator_tracking_silence:' || v_row.service_id::text || ':' ||
             v_row.operator_id::text || ':' ||
             COALESCE(to_char(v_row.last_point_at AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISS'), 'never');

    INSERT INTO public.whatsapp_alert_dedupe (alert_key, sent_for_date, context)
    VALUES (
      v_key,
      DATE '2000-01-01',
      jsonb_build_object(
        'service_id', v_row.service_id,
        'folio', v_row.folio,
        'operator_id', v_row.operator_id,
        'silent_minutes', v_row.silent_minutes,
        'source', 'enqueue_tracking_silence_alerts'
      )
    )
    ON CONFLICT (alert_key, sent_for_date) DO NOTHING;

    CONTINUE WHEN NOT FOUND;

    INSERT INTO public.notification_outbox (kind, service_id, payload)
    VALUES (
      'operator_tracking_silence',
      v_row.service_id,
      jsonb_build_object(
        'folio', v_row.folio,
        'operator_id', v_row.operator_id,
        'operator_name', v_row.operator_name,
        'operator_phone', v_row.operator_phone,
        'silent_minutes', v_row.silent_minutes,
        'last_point_at', v_row.last_point_at,
        'open_stop_reason', v_row.open_stop_reason,
        'alert_key', v_key,
        'source', 'tracking_silence_watchdog'
      )
    );

    v_enqueued := v_enqueued + 1;

    INSERT INTO public.notifications (
      user_id, title, message, type, category, priority,
      action_url, entity_type, entity_id, group_key
    )
    SELECT
      ur.user_id,
      'Seguimiento sin señal · ' || v_row.folio,
      COALESCE(v_row.operator_name, 'El operador') || ' dejó de reportar posición hace '
        || v_row.silent_minutes || ' min'
        || CASE WHEN v_row.open_stop_reason IS NULL THEN '' ELSE ' (detención abierta)' END
        || '. Se le envió aviso para reanudar.',
      'warning',
      'operations',
      2,
      '/operator-locations',
      'service',
      v_row.service_id,
      v_key
    FROM public.user_roles ur
    WHERE ur.role = 'admin'::public.app_role;
  END LOOP;

  RETURN v_enqueued;
END;
$$;

COMMENT ON FUNCTION public.enqueue_tracking_silence_alerts() IS
  'Watchdog de telemetría. Un aviso por episodio Y POR OPERADOR: en un relevo durante el mismo silencio, el entrante también recibe el suyo.';

REVOKE ALL ON FUNCTION public.enqueue_tracking_silence_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_tracking_silence_alerts() TO service_role;

-- ── 3. El mapa admin mezclaba la sesión de un servicio con el punto de otro ─
--
-- El punto se buscaba por `operator_id` a secas, sin atarlo a la sesión que la
-- fila muestra. Con la corrección del Fix 7 —los puntos de un adicional quedan
-- con `service_id` NULL pero conservan su `operator_id`— eso se volvió más
-- probable: la fila podía decir "folio X" y pintar una posición que no era de
-- ese trayecto.
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
    -- Atado a LA SESIÓN que esta fila describe, no al operador suelto.
    WHERE olp.session_id = s.id
    ORDER BY olp.recorded_at DESC
    LIMIT 1
  ) p ON true
  WHERE o.is_active IS TRUE;
$$;

COMMENT ON FUNCTION public.get_operator_live_locations() IS
  'Última sesión por operador con el último punto DE ESA SESIÓN. Atar el punto a la sesión evita mostrar una posición vieja junto al folio en curso.';

COMMIT;
