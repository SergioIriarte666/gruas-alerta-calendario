-- Watchdog de telemetría: el servidor nota el silencio y avisa al teléfono.
--
-- El 28/07 la transmisión del folio 3262047-1 murió a las 15:26 durante una
-- espera de 3 h en un corte de ruta y no revivió al retomar. Nadie lo notó
-- hasta una revisión manual esa noche: más de dos horas de un traslado sin
-- posición, con el link del cliente vigente. El operador no cerró la app ni
-- apagó el teléfono; la app simplemente dejó de reportar y no había nada que
-- lo dijera en voz alta.
--
-- Esta es la red de seguridad de servidor: cada 5 minutos revisa los traslados
-- en curso con link de cliente vigente y, si llevan 10 minutos sin un solo
-- punto, encola un WhatsApp AL OPERADOR con el deep link de recuperación
-- (/operador?accion=reanudar, Fix 10) y una notificación al admin. La cadena
-- completa queda: el servidor nota el silencio -> avisa al teléfono -> un toque
-- repara.
--
-- Dos umbrales, porque hay dos silencios distintos:
--   · Sin detención abierta -> 10 min. La grúa debería estar produciendo puntos.
--   · Con detención abierta (descanso, ruta cortada) -> 20 min. El silencio de
--     MOVIMIENTO es esperado, pero el latido no: el heartbeat nativo manda un
--     punto cada 2 minutos aunque el equipo esté quieto. Veinte minutos sin
--     NINGÚN punto siguen siendo una transmisión caída, esté detenido o no.
--
-- Un aviso por episodio: la llave de dedupe incluye la marca del último punto
-- conocido, así que mientras el silencio dure la llave no cambia y no se
-- repite. Si vuelven puntos y se corta de nuevo, la marca es otra y el aviso
-- sale otra vez.
--
-- REQUISITO EXTERNO: la plantilla Meta `operador_telemetria_caida` (es_CL) debe
-- estar aprobada en Business Manager antes de que el envío funcione. Hasta
-- entonces las filas del outbox fallan y reintentan hasta agotarse; la
-- notificación al admin sale igual, que es la parte que no depende de Meta.

BEGIN;

-- ── El outbox aprende un tipo interno ──────────────────────────────────────
--
-- `operator_tracking_silence` es la primera fila del outbox dirigida HACIA
-- ADENTRO. Importa para el Fix 12: el interruptor de notificaciones al cliente
-- no la toca.

ALTER TABLE public.notification_outbox
  DROP CONSTRAINT IF EXISTS notification_outbox_kind_check;

ALTER TABLE public.notification_outbox
  ADD CONSTRAINT notification_outbox_kind_check CHECK (kind IN (
    'tracking_link',
    'inspection_whatsapp',
    'inspection_email',
    'delivery_whatsapp',
    'delivery_email',
    'operator_tracking_silence'
  ));

-- Barrido del watchdog: sin este índice, contar los puntos de cada traslado
-- cada 5 minutos obliga a recorrer una tabla que crece sin techo.
CREATE INDEX IF NOT EXISTS idx_operator_location_points_service_recorded_at
  ON public.operator_location_points (service_id, recorded_at DESC)
  WHERE service_id IS NOT NULL;

/**
 * Traslados en curso que dejaron de reportar.
 *
 * Se expone aparte del encolado para poder AUDITARLA sin efectos: un admin
 * puede preguntarle a la base "¿quién está callado ahora?" sin disparar avisos.
 */
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
  -- parece equivalente y no lo es: un trigger la reescribe con cualquier
  -- edición del servicio, así que un admin corrigiendo un dato desde el
  -- escritorio posponía el aviso de una grúa incomunicada.
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
    -- Sin link entregado no hay nadie mirando: el silencio no le miente a
    -- ningún cliente y no amerita despertar al operador en ruta.
    AND public.service_has_active_tracking_link(s.id)
    -- Sin punto Y sin sesión, el servicio nunca empezó a transmitir. Eso es un
    -- "no encendió", no un "se cayó": avisarlo cada 5 minutos por cada servicio
    -- recién iniciado enseñaría a todos a ignorar la alerta que sí importa.
    AND COALESCE(lp.last_point_at, ses.started_at) IS NOT NULL
    AND COALESCE(lp.last_point_at, ses.started_at) < now() - (
      CASE WHEN se.reason IS NULL THEN interval '10 minutes' ELSE interval '20 minutes' END
    );
