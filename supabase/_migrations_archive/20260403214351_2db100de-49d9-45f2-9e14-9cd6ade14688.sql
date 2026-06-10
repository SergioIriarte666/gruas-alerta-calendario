
CREATE OR REPLACE FUNCTION public.create_supplier_payment_from_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_payment_id uuid;
  effective_due_date date;
  effective_status text;
  effective_paid_amount numeric;
  effective_category text;
  effective_notes text;
BEGIN
  -- Skip if sync flag is set (prevents recursive loops)
  IF current_setting('app.bidirectional_sync', true) = 'true'
     OR current_setting('app.sync_in_progress', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Skip if no supplier
  IF NEW.supplier_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate effective values
  effective_due_date := COALESCE(NEW.payment_date, NEW.date, CURRENT_DATE);
  effective_status := CASE WHEN NEW.payment_date IS NOT NULL THEN 'paid' ELSE 'pending' END;
  effective_paid_amount := CASE WHEN NEW.payment_date IS NOT NULL THEN COALESCE(NEW.amount, 0) ELSE 0 END;
  effective_category := COALESCE(NULLIF(BTRIM(NEW.subcategory), ''), NULLIF(BTRIM(NEW.other_reason), ''), 'Costos');
  effective_notes := NEW.notes;

  -- Set sync flags to prevent recursion
  PERFORM set_config('app.bidirectional_sync', 'true', true);
  PERFORM set_config('app.sync_in_progress', 'true', true);

  -- If cost already has a supplier_payment_id, just update that payment
  IF NEW.supplier_payment_id IS NOT NULL THEN
    UPDATE public.supplier_payments
    SET supplier_id = NEW.supplier_id,
        amount = NEW.amount,
        paid_amount = effective_paid_amount,
        description = COALESCE(NULLIF(BTRIM(NEW.description), ''), 'Gasto registrado'),
        category = effective_category,
        due_date = effective_due_date,
        paid_date = NEW.payment_date,
        status = effective_status,
        notes = effective_notes,
        cost_id = NEW.id,
        updated_at = now()
    WHERE id = NEW.supplier_payment_id;

    RETURN NEW;
  END IF;

  -- Check if a supplier_payment already exists for this cost_id
  SELECT sp.id
  INTO existing_payment_id
  FROM public.supplier_payments sp
  WHERE sp.cost_id = NEW.id
  ORDER BY sp.created_at ASC NULLS LAST, sp.id ASC
  LIMIT 1;

  IF existing_payment_id IS NULL THEN
    -- No existing payment: try to insert, but handle duplicate gracefully
    BEGIN
      INSERT INTO public.supplier_payments (
        supplier_id, amount, paid_amount, description, category,
        due_date, status, paid_date, notes, cost_id
      )
      VALUES (
        NEW.supplier_id, NEW.amount, effective_paid_amount,
        COALESCE(NULLIF(BTRIM(NEW.description), ''), 'Gasto registrado'),
        effective_category, effective_due_date, effective_status,
        NEW.payment_date, effective_notes, NEW.id
      )
      RETURNING id INTO existing_payment_id;
    EXCEPTION
      WHEN unique_violation THEN
        -- Another process already created it (race condition) - just find and update it
        SELECT sp.id INTO existing_payment_id
        FROM public.supplier_payments sp
        WHERE sp.cost_id = NEW.id
        LIMIT 1;
        
        IF existing_payment_id IS NOT NULL THEN
          UPDATE public.supplier_payments
          SET supplier_id = NEW.supplier_id,
              amount = NEW.amount,
              paid_amount = effective_paid_amount,
              description = COALESCE(NULLIF(BTRIM(NEW.description), ''), 'Gasto registrado'),
              category = effective_category,
              due_date = effective_due_date,
              paid_date = NEW.payment_date,
              status = effective_status,
              notes = COALESCE(NEW.notes, notes),
              updated_at = now()
          WHERE id = existing_payment_id;
        END IF;
    END;
  ELSE
    -- Existing payment found: update it
    UPDATE public.supplier_payments
    SET supplier_id = NEW.supplier_id,
        amount = NEW.amount,
        paid_amount = effective_paid_amount,
        description = COALESCE(NULLIF(BTRIM(NEW.description), ''), 'Gasto registrado'),
        category = COALESCE(NULLIF(BTRIM(category), ''), effective_category),
        due_date = effective_due_date,
        paid_date = NEW.payment_date,
        status = effective_status,
        notes = COALESCE(NEW.notes, notes),
        cost_id = NEW.id,
        updated_at = now()
    WHERE id = existing_payment_id;
  END IF;

  -- Link cost to the payment if not already linked
  IF existing_payment_id IS NOT NULL THEN
    UPDATE public.costs
    SET supplier_payment_id = existing_payment_id,
        updated_at = now()
    WHERE id = NEW.id
      AND supplier_payment_id IS DISTINCT FROM existing_payment_id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('app.bidirectional_sync', 'false', true);
    PERFORM set_config('app.sync_in_progress', 'false', true);
    RAISE;
END;
$$;
