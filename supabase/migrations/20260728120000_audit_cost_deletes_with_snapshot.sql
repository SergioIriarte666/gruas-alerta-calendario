-- Auditoría completa de costos: un borrado sin rastro destruye la evidencia de sí mismo.
--
-- Estado previo (verificado en producción el 28/07):
--   * trigger_track_cost_changes YA cubría INSERT/UPDATE/DELETE y ninguna
--     bandera de sync lo apagaba. El agujero no era "no audita borrados", era
--     QUÉ audita: en DELETE guardaba solo la descripción en old_value, así que
--     el monto, la fecha, el operador y el servicio del costo borrado se perdían
--     igual. Reconstruir a mano exigía adivinar.
--   * service_id NO estaba entre los campos auditados en UPDATE: mover un costo
--     de un servicio a otro era invisible. Es exactamente el modo de falla que
--     se lee como "el costo desapareció" desde la ficha del servicio original
--     (el viático del 26/07 nunca se borró: vive colgado de otro folio).
--   * change_context llegaba siempre NULL, así que un borrado intencional y uno
--     por bug eran indistinguibles en el historial.
--
-- Reglas que fija esta migración:
--   1. El DELETE guarda la fila COMPLETA (to_jsonb) en old_value.
--   2. service_id / entity / paid_by / payment_batch_id entran a la auditoría de UPDATE.
--   3. change_context se puebla con el origen del cambio cuando se conoce.
--   4. La auditoría NUNCA se salta. Las banderas de sync (app.sync_in_progress,
--      app.bidirectional_sync, app.cascade_delete) pueden saltarse PROTECCIONES
--      —costo pagado, grúa dada de baja— pero jamás la auditoría: aquí solo
--      sirven para ETIQUETAR el origen, nunca para silenciar el registro.
--
-- BACKFILL: imposible. Los borrados anteriores a esta migración no dejaron
-- snapshot (solo descripción) y los previos a la existencia del trigger no
-- dejaron nada. No hay fuente desde la cual reconstruirlos: cost_change_history,
-- audit_log y recovery_audit_entries son las tres únicas huellas y ninguna
-- guarda lo que no se escribió. Se documenta y se sigue hacia adelante.

BEGIN;

-- Origen del cambio. Precedencia: lo que declare explícitamente el llamador
-- (app.change_context), luego lo que se deduzca de las banderas de flujo, y por
-- último 'system' cuando no hay sesión de usuario (cron, trigger de servidor).
CREATE OR REPLACE FUNCTION public.resolve_cost_change_context()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.change_context', true), ''),
    CASE
      WHEN current_setting('app.cascade_delete', true) = 'true' THEN 'cascade_delete'
      WHEN current_setting('app.commission_autoflow', true) = 'true' THEN 'commission_sync'
      WHEN current_setting('app.sync_in_progress', true) = 'true' THEN 'sync'
      WHEN current_setting('app.bidirectional_sync', true) = 'true' THEN 'sync'
      WHEN auth.uid() IS NULL THEN 'system'
      ELSE NULL
    END
  );
$$;

COMMENT ON FUNCTION public.resolve_cost_change_context() IS
  'Origen del cambio para cost_change_history.change_context. Sin origen no se distingue un borrado intencional de uno por bug.';

