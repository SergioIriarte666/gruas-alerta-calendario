
-- ============================================================
-- Fix 1: Break circular trigger deletion cycle
-- ============================================================

-- 1a. Rewrite sync_cost_deletion_cascade to avoid circular updates
CREATE OR REPLACE FUNCTION sync_cost_deletion_cascade()
RETURNS TRIGGER AS $$
DECLARE
  v_sp_id UUID;
BEGIN
  -- Save the supplier_payment_id before we do anything
  v_sp_id := OLD.supplier_payment_id;
  
  -- Nullify the link on the cost row FIRST to break the cycle
  -- (the row is being deleted, but we prevent the payment's delete trigger
  --  from trying to UPDATE this same row)
  IF v_sp_id IS NOT NULL THEN
    -- Temporarily nullify so the supplier_payment delete trigger won't conflict
    UPDATE costs SET supplier_payment_id = NULL WHERE id = OLD.id;
    -- Now safely delete the payment
    DELETE FROM supplier_payments WHERE id = v_sp_id;
  END IF;
  
  -- Also clean up any payments linked via cost_id
  DELETE FROM supplier_payments WHERE cost_id = OLD.id AND id != COALESCE(v_sp_id, '00000000-0000-0000-0000-000000000000');
  
  -- Cancel related inventory movements
  UPDATE inventory_movements 
  SET status = 'cancelled', observations = COALESCE(observations, '') || ' [Costo eliminado]'
  WHERE cost_id = OLD.id AND status = 'active';
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger (drop first to avoid duplicates)
DROP TRIGGER IF EXISTS sync_cost_deletion_cascade_trigger ON costs;
CREATE TRIGGER sync_cost_deletion_cascade_trigger
  BEFORE DELETE ON costs
  FOR EACH ROW
  EXECUTE FUNCTION sync_cost_deletion_cascade();

-- 1b. Rewrite on_supplier_payment_delete to guard against circular deletion
CREATE OR REPLACE FUNCTION on_supplier_payment_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only nullify the link on costs that still reference this payment
  -- The guard: if cost is already being deleted (supplier_payment_id was nullified), skip
  UPDATE costs 
  SET supplier_payment_id = NULL 
  WHERE supplier_payment_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Change to AFTER DELETE to avoid conflicts with BEFORE DELETE on costs
DROP TRIGGER IF EXISTS on_supplier_payment_delete_trigger ON supplier_payments;
DROP TRIGGER IF EXISTS supplier_payment_delete_trigger ON supplier_payments;
CREATE TRIGGER on_supplier_payment_delete_trigger
  AFTER DELETE ON supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION on_supplier_payment_delete();

-- 1c. Fix create_supplier_payment_from_cost: remove DELETE handling (handled by sync_cost_deletion_cascade)
-- and fix RETURN NEW issue on DELETE
CREATE OR REPLACE FUNCTION create_supplier_payment_from_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_id UUID;
  v_status TEXT;
  v_paid_amount NUMERIC;
  v_paid_date DATE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.supplier_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    IF NEW.supplier_payment_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
    IF EXISTS (SELECT 1 FROM supplier_payments WHERE cost_id = NEW.id) THEN
      RETURN NEW;
    END IF;
    
    IF (NEW.payment_date IS NOT NULL AND NEW.payment_date <= CURRENT_DATE) THEN
      v_status := 'paid';
      v_paid_amount := NEW.amount;
      v_paid_date := NEW.payment_date;
    ELSE
      v_status := 'pending';
      v_paid_amount := 0;
      v_paid_date := NULL;
    END IF;
    
    INSERT INTO supplier_payments (
      supplier_id, amount, paid_amount, description, 
      due_date, status, paid_date, cost_id, created_by,
      category
    ) VALUES (
      NEW.supplier_id,
      NEW.amount,
      v_paid_amount,
      COALESCE(NEW.description, 'Gasto registrado'),
      COALESCE(NEW.date, CURRENT_DATE),
      v_status,
      v_paid_date,
      NEW.id,
      NEW.created_by,
      COALESCE(NEW.subcategory, NEW.category_id::text, 'otros')
    ) RETURNING id INTO v_payment_id;
    
    UPDATE costs SET supplier_payment_id = v_payment_id WHERE id = NEW.id;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    IF NEW.supplier_payment_id IS NOT NULL OR OLD.supplier_payment_id IS NOT NULL THEN
      DECLARE
        v_sp_id UUID := COALESCE(NEW.supplier_payment_id, OLD.supplier_payment_id);
      BEGIN
        IF (NEW.payment_date IS NOT NULL AND NEW.payment_date <= CURRENT_DATE) THEN
          v_status := 'paid';
          v_paid_amount := NEW.amount;
          v_paid_date := NEW.payment_date;
        ELSE
          SELECT status, paid_amount, paid_date INTO v_status, v_paid_amount, v_paid_date
          FROM supplier_payments WHERE id = v_sp_id;
        END IF;
        
        UPDATE supplier_payments SET
          amount = NEW.amount,
          paid_amount = CASE WHEN v_status = 'paid' THEN NEW.amount ELSE paid_amount END,
          description = COALESCE(NEW.description, description),
          due_date = COALESCE(NEW.date, due_date),
          paid_date = CASE WHEN v_status = 'paid' THEN v_paid_date ELSE paid_date END,
          status = v_status,
          supplier_id = COALESCE(NEW.supplier_id, supplier_id),
          category = COALESCE(NEW.subcategory, NEW.category_id::text, category)
        WHERE id = v_sp_id;
      END;
    END IF;
  END IF;
  
  -- DELETE is handled by sync_cost_deletion_cascade, not here
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger ONLY for INSERT and UPDATE (not DELETE)
DROP TRIGGER IF EXISTS create_supplier_payment_from_cost_trigger ON costs;
CREATE TRIGGER create_supplier_payment_from_cost_trigger
  AFTER INSERT OR UPDATE ON costs
  FOR EACH ROW
  EXECUTE FUNCTION create_supplier_payment_from_cost();
