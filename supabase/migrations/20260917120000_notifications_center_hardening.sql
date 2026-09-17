-- La tabla notifications por fin tiene lector en el frontend (desde la alerta
-- de OC pendiente el frontend consume sus filas activas). Eso destapó dos
-- deudas del watchdog de silencio de telemetría, que insertaba aquí desde
-- julio sin que nadie viera las filas:
--
-- 1. Sus alertas son efímeras ("dejó de reportar hace 15 min") pero no
--    expiraban nunca: al abrir el canal, avisos de hace 6 semanas
--    resurgirían como ruido. Ahora nacen con expires_at a 24 h, y el
--    frontend (igual que get_notification_summary) descarta las expiradas.
-- 2. Las 8 filas históricas que quedaron huérfanas se cierran con
--    dismissed_at para que no aparezcan retroactivamente.
--
-- enqueue_tracking_silence_alerts() se replica ÍNTEGRA desde
-- 20260801120000_tracking_silence_false_positives.sql; el único cambio es la
-- columna expires_at en el INSERT a notifications.

BEGIN;

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
      action_url, entity_type, entity_id, group_key, expires_at
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
      v_key,
      -- El aviso pierde sentido pasado el día: o se reanudó la transmisión o el
      -- servicio ya cerró. Sin expiración, estas filas se pudrían en el panel.
      now() + interval '24 hours'
    FROM public.user_roles ur
    WHERE ur.role = 'admin'::public.app_role;
  END LOOP;

  RETURN v_enqueued;
END;
$function$;

-- Backfill: cierra los avisos de silencio huérfanos (julio/agosto) que nunca
-- se mostraron y ya no informan nada. Idempotente por el filtro de fecha.
UPDATE public.notifications
SET dismissed_at = now()
WHERE category = 'operations'
  AND dismissed_at IS NULL
  AND created_at < now() - interval '48 hours';

COMMIT;
