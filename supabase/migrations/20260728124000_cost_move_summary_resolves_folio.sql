-- Segundo ajuste sobre 20260728120000, también salido del ensayo contra la base.
--
-- El resumen del cambio de servicio salía "Costo movido del servicio X al
-- servicio X": leía OLD.service_folio y NEW.service_folio, que son el mismo
-- snapshot desnormalizado en el instante del UPDATE —el trigger que propaga el
-- folio corre por su cuenta y no reescribe la fila en la misma sentencia—. La
-- línea que existe justamente para hacer visible el traslado de un costo entre
-- servicios no puede nombrar dos veces el mismo folio.
--
-- Ahora los folios se resuelven contra services por el id de cada lado, que es
-- el dato que efectivamente cambió, con el snapshot como respaldo para costos
-- cuyo servicio ya no existe.

BEGIN;

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
  v_old_folio TEXT;
  v_new_folio TEXT;
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
      SELECT s.folio INTO v_old_folio FROM public.services s WHERE s.id = OLD.service_id;
      SELECT s.folio INTO v_new_folio FROM public.services s WHERE s.id = NEW.service_id;

      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary, change_context)
      VALUES (NEW.id, uid, 'UPDATE', 'service_id', OLD.service_id::TEXT, NEW.service_id::TEXT,
        'Costo movido del servicio ' || COALESCE(v_old_folio, NULLIF(OLD.service_folio, ''), OLD.service_id::TEXT, '(ninguno)') ||
        ' al servicio ' || COALESCE(v_new_folio, NULLIF(NEW.service_folio, ''), NEW.service_id::TEXT, '(ninguno)'), ctx);
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
    v_folio := COALESCE(
      NULLIF(OLD.service_folio, ''),
      (SELECT s.folio FROM public.services s WHERE s.id = OLD.service_id),
      '(sin servicio)'
    );

    -- old_value lleva la fila COMPLETA: es la única copia que quedará de ella.
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

COMMIT;
