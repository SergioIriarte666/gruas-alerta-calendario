-- El watchdog de silencio confunde "detenido" con "sin señal".
--
-- El 01/08 el servicio 3266120-1 disparó TRES avisos de WhatsApp al operador:
--
--   08:50 · 13 min de silencio · se movió 13 m · estacionado en portería
--   12:00 · 21 min de silencio · se movió 11 m · detención `ruta_cortada` ABIERTA
--   13:05 · 25 min de silencio · se movió  9 m · la misma detención abierta
--
-- Las tres falsas. El filtro de distancia del plugin deja de emitir puntos con
-- el móvil quieto: eso es el comportamiento correcto, y el watchdog lo leía
-- como pérdida de transmisión. Pedirle a un operador que "reanude la
-- transmisión" mientras espera que abran la ruta no solo es inútil: enseña a
-- ignorar la alerta, que es la única forma de romper un watchdog para siempre.
--
-- La causa: detect_tracking_silence() sólo comparaba now() - last_point_at
-- contra un umbral fijo. Nunca miraba si el vehículo se estaba moviendo.
--
-- Ahora la función devuelve TODOS los candidatos con más de 10 min de silencio
-- y explica en `suppression_reason` por qué cada uno no es una alerta. Se
-- devuelven en vez de filtrarse para poder auditar los silencios: un watchdog
-- que calla sin dejar registro es indistinguible de uno roto.

BEGIN;

-- La firma cambia (se suma `suppression_reason`), y CREATE OR REPLACE no puede
-- alterar el tipo de retorno de una función existente. El DROP es seguro:
-- enqueue_tracking_silence_alerts la invoca desde plpgsql, que resuelve el
-- nombre en tiempo de ejecución y no guarda dependencia.
DROP FUNCTION IF EXISTS public.detect_tracking_silence();