$$;

COMMENT ON FUNCTION public.detect_tracking_silence() IS
  'Traslados en curso con link de cliente vigente que llevan 10 min sin puntos (20 min si hay una detención abierta que explique la falta de movimiento). Solo lee; el encolado es enqueue_tracking_silence_alerts().';

REVOKE ALL ON FUNCTION public.detect_tracking_silence() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.detect_tracking_silence() TO authenticated, service_role;

/**
 * Encola el aviso al operador y notifica al admin. Devuelve cuántos encoló.
 *
 * El dedupe se resuelve AQUÍ, al encolar, y no en el procesador: la llave del
 * episodio es un hecho de la base (el último punto conocido), no del envío. Si
 * el WhatsApp falla, el outbox reintenta la misma fila; lo que no queremos es
 * una fila NUEVA cada 5 minutos por el mismo silencio.
 */
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
    -- Episodio = servicio + marca del último punto. Mientras el silencio dure,
    -- la llave es la misma y el INSERT choca; si vuelven puntos y se vuelve a
    -- caer, la marca cambió y el aviso sale de nuevo.
    v_key := 'operator_tracking_silence:' || v_row.service_id::text || ':' ||
             COALESCE(to_char(v_row.last_point_at AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISS'), 'never');

    -- Fecha centinela: el dedupe de este tipo es por EPISODIO, no por día. Un
    -- silencio que cruza la medianoche sigue siendo el mismo silencio.
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

    -- Aviso al admin en la campana del TMS. No depende de Meta ni de la
    -- cobertura del operador: es el rastro que existe pase lo que pase.
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
  'Watchdog de telemetría: encola un WhatsApp al operador y notifica al admin por cada traslado callado. Un aviso por episodio (dedupe por último punto conocido).';

REVOKE ALL ON FUNCTION public.enqueue_tracking_silence_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_tracking_silence_alerts() TO service_role;

-- ── pg_cron cada 5 minutos ─────────────────────────────────────────────────
--
-- Llama a la función DIRECTAMENTE, sin pasar por net.http_post: no hay nada que
-- hacer fuera de la base y así el watchdog no depende del CRON_SECRET del
-- vault, que ya nos dejó ciegos una vez (401 en todas las llamadas de pg_cron).
-- El envío real lo hace el procesador del outbox, que ya corre cada minuto.

DO $$
DECLARE
  existing_job record;
  watchdog_job_id bigint;
BEGIN
  FOR existing_job IN
    SELECT jobid FROM cron.job WHERE jobname = 'tracking-silence-watchdog'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;

  watchdog_job_id := cron.schedule(
    'tracking-silence-watchdog',
    '*/5 * * * *',
    $cron$ SELECT public.enqueue_tracking_silence_alerts(); $cron$
  );

  IF to_regclass('public.inspection_retention_cron_jobs') IS NOT NULL THEN
    EXECUTE
      'INSERT INTO public.inspection_retention_cron_jobs (job_name, job_id, schedule)
       VALUES ($1, $2, $3)
       ON CONFLICT (job_name) DO UPDATE
         SET job_id = EXCLUDED.job_id,
             schedule = EXCLUDED.schedule,
             created_at = now()'
    USING 'tracking-silence-watchdog', watchdog_job_id, '*/5 * * * *';
  END IF;
END $$;

COMMIT;
