BEGIN;

-- Las asignaciones pueden vivir en services.operator_id o en service_resources.
-- La primera versión de la bitácora sólo observaba la columna directa.
CREATE OR REPLACE FUNCTION public.capture_service_resource_operator_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_service public.services%ROWTYPE;
  v_new_service public.services%ROWTYPE;
  v_event_id text := txid_current()::text;
  v_remove_assignment boolean := false;
  v_add_assignment boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_remove_assignment := OLD.resource_type = 'operator' AND OLD.operator_id IS NOT NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_add_assignment := NEW.resource_type = 'operator' AND NEW.operator_id IS NOT NULL;
  ELSE
    v_remove_assignment := OLD.resource_type = 'operator'
      AND OLD.operator_id IS NOT NULL
      AND (
        NEW.resource_type IS DISTINCT FROM OLD.resource_type
        OR NEW.operator_id IS DISTINCT FROM OLD.operator_id
        OR NEW.service_id IS DISTINCT FROM OLD.service_id
      );
    v_add_assignment := NEW.resource_type = 'operator'
      AND NEW.operator_id IS NOT NULL
      AND (
        NEW.resource_type IS DISTINCT FROM OLD.resource_type
        OR NEW.operator_id IS DISTINCT FROM OLD.operator_id
        OR NEW.service_id IS DISTINCT FROM OLD.service_id
      );
  END IF;

  IF v_remove_assignment THEN
    SELECT * INTO v_old_service FROM public.services WHERE id = OLD.service_id;
    IF FOUND THEN
      PERFORM public.insert_operator_activity_event(
        OLD.operator_id, OLD.service_id, 'service_unassigned', 'warning',
        'Servicio reasignado',
        format('El servicio %s dejó de estar asignado a tu jornada.', v_old_service.folio),
        jsonb_build_object('folio', v_old_service.folio, 'resource_assignment', true),
        format('service:%s:unassigned:%s:%s', OLD.service_id, OLD.operator_id, v_event_id)
      );
    END IF;
  END IF;

  IF v_add_assignment THEN
    SELECT * INTO v_new_service FROM public.services WHERE id = NEW.service_id;
    IF FOUND THEN
      PERFORM public.insert_operator_activity_event(
        NEW.operator_id, NEW.service_id, 'service_assigned', 'info',
        'Nuevo servicio asignado',
        format(
          'Servicio %s · %s → %s',
          v_new_service.folio,
          COALESCE(v_new_service.origin, 'Origen pendiente'),
          COALESCE(v_new_service.destination, 'Destino pendiente')
        ),
        jsonb_build_object(
          'folio', v_new_service.folio,
          'status', v_new_service.status,
          'service_date', v_new_service.service_date,
          'resource_assignment', true
        ),
        format('service:%s:assigned:%s:%s', NEW.service_id, NEW.operator_id, v_event_id)
      );
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_service_resource_operator_activity ON public.service_resources;
CREATE TRIGGER trg_capture_service_resource_operator_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.service_resources
  FOR EACH ROW EXECUTE FUNCTION public.capture_service_resource_operator_activity();

-- Propaga cambios del servicio a operadores secundarios. El operador principal sigue
-- cubierto por trg_capture_service_operator_activity, evitando eventos duplicados.
CREATE OR REPLACE FUNCTION public.capture_secondary_operator_service_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operator_id uuid;
  v_event_id text := txid_current()::text;