REVOKE ALL ON FUNCTION public.resolve_cost_change_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_cost_change_context() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.track_cost_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid UUID := auth.uid();
  ctx TEXT := public.resolve_cost_change_context();
  v_folio TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, new_value, change_summary, change_context)
    VALUES (
      NEW.id,
      COALESCE(uid, NEW.created_by),
      'CREATE',
      'registro',
      NEW.description,
      'Costo creado: ' || COALESCE(NEW.description, '(sin descripción)') || ' por $' || COALESCE(NEW.amount::TEXT, '0'),
      ctx
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary, change_context)
      VALUES (NEW.id, uid, 'UPDATE', 'amount', OLD.amount::TEXT, NEW.amount::TEXT,
        'Monto cambió de $' || OLD.amount || ' a $' || NEW.amount, ctx);
    END IF;
    IF NEW.description IS DISTINCT FROM OLD.description THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary, change_context)
      VALUES (NEW.id, uid, 'UPDATE', 'description', OLD.description, NEW.description,
        'Descripción actualizada', ctx);
    END IF;
    IF NEW.date IS DISTINCT FROM OLD.date THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary, change_context)
      VALUES (NEW.id, uid, 'UPDATE', 'date', OLD.date::TEXT, NEW.date::TEXT,
        'Fecha cambió de ' || OLD.date || ' a ' || NEW.date, ctx);
    END IF;
    IF NEW.category_id IS DISTINCT FROM OLD.category_id THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary, change_context)
      VALUES (NEW.id, uid, 'UPDATE', 'category_id', OLD.category_id::TEXT, NEW.category_id::TEXT, 'Categoría cambiada', ctx);
    END IF;
    IF NEW.subcategory IS DISTINCT FROM OLD.subcategory THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary, change_context)
      VALUES (NEW.id, uid, 'UPDATE', 'subcategory', OLD.subcategory, NEW.subcategory, 'Subcategoría cambiada', ctx);
    END IF;
    IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary, change_context)
      VALUES (NEW.id, uid, 'UPDATE', 'supplier_id', OLD.supplier_id::TEXT, NEW.supplier_id::TEXT, 'Proveedor cambiado', ctx);
    END IF;
    IF NEW.crane_id IS DISTINCT FROM OLD.crane_id THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary, change_context)
      VALUES (NEW.id, uid, 'UPDATE', 'crane_id', OLD.crane_id::TEXT, NEW.crane_id::TEXT, 'Grúa cambiada', ctx);
    END IF;
    IF NEW.operator_id IS DISTINCT FROM OLD.operator_id THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary, change_context)
      VALUES (NEW.id, uid, 'UPDATE', 'operator_id', OLD.operator_id::TEXT, NEW.operator_id::TEXT, 'Operador cambiado', ctx);
    END IF;
    -- Mover un costo de servicio es lo que se ve como "el costo desapareció"
    -- desde la ficha del servicio original. Sin esta línea, es invisible.
    IF NEW.service_id IS DISTINCT FROM OLD.service_id THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary, change_context)
      VALUES (NEW.id, uid, 'UPDATE', 'service_id', OLD.service_id::TEXT, NEW.service_id::TEXT,
        'Costo movido del servicio ' || COALESCE(OLD.service_folio, OLD.service_id::TEXT, '(ninguno)') ||
        ' al servicio ' || COALESCE(NEW.service_folio, NEW.service_id::TEXT, '(ninguno)'), ctx);
    END IF;
    IF NEW.entity IS DISTINCT FROM OLD.entity THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary, change_context)
      VALUES (NEW.id, uid, 'UPDATE', 'entity', OLD.entity, NEW.entity, 'Empresa del costo cambiada', ctx);
    END IF;
    IF NEW.paid_by IS DISTINCT FROM OLD.paid_by THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary, change_context)
      VALUES (NEW.id, uid, 'UPDATE', 'paid_by', OLD.paid_by, NEW.paid_by, 'Financiador del costo cambiado', ctx);
    END IF;
    IF NEW.payment_date IS DISTINCT FROM OLD.payment_date THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary, change_context)
      VALUES (NEW.id, uid, 'UPDATE', 'payment_date', OLD.payment_date::TEXT, NEW.payment_date::TEXT,
        CASE WHEN OLD.payment_date IS NULL AND NEW.payment_date IS NOT NULL THEN 'Marcado como pagado el ' || NEW.payment_date
             WHEN OLD.payment_date IS NOT NULL AND NEW.payment_date IS NULL THEN 'Marcado como NO pagado'
             ELSE 'Fecha de pago cambió de ' || OLD.payment_date || ' a ' || NEW.payment_date END, ctx);
    END IF;
    IF NEW.payment_batch_id IS DISTINCT FROM OLD.payment_batch_id THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary, change_context)
      VALUES (NEW.id, uid, 'UPDATE', 'payment_batch_id', OLD.payment_batch_id::TEXT, NEW.payment_batch_id::TEXT,
        CASE WHEN NEW.payment_batch_id IS NULL THEN 'Sacado del lote de pago' ELSE 'Incluido en un lote de pago' END, ctx);
    END IF;
    IF NEW.document_number IS DISTINCT FROM OLD.document_number THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary, change_context)
      VALUES (NEW.id, uid, 'UPDATE', 'document_number', OLD.document_number, NEW.document_number, 'N° documento actualizado', ctx);
    END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary, change_context)
      VALUES (NEW.id, uid, 'UPDATE', 'notes', OLD.notes, NEW.notes, 'Notas actualizadas', ctx);
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- El folio desnormalizado puede venir vacío en filas antiguas; se resuelve
    -- contra services para que el resumen sea legible sin cruzar tablas.
    v_folio := COALESCE(
      NULLIF(OLD.service_folio, ''),
      (SELECT s.folio FROM public.services s WHERE s.id = OLD.service_id),
      '(sin servicio)'
    );

    -- old_value lleva la fila COMPLETA: es la única copia que quedará de ella.
    -- changed_by queda NULL cuando no hay sesión (borrado de servidor); el
    -- 'system' correspondiente viaja en change_context, porque changed_by es
    -- una FK a profiles y no admite un literal.
    INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, change_summary, change_context)
    VALUES (
      OLD.id,
      uid,
      'DELETE',
      'registro',
      to_jsonb(OLD)::text,
      'Costo eliminado: ' || COALESCE(NULLIF(OLD.description, ''), '(sin descripción)') ||
        ' por $' || COALESCE(OLD.amount::TEXT, '0') ||
        ' del servicio ' || v_folio ||
        ' (fecha ' || COALESCE(OLD.date::TEXT, 's/f') || ')',
      COALESCE(ctx, 'system')
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.track_cost_changes() IS
  'Auditoría de costos. En DELETE guarda la fila completa en old_value: es la única copia que queda. Ninguna bandera de sync la apaga.';

-- ENABLE ALWAYS: la auditoría también debe correr si alguna sesión llegara a
-- ponerse en session_replication_role='replica' (el atajo clásico para "apagar
-- triggers un momento"). Las protecciones pueden ceder; el registro no.
ALTER TABLE public.costs ENABLE ALWAYS TRIGGER trigger_track_cost_changes;

-- Borrado de costo con origen declarado. El cliente deja de usar
-- .from('costs').delete() a secas: sin este envoltorio el borrado queda
-- auditado pero anónimo en cuanto a QUÉ pantalla lo pidió.
--
-- SECURITY INVOKER a propósito: el borrado sigue pasando por las RLS y por los
-- triggers de protección del que lo pide. Esto solo agrega la etiqueta.
CREATE OR REPLACE FUNCTION public.delete_cost_with_context(
  p_cost_id uuid,
  p_context text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_service_id uuid;
BEGIN
  IF p_cost_id IS NULL THEN
    RAISE EXCEPTION 'Falta el id del costo a eliminar' USING ERRCODE = '22023';
  END IF;

  IF p_context IS NOT NULL AND p_context NOT IN ('wizard', 'costs_module', 'cascade_delete', 'sql', 'import', 'commission_sync') THEN
    RAISE EXCEPTION 'Origen de cambio no reconocido: %', p_context USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.change_context', COALESCE(p_context, 'costs_module'), true);

  SELECT service_id INTO v_service_id FROM public.costs WHERE id = p_cost_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El costo % ya no existe', p_cost_id USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.costs WHERE id = p_cost_id;

  -- Si las RLS del que llama no le permiten borrar, el DELETE afecta 0 filas y
  -- PostgREST devolvería "éxito". Un borrado que no borró no es un éxito.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tienes permiso para eliminar el costo %', p_cost_id USING ERRCODE = '42501';
  END IF;

  RETURN v_service_id;
END;
$$;

COMMENT ON FUNCTION public.delete_cost_with_context(uuid, text) IS
  'Elimina un costo dejando el origen del cambio en cost_change_history.change_context. Falla en vez de reportar éxito si no se borró nada.';

REVOKE ALL ON FUNCTION public.delete_cost_with_context(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_cost_with_context(uuid, text) TO authenticated;

COMMIT;
