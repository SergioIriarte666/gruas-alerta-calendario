-- Propagación servicio → costos cuando cambia la grúa o el operador.
--
-- Caso real: 3274759-1 se creó con la grúa TLYF-23, se corrigió a TDCJ-46, y
-- los costos Combustible/Viático quedaron pegados a la grúa vieja. La
-- corrección de datos ya se aplicó a mano; esto es la regla permanente.
--
-- Vive en el servidor a propósito: aplica igual desde el panel admin, el portal
-- operador, una edge function o SQL directo.

BEGIN;

CREATE OR REPLACE FUNCTION public.propagate_service_resource_to_costs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  -- Marca que deja el formulario de servicio al crear el costo. Es la única
  -- señal de "este costo pertenece al recurso del servicio"; un costo escrito
  -- a mano contra otra grúa no se toca.
  c_form_note CONSTANT text := 'Costo desde formulario de servicio';
  v_prev_sync text;
BEGIN
  IF NEW.crane_id IS NOT DISTINCT FROM OLD.crane_id
     AND NEW.operator_id IS NOT DISTINCT FROM OLD.operator_id THEN
    RETURN NEW;
  END IF;

  -- prevent_non_admin_updates_on_paid_costs frena cualquier UPDATE sobre un
  -- costo pagado. Corregir a qué grúa/operador pertenece no altera monto ni
  -- fecha de pago, así que este sync legítimo pasa por la bandera diseñada
  -- para eso. Se guarda el valor previo: este trigger corre dentro de la
  -- transacción de otro que quizá ya la tenía puesta.
  v_prev_sync := COALESCE(current_setting('app.sync_in_progress', true), '');
  PERFORM set_config('app.sync_in_progress', 'true', true);

  IF NEW.crane_id IS DISTINCT FROM OLD.crane_id THEN
    -- crane_id = OLD.crane_id: en un servicio multi-recurso (service_resources
    -- con dos grúas) los costos de la grúa secundaria se quedan donde están.
    UPDATE public.costs
    SET crane_id = NEW.crane_id,
        updated_at = now()
    WHERE service_id = NEW.id
      AND crane_id IS NOT DISTINCT FROM OLD.crane_id
      AND notes = c_form_note;
  END IF;

  IF NEW.operator_id IS DISTINCT FROM OLD.operator_id THEN
    UPDATE public.costs
    SET operator_id = NEW.operator_id,
        updated_at = now()
    WHERE service_id = NEW.id
      AND operator_id IS NOT DISTINCT FROM OLD.operator_id
      AND notes = c_form_note;
  END IF;

  PERFORM set_config('app.sync_in_progress', v_prev_sync, true);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS propagate_service_resource_to_costs_trigger ON public.services;

CREATE TRIGGER propagate_service_resource_to_costs_trigger
AFTER UPDATE OF crane_id, operator_id ON public.services
FOR EACH ROW EXECUTE FUNCTION public.propagate_service_resource_to_costs();

COMMIT;