BEGIN
  FOR v_operator_id IN
    SELECT DISTINCT sr.operator_id
    FROM public.service_resources sr
    WHERE sr.service_id = NEW.id
      AND sr.resource_type = 'operator'
      AND sr.operator_id IS NOT NULL
      AND sr.operator_id IS DISTINCT FROM NEW.operator_id
  LOOP
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      CASE NEW.status
        WHEN 'in_progress' THEN
          PERFORM public.insert_operator_activity_event(
            v_operator_id, NEW.id, 'service_started', 'success', 'Servicio iniciado',
            format('El servicio %s está ahora en curso.', NEW.folio),
            jsonb_build_object('folio', NEW.folio, 'previous_status', OLD.status, 'status', NEW.status),
            format('service:%s:status:%s:%s:%s', NEW.id, NEW.status, v_operator_id, v_event_id)
          );
        WHEN 'inspection_completed' THEN
          PERFORM public.insert_operator_activity_event(
            v_operator_id, NEW.id, 'delivery_ready', 'success', 'Listo para entrega',
            format('La inspección del servicio %s quedó completa.', NEW.folio),
            jsonb_build_object('folio', NEW.folio, 'previous_status', OLD.status, 'status', NEW.status),
            format('service:%s:status:%s:%s:%s', NEW.id, NEW.status, v_operator_id, v_event_id)
          );
        WHEN 'completed' THEN
          PERFORM public.insert_operator_activity_event(
            v_operator_id, NEW.id, 'service_completed', 'success', 'Servicio finalizado',
            format('El servicio %s fue completado correctamente.', NEW.folio),
            jsonb_build_object('folio', NEW.folio, 'previous_status', OLD.status, 'status', NEW.status),
            format('service:%s:status:%s:%s:%s', NEW.id, NEW.status, v_operator_id, v_event_id)
          );
        WHEN 'cancelled' THEN
          PERFORM public.insert_operator_activity_event(
            v_operator_id, NEW.id, 'service_cancelled', 'warning', 'Servicio cancelado',
            format('El servicio %s fue cancelado.', NEW.folio),
            jsonb_build_object('folio', NEW.folio, 'previous_status', OLD.status, 'status', NEW.status),
            format('service:%s:status:%s:%s:%s', NEW.id, NEW.status, v_operator_id, v_event_id)
          );
        WHEN 'failed' THEN
          PERFORM public.insert_operator_activity_event(
            v_operator_id, NEW.id, 'service_cancelled', 'critical', 'Servicio con incidencia',
            format('El servicio %s fue marcado con falla.', NEW.folio),
            jsonb_build_object('folio', NEW.folio, 'previous_status', OLD.status, 'status', NEW.status),
            format('service:%s:status:%s:%s:%s', NEW.id, NEW.status, v_operator_id, v_event_id)
          );
        ELSE NULL;
      END CASE;
    ELSIF
      NEW.service_date IS DISTINCT FROM OLD.service_date
      OR NEW.start_time IS DISTINCT FROM OLD.start_time
      OR NEW.origin IS DISTINCT FROM OLD.origin
      OR NEW.destination IS DISTINCT FROM OLD.destination
      OR NEW.crane_id IS DISTINCT FROM OLD.crane_id
    THEN
      PERFORM public.insert_operator_activity_event(
        v_operator_id, NEW.id, 'service_updated', 'info', 'Servicio actualizado',
        format('Se actualizaron los datos operativos del servicio %s.', NEW.folio),
        jsonb_build_object('folio', NEW.folio, 'service_date', NEW.service_date, 'start_time', NEW.start_time),
        format('service:%s:updated:%s:%s', NEW.id, v_operator_id, v_event_id)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_secondary_operator_service_activity ON public.services;
CREATE TRIGGER trg_capture_secondary_operator_service_activity
  AFTER UPDATE OF status, service_date, start_time, origin, destination, crane_id ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.capture_secondary_operator_service_activity();

-- Recupera inmediatamente la actividad visible para cualquier asignación actual que
-- no haya recibido eventos, incluida la realizada sólo mediante service_resources.
WITH assigned_operators AS (
  SELECT s.id AS service_id, s.operator_id
  FROM public.services s
  WHERE s.operator_id IS NOT NULL
  UNION
  SELECT sr.service_id, sr.operator_id
  FROM public.service_resources sr
  WHERE sr.resource_type = 'operator' AND sr.operator_id IS NOT NULL
)
INSERT INTO public.operator_activity_events (
  operator_id, service_id, event_type, severity, title, description, metadata, dedupe_key, created_at
)
SELECT
  assignment.operator_id,
  service.id,
  CASE service.status
    WHEN 'in_progress' THEN 'service_started'
    WHEN 'inspection_completed' THEN 'delivery_ready'
    ELSE 'service_assigned'
  END,
  CASE WHEN service.status IN ('in_progress', 'inspection_completed') THEN 'success' ELSE 'info' END,
  CASE service.status
    WHEN 'in_progress' THEN 'Servicio en curso'
    WHEN 'inspection_completed' THEN 'Listo para entrega'
    ELSE 'Servicio asignado'
  END,
  format(
    'Servicio %s · %s → %s',
    service.folio,
    COALESCE(service.origin, 'Origen pendiente'),
    COALESCE(service.destination, 'Destino pendiente')
  ),
  jsonb_build_object(
    'folio', service.folio,
    'status', service.status,
    'service_date', service.service_date,
    'snapshot', true
  ),
  format('service:%s:snapshot:%s:%s', service.id, service.status, assignment.operator_id),
  COALESCE(service.updated_at, service.created_at, now())
FROM assigned_operators assignment
JOIN public.services service ON service.id = assignment.service_id
WHERE service.status IN ('pending', 'in_progress', 'inspection_completed')
  AND NOT EXISTS (
    SELECT 1
    FROM public.operator_activity_events existing
    WHERE existing.operator_id = assignment.operator_id
      AND existing.service_id = service.id
  )
ON CONFLICT (dedupe_key) DO NOTHING;

COMMIT;
