BEGIN;

CREATE TABLE IF NOT EXISTS public.operator_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  service_id uuid NULL REFERENCES public.services(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  description text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz NULL,
  CONSTRAINT operator_activity_events_type_check CHECK (
    event_type IN (
      'service_assigned', 'service_unassigned', 'service_updated',
      'service_started', 'inspection_saved', 'delivery_ready',
      'delivery_evidence_saved', 'service_completed', 'service_cancelled',
      'tracking_started', 'tracking_stopped', 'sync_completed'
    )
  ),
  CONSTRAINT operator_activity_events_severity_check CHECK (
    severity IN ('info', 'success', 'warning', 'critical')
  ),
  CONSTRAINT operator_activity_events_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT operator_activity_events_title_check CHECK (length(btrim(title)) BETWEEN 1 AND 120)
);

CREATE INDEX IF NOT EXISTS idx_operator_activity_events_feed
  ON public.operator_activity_events(operator_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_operator_activity_events_unread
  ON public.operator_activity_events(operator_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_operator_activity_events_service
  ON public.operator_activity_events(service_id, created_at DESC)
  WHERE service_id IS NOT NULL;

ALTER TABLE public.operator_activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators read own activity" ON public.operator_activity_events;
CREATE POLICY "Operators read own activity"
  ON public.operator_activity_events
  FOR SELECT
  TO authenticated
  USING (
    operator_id = (
      SELECT public.get_operator_id_by_user((SELECT auth.uid()))
    )
    OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  );

DROP POLICY IF EXISTS "Operators mark own activity as read" ON public.operator_activity_events;
CREATE POLICY "Operators mark own activity as read"
  ON public.operator_activity_events
  FOR UPDATE
  TO authenticated
  USING (
    operator_id = (
      SELECT public.get_operator_id_by_user((SELECT auth.uid()))
    )
  )
  WITH CHECK (
    operator_id = (
      SELECT public.get_operator_id_by_user((SELECT auth.uid()))
    )
  );

REVOKE ALL ON public.operator_activity_events FROM anon, authenticated;
GRANT SELECT ON public.operator_activity_events TO authenticated;
GRANT UPDATE (read_at) ON public.operator_activity_events TO authenticated;

CREATE OR REPLACE FUNCTION public.insert_operator_activity_event(
  p_operator_id uuid,
  p_service_id uuid,
  p_event_type text,
  p_severity text,
  p_title text,
  p_description text,
  p_metadata jsonb,
  p_dedupe_key text,
  p_created_at timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.operator_activity_events (
    operator_id, service_id, event_type, severity, title, description,
    metadata, dedupe_key, created_at
  )
  VALUES (
    p_operator_id, p_service_id, p_event_type, p_severity, btrim(p_title),
    NULLIF(btrim(p_description), ''), COALESCE(p_metadata, '{}'::jsonb),
    p_dedupe_key, p_created_at
  )
  ON CONFLICT (dedupe_key) DO NOTHING;
$$;

REVOKE ALL ON FUNCTION public.insert_operator_activity_event(uuid, uuid, text, text, text, text, jsonb, text, timestamptz)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.capture_service_operator_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id text := txid_current()::text;
  v_description text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.operator_id IS NOT NULL THEN
      PERFORM public.insert_operator_activity_event(
        NEW.operator_id, NEW.id, 'service_assigned', 'info',
        'Nuevo servicio asignado',
        format('Servicio %s · %s → %s', NEW.folio, COALESCE(NEW.origin, 'Origen pendiente'), COALESCE(NEW.destination, 'Destino pendiente')),
        jsonb_build_object('folio', NEW.folio, 'status', NEW.status, 'service_date', NEW.service_date),
        format('service:%s:assigned:%s:%s', NEW.id, NEW.operator_id, v_event_id)
      );
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.operator_id IS DISTINCT FROM OLD.operator_id THEN
    IF OLD.operator_id IS NOT NULL THEN
      PERFORM public.insert_operator_activity_event(
        OLD.operator_id, NEW.id, 'service_unassigned', 'warning',
        'Servicio reasignado', format('El servicio %s dejó de estar asignado a tu jornada.', NEW.folio),
        jsonb_build_object('folio', NEW.folio),
        format('service:%s:unassigned:%s:%s', NEW.id, OLD.operator_id, v_event_id)
      );
    END IF;

    IF NEW.operator_id IS NOT NULL THEN
      PERFORM public.insert_operator_activity_event(
        NEW.operator_id, NEW.id, 'service_assigned', 'info',
        'Nuevo servicio asignado',
        format('Servicio %s · %s → %s', NEW.folio, COALESCE(NEW.origin, 'Origen pendiente'), COALESCE(NEW.destination, 'Destino pendiente')),
        jsonb_build_object('folio', NEW.folio, 'status', NEW.status, 'service_date', NEW.service_date),
        format('service:%s:assigned:%s:%s', NEW.id, NEW.operator_id, v_event_id)
      );
    END IF;
  END IF;

  IF NEW.operator_id IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'in_progress' THEN
        PERFORM public.insert_operator_activity_event(
          NEW.operator_id, NEW.id, 'service_started', 'success', 'Servicio iniciado',
          format('El servicio %s está ahora en curso.', NEW.folio),
          jsonb_build_object('folio', NEW.folio, 'previous_status', OLD.status, 'status', NEW.status),
          format('service:%s:status:%s:%s', NEW.id, NEW.status, v_event_id)
        );
      WHEN 'inspection_completed' THEN
        PERFORM public.insert_operator_activity_event(
          NEW.operator_id, NEW.id, 'delivery_ready', 'success', 'Listo para entrega',
          format('La inspección del servicio %s quedó completa.', NEW.folio),
          jsonb_build_object('folio', NEW.folio, 'previous_status', OLD.status, 'status', NEW.status),
          format('service:%s:status:%s:%s', NEW.id, NEW.status, v_event_id)
        );
      WHEN 'completed' THEN
        PERFORM public.insert_operator_activity_event(
          NEW.operator_id, NEW.id, 'service_completed', 'success', 'Servicio finalizado',
          format('El servicio %s fue completado correctamente.', NEW.folio),
          jsonb_build_object('folio', NEW.folio, 'previous_status', OLD.status, 'status', NEW.status),
          format('service:%s:status:%s:%s', NEW.id, NEW.status, v_event_id)
        );
      WHEN 'cancelled' THEN
        PERFORM public.insert_operator_activity_event(
          NEW.operator_id, NEW.id, 'service_cancelled', 'warning', 'Servicio cancelado',
          format('El servicio %s fue cancelado.', NEW.folio),
          jsonb_build_object('folio', NEW.folio, 'previous_status', OLD.status, 'status', NEW.status),
          format('service:%s:status:%s:%s', NEW.id, NEW.status, v_event_id)
        );
      WHEN 'failed' THEN
        PERFORM public.insert_operator_activity_event(
          NEW.operator_id, NEW.id, 'service_cancelled', 'critical', 'Servicio con incidencia',
          format('El servicio %s fue marcado con falla.', NEW.folio),
          jsonb_build_object('folio', NEW.folio, 'previous_status', OLD.status, 'status', NEW.status),
          format('service:%s:status:%s:%s', NEW.id, NEW.status, v_event_id)
        );
      ELSE NULL;
    END CASE;
  END IF;

  IF NEW.operator_id IS NOT NULL
    AND NEW.operator_id IS NOT DISTINCT FROM OLD.operator_id
    AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND (
      NEW.service_date IS DISTINCT FROM OLD.service_date
      OR NEW.start_time IS DISTINCT FROM OLD.start_time
      OR NEW.origin IS DISTINCT FROM OLD.origin
      OR NEW.destination IS DISTINCT FROM OLD.destination
      OR NEW.crane_id IS DISTINCT FROM OLD.crane_id
    )
  THEN
    v_description := format('Se actualizaron los datos operativos del servicio %s.', NEW.folio);
    PERFORM public.insert_operator_activity_event(
      NEW.operator_id, NEW.id, 'service_updated', 'info', 'Servicio actualizado', v_description,
      jsonb_build_object('folio', NEW.folio, 'service_date', NEW.service_date, 'start_time', NEW.start_time),
      format('service:%s:updated:%s', NEW.id, v_event_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_service_operator_activity ON public.services;
CREATE TRIGGER trg_capture_service_operator_activity
  AFTER INSERT OR UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.capture_service_operator_activity();

CREATE OR REPLACE FUNCTION public.capture_inspection_operator_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folio text;
  v_event_id text := txid_current()::text;
BEGIN
  SELECT folio INTO v_folio FROM public.services WHERE id = NEW.service_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.insert_operator_activity_event(
      NEW.operator_id, NEW.service_id, 'inspection_saved', 'success', 'Inspección guardada',
      format('La inspección inicial del servicio %s quedó respaldada.', COALESCE(v_folio, 'sin folio')),
      jsonb_build_object('folio', v_folio, 'inspection_id', NEW.id),
      format('inspection:%s:initial:%s', NEW.id, v_event_id)
    );
  ELSIF NEW.pdf_retiro_url IS NOT NULL AND OLD.pdf_retiro_url IS NULL THEN
    PERFORM public.insert_operator_activity_event(
      NEW.operator_id, NEW.service_id, 'delivery_evidence_saved', 'success', 'Entrega respaldada',
      format('La evidencia de entrega del servicio %s quedó sincronizada.', COALESCE(v_folio, 'sin folio')),
      jsonb_build_object('folio', v_folio, 'inspection_id', NEW.id),
      format('inspection:%s:delivery:%s', NEW.id, v_event_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_inspection_operator_activity ON public.inspections;
CREATE TRIGGER trg_capture_inspection_operator_activity
  AFTER INSERT OR UPDATE OF pdf_retiro_url ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.capture_inspection_operator_activity();

CREATE OR REPLACE FUNCTION public.capture_tracking_operator_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folio text;
BEGIN
  IF NEW.service_id IS NOT NULL THEN
    SELECT folio INTO v_folio FROM public.services WHERE id = NEW.service_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.insert_operator_activity_event(
      NEW.operator_id, NEW.service_id, 'tracking_started', 'info', 'Ubicación en directo activa',
      CASE WHEN v_folio IS NULL THEN 'El rastreo de ubicación comenzó.' ELSE format('Rastreo activo para el servicio %s.', v_folio) END,
      jsonb_build_object('folio', v_folio, 'session_id', NEW.id, 'reason', NEW.started_reason),
      format('tracking:%s:started', NEW.id), NEW.started_at
    );
  ELSIF NEW.status = 'stopped' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.insert_operator_activity_event(
      NEW.operator_id, NEW.service_id, 'tracking_stopped',
      CASE WHEN NEW.ended_reason = 'timeout' THEN 'warning' ELSE 'info' END,
      CASE WHEN NEW.ended_reason = 'timeout' THEN 'Ubicación interrumpida' ELSE 'Ubicación en directo detenida' END,
      CASE
        WHEN NEW.ended_reason = 'timeout' THEN 'La sesión dejó de recibir ubicación. Revisa señal y permisos.'
        WHEN NEW.ended_reason = 'schedule_end' THEN 'El rastreo terminó junto con la jornada.'
        WHEN NEW.ended_reason = 'service_change' THEN 'El rastreo cambió al siguiente servicio.'
        ELSE 'El rastreo de ubicación fue detenido.'
      END,
      jsonb_build_object('folio', v_folio, 'session_id', NEW.id, 'reason', NEW.ended_reason),
      format('tracking:%s:stopped', NEW.id), COALESCE(NEW.ended_at, now())
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_tracking_operator_activity ON public.operator_location_sessions;
CREATE TRIGGER trg_capture_tracking_operator_activity
  AFTER INSERT OR UPDATE OF status ON public.operator_location_sessions
  FOR EACH ROW EXECUTE FUNCTION public.capture_tracking_operator_activity();

CREATE OR REPLACE FUNCTION public.mark_all_operator_activity_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operator_id uuid;
  v_count integer;
BEGIN
  v_operator_id := public.get_operator_id_by_user(auth.uid());
  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'El usuario no tiene un operador vinculado';
  END IF;

  UPDATE public.operator_activity_events
  SET read_at = now()
  WHERE operator_id = v_operator_id AND read_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_operator_sync_completed(p_synced_count integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operator_id uuid;
  v_event_id uuid;
BEGIN
  IF p_synced_count < 1 OR p_synced_count > 100 THEN
    RAISE EXCEPTION 'Cantidad sincronizada inválida';
  END IF;

  v_operator_id := public.get_operator_id_by_user(auth.uid());
  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'El usuario no tiene un operador vinculado';
  END IF;

  INSERT INTO public.operator_activity_events (
    operator_id, event_type, severity, title, description, metadata, dedupe_key
  ) VALUES (
    v_operator_id, 'sync_completed', 'success', 'Sincronización completada',
    format('%s inspección(es) pendientes quedaron respaldadas.', p_synced_count),
    jsonb_build_object('synced_count', p_synced_count),
    format('sync:%s:%s', auth.uid(), date_trunc('minute', now()))
  )
  ON CONFLICT (dedupe_key) DO UPDATE
    SET metadata = jsonb_build_object('synced_count', p_synced_count),
        description = format('%s inspección(es) pendientes quedaron respaldadas.', p_synced_count)
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_all_operator_activity_read() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_operator_sync_completed(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_all_operator_activity_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_operator_sync_completed(integer) TO authenticated;

-- Da contexto inicial sin convertir servicios históricos en ruido.
INSERT INTO public.operator_activity_events (
  operator_id, service_id, event_type, severity, title, description, metadata, dedupe_key, created_at
)
SELECT
  s.operator_id,
  s.id,
  CASE s.status
    WHEN 'in_progress' THEN 'service_started'
    WHEN 'inspection_completed' THEN 'delivery_ready'
    ELSE 'service_assigned'
  END,
  CASE WHEN s.status IN ('in_progress', 'inspection_completed') THEN 'success' ELSE 'info' END,
  CASE s.status
    WHEN 'in_progress' THEN 'Servicio en curso'
    WHEN 'inspection_completed' THEN 'Listo para entrega'
    ELSE 'Servicio asignado'
  END,
  format('Servicio %s · %s → %s', s.folio, COALESCE(s.origin, 'Origen pendiente'), COALESCE(s.destination, 'Destino pendiente')),
  jsonb_build_object('folio', s.folio, 'status', s.status, 'service_date', s.service_date, 'snapshot', true),
  format('service:%s:snapshot:%s', s.id, s.status),
  COALESCE(s.updated_at, s.created_at, now())
FROM public.services s
WHERE s.operator_id IS NOT NULL
  AND s.status IN ('pending', 'in_progress', 'inspection_completed')
ON CONFLICT (dedupe_key) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'operator_activity_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.operator_activity_events;
  END IF;
END;
$$;

COMMIT;
