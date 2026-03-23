-- 1. Update protection trigger to allow sync operations via session flag
CREATE OR REPLACE FUNCTION prevent_non_admin_updates_on_paid_costs()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow sync operations from other triggers
  IF current_setting('app.sync_in_progress', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF OLD.payment_date IS NOT NULL AND NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Este costo está marcado como pagado y no puede ser modificado sin autorización especial';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Update sync function to set the flag and include paid_date
CREATE OR REPLACE FUNCTION sync_supplier_payment_update_to_cost()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP != 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF (OLD.amount IS DISTINCT FROM NEW.amount) OR
     (OLD.due_date IS DISTINCT FROM NEW.due_date) OR
     (OLD.description IS DISTINCT FROM NEW.description) OR
     (OLD.paid_date IS DISTINCT FROM NEW.paid_date) THEN

    -- Set flag to bypass paid cost protection
    PERFORM set_config('app.sync_in_progress', 'true', true);

    UPDATE costs SET
      amount = CASE WHEN OLD.amount IS DISTINCT FROM NEW.amount THEN NEW.amount ELSE amount END,
      date = CASE WHEN OLD.due_date IS DISTINCT FROM NEW.due_date THEN NEW.due_date ELSE date END,
      description = CASE WHEN OLD.description IS DISTINCT FROM NEW.description THEN COALESCE(NEW.description, description) ELSE description END,
      payment_date = CASE WHEN OLD.paid_date IS DISTINCT FROM NEW.paid_date THEN NEW.paid_date ELSE payment_date END,
      updated_at = now()
    WHERE supplier_payment_id = NEW.id;

    IF NEW.cost_id IS NOT NULL THEN
      UPDATE costs SET
        amount = CASE WHEN OLD.amount IS DISTINCT FROM NEW.amount THEN NEW.amount ELSE amount END,
        date = CASE WHEN OLD.due_date IS DISTINCT FROM NEW.due_date THEN NEW.due_date ELSE date END,
        description = CASE WHEN OLD.description IS DISTINCT FROM NEW.description THEN COALESCE(NEW.description, description) ELSE description END,
        payment_date = CASE WHEN OLD.paid_date IS DISTINCT FROM NEW.paid_date THEN NEW.paid_date ELSE payment_date END,
        updated_at = now()
      WHERE id = NEW.cost_id;
    END IF;

    -- Reset flag
    PERFORM set_config('app.sync_in_progress', 'false', true);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;