-- Radio de las geocercas operativas (carga, descarga, inspección).
-- Coincide con TOWING_METERS de la edge function service-tracking.
CREATE OR REPLACE FUNCTION public.detect_tracking_silence()
RETURNS TABLE(
  service_id uuid,
  folio text,
  operator_id uuid,
  operator_name text,
  operator_phone text,
  last_point_at timestamp with time zone,
  silent_minutes integer,
  open_stop_reason text,
  suppression_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- auth.uid() NULL = llamada desde el servidor (pg_cron / service_role).
  -- Con sesión de usuario, solo administradores.
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede consultar el silencio de telemetría'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH candidatos AS (
    SELECT
      s.id AS service_id,
      s.folio,
      s.operator_id,
      o.name AS operator_name,
      o.phone AS operator_phone,
      s.origin_lat, s.origin_lng, s.destination_lat, s.destination_lng,
      lp.last_point_at,
      lp.last_latitude,
      lp.last_longitude,
      lp.last_speed_mps,
      ref.ref_latitude,
      ref.ref_longitude,
      se.reason AS open_stop_reason,
      GREATEST(0, (EXTRACT(EPOCH FROM (now() - COALESCE(lp.last_point_at, ses.started_at))) / 60)::integer) AS silent_minutes
    FROM public.services s
    JOIN public.operators o ON o.id = s.operator_id
    LEFT JOIN LATERAL (
      SELECT p.recorded_at AS last_point_at,
             p.latitude    AS last_latitude,
             p.longitude   AS last_longitude,
             p.speed_mps   AS last_speed_mps
      FROM public.operator_location_points p
      WHERE p.service_id = s.id
      ORDER BY p.recorded_at DESC
      LIMIT 1
    ) lp ON true
    -- Punto de referencia para medir desplazamiento: el MÁS ANTIGUO dentro de
    -- los 10 min previos al último. Si no hay ninguno, el desplazamiento queda
    -- indeterminado y no se usa para suprimir.
    LEFT JOIN LATERAL (
      SELECT p2.latitude AS ref_latitude, p2.longitude AS ref_longitude
      FROM public.operator_location_points p2
      WHERE p2.service_id = s.id
        AND p2.recorded_at >= lp.last_point_at - interval '10 minutes'
        AND p2.recorded_at <  lp.last_point_at
      ORDER BY p2.recorded_at ASC
      LIMIT 1
    ) ref ON true
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
      -- Piso común: nada por debajo de 10 min es siquiera candidato.
      AND COALESCE(lp.last_point_at, ses.started_at) < now() - interval '10 minutes'
  ),
  clasificados AS (
    SELECT
      c.*,
      -- Desplazamiento real en los últimos ~10 min de reportes. NULL cuando no
      -- hay punto de referencia (un solo punto en la ventana).
      CASE
        WHEN c.ref_latitude IS NULL OR c.last_latitude IS NULL THEN NULL
        ELSE public.service_stops_distance_meters(
               c.last_latitude, c.last_longitude, c.ref_latitude, c.ref_longitude)
      END AS displacement_m,
      -- Distancia a las geocercas operativas.
      CASE
        WHEN c.last_latitude IS NULL OR c.origin_lat IS NULL THEN NULL
        ELSE public.service_stops_distance_meters(
               c.last_latitude, c.last_longitude, c.origin_lat, c.origin_lng)
      END AS distance_to_origin_m,
      CASE
        WHEN c.last_latitude IS NULL OR c.destination_lat IS NULL THEN NULL
        ELSE public.service_stops_distance_meters(
               c.last_latitude, c.last_longitude, c.destination_lat, c.destination_lng)
      END AS distance_to_destination_m
    FROM candidatos c
  )
  SELECT
    k.service_id,
    k.folio,
    k.operator_id,
    k.operator_name,
    k.operator_phone,
    k.last_point_at,
    k.silent_minutes,
    k.open_stop_reason,
    CASE
      -- 1. El operador YA declaró por qué está detenido. Avisarle que reanude
      --    la transmisión es contradecir lo que él mismo informó. La vigilancia
      --    se reactiva sola cuando cierra la detención.
      WHEN k.open_stop_reason IS NOT NULL THEN 'open_stop_event'

      -- 2. Dentro de una geocerca operativa: carga, descarga o inspección. Ahí
      --    el vehículo está quieto por definición del trabajo.
      WHEN COALESCE(k.distance_to_origin_m, 1e9) < 500 THEN 'inside_origin_geofence'
      WHEN COALESCE(k.distance_to_destination_m, 1e9) < 500 THEN 'inside_destination_geofence'

      -- 3. Estacionado: no se movió o venía casi detenido. Sigue vigilado, pero
      --    con un umbral de 45 min en vez de 10 — el silencio de un vehículo
      --    quieto es lo ESPERADO con filtro por distancia (medido: hasta 26 min
      --    entre puntos con todo funcionando).
      WHEN (
             (k.displacement_m IS NOT NULL AND k.displacement_m < 100)
             OR (k.last_speed_mps IS NOT NULL AND k.last_speed_mps < 1.5)
           )
           AND k.silent_minutes < 45
        THEN 'vehicle_parked'

      -- 4. Silencio real: venía rodando, fuera de geocercas, sin detención
      --    declarada, y dejó de reportar. Esta sí es la alerta que importa.
      ELSE NULL
    END::text
  FROM clasificados k;
END;
$function$;

COMMENT ON FUNCTION public.detect_tracking_silence() IS
  'Candidatos a silencio de telemetría (>10 min sin punto). Devuelve TAMBIÉN los suprimidos, con el motivo en suppression_reason, para poder auditar por qué no se alertó. Sólo las filas con suppression_reason IS NULL son alertas reales.';

-- enqueue_tracking_silence_alerts conserva su contrato (firma, dedupe, outbox y
-- notificación al admin). Lo único que cambia: consume nada más las filas que
-- la detección dejó marcadas como alerta legítima.
CREATE OR REPLACE FUNCTION public.enqueue_tracking_silence_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row record;
  v_key text;
  v_enqueued integer := 0;
BEGIN
  FOR v_row IN
    SELECT * FROM public.detect_tracking_silence()
    WHERE suppression_reason IS NULL
  LOOP
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
$function$;

COMMIT;
