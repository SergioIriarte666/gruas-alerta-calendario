-- Alerta interna de OC pendiente (solo admins, nunca al cliente).
--
-- Con clientes tipo Salfa/Arrendadora la cotización se entrega y la OC puede
-- demorar semanas sin que nadie la persiga. Un job diario de pg_cron evalúa
-- los servicios en 'quoted' / 'purchase_order_pending' sin OC registrada cuya
-- entrada al estado (según service_change_history; fallback updated_at) supere
-- el umbral configurable system_settings.oc_alert_days, e inserta una fila en
-- public.notifications por servicio y por admin.
--
-- Dedup: una alerta activa (dismissed_at IS NULL) por servicio y admin bloquea
-- re-inserciones, incluso ya leída. Cuando llega la OC o el servicio cambia de
-- estado, la propia función cierra (dismissed_at) las alertas cuya condición
-- dejó de cumplirse, así el servicio solo vuelve a alertar si recae.

BEGIN;

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS oc_alert_days integer NOT NULL DEFAULT 5;

DO $do$
BEGIN
  ALTER TABLE public.system_settings
    ADD CONSTRAINT check_oc_alert_days CHECK (oc_alert_days >= 1 AND oc_alert_days <= 90);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$do$;

CREATE OR REPLACE FUNCTION public.evaluate_pending_oc_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_days integer;
  v_now timestamptz := now();
  v_inserted integer := 0;
  v_service RECORD;
  v_admin_id uuid;
  v_days_waiting integer;
  v_status_label text;
BEGIN
  SELECT oc_alert_days INTO v_days
  FROM public.system_settings
  ORDER BY created_at
  LIMIT 1;
  v_days := COALESCE(v_days, 5);

  -- Cierra alertas cuya condición ya no se cumple (llegó la OC, cambió el
  -- estado o se borró el servicio). Sin esto, el dedup impediría volver a
  -- alertar si el servicio recae en la condición más adelante.
  UPDATE public.notifications n
  SET dismissed_at = v_now
  WHERE n.category = 'oc_pending'
    AND n.dismissed_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.services s
      WHERE s.id = n.entity_id
        AND s.status IN ('quoted', 'purchase_order_pending')
        AND COALESCE(NULLIF(btrim(s.purchase_order), ''),
                     NULLIF(btrim(s.purchase_order_number), '')) IS NULL
    );

  FOR v_service IN
    SELECT
      s.id,
      s.folio,
      s.status,
      COALESCE(c.name, 'cliente sin nombre') AS client_name,
      COALESCE(
        (
          SELECT max(h.changed_at)
          FROM public.service_change_history h
          WHERE h.service_id = s.id
            AND h.field_name = 'status'
            AND h.new_value = s.status::text
        ),
        s.updated_at
      ) AS entered_at
    FROM public.services s
    LEFT JOIN public.clients c ON c.id = s.client_id
    WHERE s.status IN ('quoted', 'purchase_order_pending')
      AND COALESCE(NULLIF(btrim(s.purchase_order), ''),
                   NULLIF(btrim(s.purchase_order_number), '')) IS NULL
  LOOP
    CONTINUE WHEN v_service.entered_at IS NULL
      OR v_service.entered_at > v_now - make_interval(days => v_days);

    v_days_waiting := floor(extract(epoch FROM (v_now - v_service.entered_at)) / 86400)::integer;
    v_status_label := CASE v_service.status::text
      WHEN 'quoted' THEN 'cotizado'
      ELSE 'esperando OC'
    END;

    FOR v_admin_id IN
      SELECT p.id
      FROM public.profiles p
      WHERE p.role = 'admin'
        AND p.is_active
        AND p.status = 'approved'
    LOOP
      CONTINUE WHEN EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = v_admin_id
          AND n.category = 'oc_pending'
          AND n.entity_id = v_service.id
          AND n.dismissed_at IS NULL
      );

      INSERT INTO public.notifications (
        user_id, title, message, type, category, priority,
        action_type, action_url, action_data, entity_type, entity_id, group_key
      ) VALUES (
        v_admin_id,
        'OC pendiente hace ' || v_days_waiting || ' días',
        'Servicio ' || v_service.folio || ' de ' || v_service.client_name ||
          ' lleva ' || v_days_waiting || ' días ' || v_status_label ||
          ' sin orden de compra registrada.',
        'warning',
        'oc_pending',
        2,
        'navigate',
        '/services',
        jsonb_build_object('entityId', v_service.id),
        'service',
        v_service.id,
        'oc_pending'
      );
      v_inserted := v_inserted + 1;
    END LOOP;
  END LOOP;

  RETURN v_inserted;
END;
$fn$;

REVOKE ALL ON FUNCTION public.evaluate_pending_oc_alerts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_pending_oc_alerts() TO authenticated, service_role;

-- 13:00 UTC = 09:00/10:00 de Santiago según DST; lunes a viernes.
-- La función es SQL puro (no edge function), así que el cron la llama directo.
SELECT cron.schedule(
  'evaluate-pending-oc-alerts-daily',
  '0 13 * * 1-5',
  $job$ SELECT public.evaluate_pending_oc_alerts(); $job$
);

COMMIT;
