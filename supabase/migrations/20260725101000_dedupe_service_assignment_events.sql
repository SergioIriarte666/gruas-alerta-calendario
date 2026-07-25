-- Elimina la notificación duplicada "Nuevo servicio asignado".
--
-- Al crear un servicio con operador llegaban dos eventos service_assigned
-- idénticos con ~0,5 s de diferencia: uno del INSERT en services
-- (capture_service_operator_activity) y otro de la ruta de asignación de
-- recursos (capture_service_resource_operator_activity, metadata
-- "resource_assignment": true).
--
-- insert_operator_activity_event ya deduplica con ON CONFLICT (dedupe_key) DO
-- NOTHING, pero ambas llaves incluían txid_current(): transacciones distintas
-- => llaves distintas => el anti-duplicado nunca enganchaba.
--
-- Se quita el txid de las llaves de asignación/desasignación. La llave estable
-- 'service:<id>:assigned:<operator_id>' hace que la segunda emisión choque y se
-- descarte sola, sin importar cuál de las dos rutas llegue primero.
--
-- Los eventos de cambio de estado (service_started, service_completed, ...) SÍ
-- conservan el txid: un servicio puede pasar dos veces por el mismo estado
-- legítimamente y esos eventos no deben colapsarse.
--
-- Contrapartida aceptada de la llave estable: si un servicio se reasigna
-- A -> B -> A, el segundo "asignado" a A queda deduplicado contra el primero y
-- no vuelve a notificarse. Se prefiere ese caso (raro, y el operador ya conoce
-- el servicio) al duplicado sistemático en cada alta, que era el defecto real.

BEGIN;

CREATE OR REPLACE FUNCTION public.capture_service_operator_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        format('service:%s:assigned:%s', NEW.id, NEW.operator_id)
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
        format('service:%s:unassigned:%s', NEW.id, OLD.operator_id)
      );
    END IF;

    IF NEW.operator_id IS NOT NULL THEN
      PERFORM public.insert_operator_activity_event(
        NEW.operator_id, NEW.id, 'service_assigned', 'info',
        'Nuevo servicio asignado',
        format('Servicio %s · %s → %s', NEW.folio, COALESCE(NEW.origin, 'Origen pendiente'), COALESCE(NEW.destination, 'Destino pendiente')),
        jsonb_build_object('folio', NEW.folio, 'status', NEW.status, 'service_date', NEW.service_date),
        format('service:%s:assigned:%s', NEW.id, NEW.operator_id)
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
$function$;

-- La ruta de service_resources debe usar exactamente la misma llave estable, o
-- el ON CONFLICT nunca engancha entre las dos fuentes.
CREATE OR REPLACE FUNCTION public.capture_service_resource_operator_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_service public.services%ROWTYPE;
  v_new_service public.services%ROWTYPE;
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
        format('service:%s:unassigned:%s', OLD.service_id, OLD.operator_id)
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
        format('service:%s:assigned:%s', NEW.service_id, NEW.operator_id)
      );
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_service_operator_activity()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_service_resource_operator_activity()
  FROM PUBLIC, anon, authenticated;

COMMIT;
