
-- =====================================================
-- Trigger: Sincronizar edición de supplier_invoices → supplier_payments → costs
-- Cuando se edita una factura (fecha, monto, etc), propagar a pagos y costos vinculados
-- =====================================================

CREATE OR REPLACE FUNCTION public.sync_supplier_invoice_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo en UPDATE
  IF TG_OP != 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Verificar si cambió algo relevante
  IF (OLD.due_date IS DISTINCT FROM NEW.due_date) OR
     (OLD.issue_date IS DISTINCT FROM NEW.issue_date) OR
     (OLD.amount IS DISTINCT FROM NEW.amount) OR
     (OLD.net_amount IS DISTINCT FROM NEW.net_amount) OR
     (OLD.status IS DISTINCT FROM NEW.status) OR
     (OLD.description IS DISTINCT FROM NEW.description) THEN

    -- 1. Actualizar supplier_payments vinculados via supplier_invoice_id
    UPDATE supplier_payments SET
      due_date = CASE WHEN OLD.due_date IS DISTINCT FROM NEW.due_date THEN NEW.due_date ELSE due_date END,
      amount = CASE WHEN OLD.amount IS DISTINCT FROM NEW.amount THEN NEW.amount ELSE amount END,
      description = CASE WHEN OLD.description IS DISTINCT FROM NEW.description THEN COALESCE(NEW.description, description) ELSE description END,
      updated_at = now()
    WHERE supplier_invoice_id = NEW.id;

    -- 2. Actualizar costs vinculados a esos payments (via cost_id en supplier_payments)
    UPDATE costs SET
      date = CASE WHEN OLD.due_date IS DISTINCT FROM NEW.due_date THEN NEW.due_date ELSE date END,
      amount = CASE WHEN OLD.amount IS DISTINCT FROM NEW.amount THEN NEW.amount ELSE amount END,
      description = CASE WHEN OLD.description IS DISTINCT FROM NEW.description THEN COALESCE(NEW.description, description) ELSE description END,
      updated_at = now()
    WHERE supplier_payment_id IN (
      SELECT id FROM supplier_payments WHERE supplier_invoice_id = NEW.id
    );

    -- 3. También actualizar costs que tengan cost_id referenciado desde payments
    UPDATE costs SET
      date = CASE WHEN OLD.due_date IS DISTINCT FROM NEW.due_date THEN NEW.due_date ELSE date END,
      amount = CASE WHEN OLD.amount IS DISTINCT FROM NEW.amount THEN NEW.amount ELSE amount END,
      description = CASE WHEN OLD.description IS DISTINCT FROM NEW.description THEN COALESCE(NEW.description, description) ELSE description END,
      updated_at = now()
    WHERE id IN (
      SELECT cost_id FROM supplier_payments WHERE supplier_invoice_id = NEW.id AND cost_id IS NOT NULL
    );

    RAISE NOTICE '[Invoice→Payment→Cost] Synced invoice % changes to payments and costs', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_supplier_invoice_update_trigger ON public.supplier_invoices;
CREATE TRIGGER sync_supplier_invoice_update_trigger
  AFTER UPDATE ON public.supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_supplier_invoice_update();
