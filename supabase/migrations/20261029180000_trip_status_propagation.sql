-- Propagación de estado operativo padre → hijos en viajes multi-vehículo.
--
-- El operador trabaja el VIAJE (padre): cuando el padre pasa a un estado
-- operativo ('in_progress', 'completed', 'cancelled', 'failed') todos sus
-- hijos lo acompañan, incluidos los "Con O.C." (la O.C. queda en su campo y el
-- hijo sigue siendo candidato a cierre como Completado). La facturación sigue
-- siendo individual por hijo: 'invoiced' / 'partially_invoiced' los pone el
-- cierre de cada cliente y 'written_off' solo el RPC write_off_service; esos
-- hijos nunca se tocan. Un solo nivel, sin recursión (un hijo jamás es padre).
--
-- Convivencia con enforce_service_close_double_key: ese trigger exige, para
-- un operador asignado, que el cierre venga de complete_service con la llave
-- app.via_complete_service = id del servicio. El cierre del viaje ya validó
-- folio y asignación para el padre; aquí se extiende la llave a cada hijo
-- durante su UPDATE (mismo mecanismo de GUC de sesión del proyecto, nunca se
-- deshabilitan triggers) y se restaura el valor previo.

BEGIN;

CREATE OR REPLACE FUNCTION public.propagate_trip_status_to_children()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_child_id uuid;
  v_prev_key text;
BEGIN
  IF NOT NEW.is_trip_parent THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status::text NOT IN ('in_progress', 'completed', 'cancelled', 'failed') THEN
    RETURN NEW;
  END IF;

  v_prev_key := COALESCE(current_setting('app.via_complete_service', true), '');

  FOR v_child_id IN
    SELECT c.id
    FROM public.services c
    WHERE c.trip_parent_id = NEW.id
      AND c.status::text NOT IN ('invoiced', 'partially_invoiced', 'written_off')
      AND c.status IS DISTINCT FROM NEW.status
    ORDER BY c.folio
  LOOP
    PERFORM set_config('app.via_complete_service', v_child_id::text, true);

    UPDATE public.services
    SET status = NEW.status
    WHERE id = v_child_id;
  END LOOP;

  PERFORM set_config('app.via_complete_service', v_prev_key, true);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.propagate_trip_status_to_children() IS
  'Viajes multi-vehículo: el estado operativo del padre (in_progress/completed/cancelled/failed) se copia a los hijos no facturados ni castigados. Un nivel, sin recursión.';

DROP TRIGGER IF EXISTS trg_propagate_trip_status_to_children ON public.services;
CREATE TRIGGER trg_propagate_trip_status_to_children
  AFTER UPDATE OF status ON public.services
  FOR EACH ROW
  WHEN (NEW.is_trip_parent)
  EXECUTE FUNCTION public.propagate_trip_status_to_children();

-- Alineación de los viajes existentes: hijos no facturados ni castigados de
-- un padre en estado operativo quedan en el estado del padre. Idempotente.
-- Corre como postgres (auth.uid() NULL): enforce_service_close_double_key no
-- aplica y no hace falta la llave.
UPDATE public.services c
SET status = p.status
FROM public.services p
WHERE c.trip_parent_id = p.id
  AND p.is_trip_parent
  AND p.status::text IN ('in_progress', 'completed', 'cancelled', 'failed')
  AND c.status::text NOT IN ('invoiced', 'partially_invoiced', 'written_off')
  AND c.status IS DISTINCT FROM p.status;

COMMIT;
