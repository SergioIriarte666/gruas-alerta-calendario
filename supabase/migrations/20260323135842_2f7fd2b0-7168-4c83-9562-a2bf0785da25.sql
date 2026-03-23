
-- =====================================================
-- Fix 1: Drop duplicate INSERT trigger on costs
-- Keep: create_supplier_payment_from_cost (handles INSERT+UPDATE+DELETE)
-- Drop: create_supplier_payment_from_cost_trigger (duplicate INSERT only)
-- =====================================================
DROP TRIGGER IF EXISTS create_supplier_payment_from_cost_trigger ON public.costs;

-- =====================================================
-- Fix 2: Drop duplicate INSERT trigger on crane_parts
-- Keep: sync_parts_purchase_to_inventory_trigger
-- Drop: sync_parts_to_inventory_trigger (duplicate)
-- =====================================================
DROP TRIGGER IF EXISTS sync_parts_to_inventory_trigger ON public.crane_parts;

-- =====================================================
-- Fix 3: Drop redundant DELETE trigger on costs
-- Keep: sync_cost_deletion_cascade_trigger (comprehensive)
-- Drop: trigger_sync_cost_deletion (simpler/obsolete)
-- =====================================================
DROP TRIGGER IF EXISTS trigger_sync_cost_deletion ON public.costs;

-- =====================================================
-- Fix 4: Sync supplier_payments UPDATE → costs
-- =====================================================
CREATE OR REPLACE FUNCTION public.sync_supplier_payment_update_to_cost()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP != 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF (OLD.amount IS DISTINCT FROM NEW.amount) OR
     (OLD.due_date IS DISTINCT FROM NEW.due_date) OR
     (OLD.description IS DISTINCT FROM NEW.description) THEN

    UPDATE costs SET
      amount = CASE WHEN OLD.amount IS DISTINCT FROM NEW.amount THEN NEW.amount ELSE amount END,
      date = CASE WHEN OLD.due_date IS DISTINCT FROM NEW.due_date THEN NEW.due_date ELSE date END,
      description = CASE WHEN OLD.description IS DISTINCT FROM NEW.description THEN COALESCE(NEW.description, description) ELSE description END,
      updated_at = now()
    WHERE supplier_payment_id = NEW.id;

    IF NEW.cost_id IS NOT NULL THEN
      UPDATE costs SET
        amount = CASE WHEN OLD.amount IS DISTINCT FROM NEW.amount THEN NEW.amount ELSE amount END,
        date = CASE WHEN OLD.due_date IS DISTINCT FROM NEW.due_date THEN NEW.due_date ELSE date END,
        description = CASE WHEN OLD.description IS DISTINCT FROM NEW.description THEN COALESCE(NEW.description, description) ELSE description END,
        updated_at = now()
      WHERE id = NEW.cost_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_supplier_payment_update_to_cost_trigger ON public.supplier_payments;
CREATE TRIGGER sync_supplier_payment_update_to_cost_trigger
  AFTER UPDATE ON public.supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_supplier_payment_update_to_cost();

-- =====================================================
-- Fix 5: Cleanup on supplier_invoices DELETE
-- =====================================================
CREATE OR REPLACE FUNCTION public.sync_supplier_invoice_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE supplier_payments SET
    supplier_invoice_id = NULL,
    updated_at = now()
  WHERE supplier_invoice_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_supplier_invoice_delete_trigger ON public.supplier_invoices;
CREATE TRIGGER sync_supplier_invoice_delete_trigger
  BEFORE DELETE ON public.supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_supplier_invoice_delete();
