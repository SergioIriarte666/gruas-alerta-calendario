BEGIN;

-- Historial de cambios de ventas LowBoy. Mismo patrón que cost_change_history /
-- service_change_history: tabla dedicada poblada por un trigger SECURITY DEFINER.
-- El negocio es dinámico (los clientes cambian condiciones antes/durante/después de
-- la venta), por lo que este historial es parte central del detalle de la venta.
CREATE TABLE IF NOT EXISTS public.lowboy_sale_change_history (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id        uuid NOT NULL,
  changed_by     uuid,
  changed_at     timestamptz NOT NULL DEFAULT now(),
  change_type    text NOT NULL,
  field_name     text NOT NULL,
  old_value      text,
  new_value      text,
  change_summary text,
  CONSTRAINT lowboy_sale_change_history_change_type_check
    CHECK (change_type IN ('CREATE', 'UPDATE', 'DELETE', 'SNAPSHOT'))
);

COMMENT ON TABLE public.lowboy_sale_change_history IS
  'Auditoría de cambios de public.lowboy_sales (poblada por trigger). Solo lectura desde la app.';

CREATE INDEX IF NOT EXISTS idx_lowboy_sale_change_history_sale
  ON public.lowboy_sale_change_history (sale_id);
CREATE INDEX IF NOT EXISTS idx_lowboy_sale_change_history_changed_at
  ON public.lowboy_sale_change_history (changed_at DESC);

ALTER TABLE public.lowboy_sale_change_history ENABLE ROW LEVEL SECURITY;

-- Lectura para los mismos roles con acceso al módulo LowBoy (admin escribe todo,
-- viewer solo lee). El historial es visible para todos ellos (sin restricción admin).
DROP POLICY IF EXISTS lowboy_sale_change_history_select ON public.lowboy_sale_change_history;
CREATE POLICY lowboy_sale_change_history_select
  ON public.lowboy_sale_change_history
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user_safe()
    OR public.get_current_user_role_safe() = 'viewer'::public.app_role
  );

-- Nadie escribe directo: la única vía de inserción es el trigger (SECURITY DEFINER).
DROP POLICY IF EXISTS lowboy_sale_change_history_no_direct_insert ON public.lowboy_sale_change_history;
CREATE POLICY lowboy_sale_change_history_no_direct_insert
  ON public.lowboy_sale_change_history
  FOR INSERT TO authenticated
  WITH CHECK (false);

GRANT SELECT ON public.lowboy_sale_change_history TO authenticated;
GRANT ALL ON public.lowboy_sale_change_history TO service_role;

-- Trigger de auditoría: registra creación, cambios campo a campo y eliminación.
CREATE OR REPLACE FUNCTION public.track_lowboy_sale_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lowboy_sale_change_history (sale_id, changed_by, change_type, field_name, new_value, change_summary)
    VALUES (
      NEW.id,
      COALESCE(uid, NEW.created_by),
      'CREATE',
      'registro',
      NEW.description,
      'Venta creada: ' || COALESCE(NEW.description, '(sin descripción)') || ' · ' || NEW.client_name || ' por $' || COALESCE(NEW.net_amount::text, '0')
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.sale_type IS DISTINCT FROM OLD.sale_type THEN
      INSERT INTO public.lowboy_sale_change_history (sale_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'sale_type', OLD.sale_type, NEW.sale_type, 'Tipo de venta cambiado');
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.lowboy_sale_change_history (sale_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'status', OLD.status, NEW.status, 'Estado cambió de ' || OLD.status || ' a ' || NEW.status);
    END IF;
    IF NEW.client_rut IS DISTINCT FROM OLD.client_rut THEN
      INSERT INTO public.lowboy_sale_change_history (sale_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'client_rut', OLD.client_rut, NEW.client_rut, 'RUT del cliente actualizado');
    END IF;
    IF NEW.client_name IS DISTINCT FROM OLD.client_name THEN
      INSERT INTO public.lowboy_sale_change_history (sale_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'client_name', OLD.client_name, NEW.client_name, 'Razón social actualizada');
    END IF;
    IF NEW.description IS DISTINCT FROM OLD.description THEN
      INSERT INTO public.lowboy_sale_change_history (sale_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'description', OLD.description, NEW.description, 'Descripción actualizada');
    END IF;
    IF NEW.origin IS DISTINCT FROM OLD.origin THEN
      INSERT INTO public.lowboy_sale_change_history (sale_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'origin', OLD.origin, NEW.origin, 'Origen actualizado');
    END IF;
    IF NEW.destination IS DISTINCT FROM OLD.destination THEN
      INSERT INTO public.lowboy_sale_change_history (sale_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'destination', OLD.destination, NEW.destination, 'Destino actualizado');
    END IF;
    IF NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date THEN
      INSERT INTO public.lowboy_sale_change_history (sale_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'scheduled_date', OLD.scheduled_date::text, NEW.scheduled_date::text, 'Fecha comprometida actualizada');
    END IF;
    IF NEW.executed_date IS DISTINCT FROM OLD.executed_date THEN
      INSERT INTO public.lowboy_sale_change_history (sale_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'executed_date', OLD.executed_date::text, NEW.executed_date::text, 'Fecha de ejecución actualizada');
    END IF;
    IF NEW.net_amount IS DISTINCT FROM OLD.net_amount THEN
      INSERT INTO public.lowboy_sale_change_history (sale_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'net_amount', OLD.net_amount::text, NEW.net_amount::text, 'Neto cambió de $' || OLD.net_amount || ' a $' || NEW.net_amount);
    END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN
      INSERT INTO public.lowboy_sale_change_history (sale_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'notes', OLD.notes, NEW.notes, 'Notas actualizadas');
    END IF;
    -- Nota: la vinculación de factura vive en sii_rcv_records.linked_sale_id, no en
    -- lowboy_sales, por lo que no se audita como campo de esta tabla.
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.lowboy_sale_change_history (sale_id, changed_by, change_type, field_name, old_value, change_summary)
    VALUES (OLD.id, uid, 'DELETE', 'registro', OLD.description,
      'Venta eliminada: ' || COALESCE(OLD.description, '(sin descripción)') || ' · ' || OLD.client_name);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.track_lowboy_sale_changes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_track_lowboy_sale_changes ON public.lowboy_sales;
CREATE TRIGGER trg_track_lowboy_sale_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.lowboy_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.track_lowboy_sale_changes();

COMMIT;
