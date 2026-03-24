-- Fix recursive XML import failures caused by bidirectional trigger loops
-- Root cause observed in postgres logs: `stack depth limit exceeded`

-- Remove redundant update-sync triggers. The main create_* trigger functions already handle UPDATE.
DROP TRIGGER IF EXISTS sync_cost_update_to_payment_trigger ON public.costs;
DROP TRIGGER IF EXISTS sync_supplier_payment_update_to_cost_trigger ON public.supplier_payments;

-- Allow internal trigger-driven sync updates on paid costs
CREATE OR REPLACE FUNCTION public.prevent_non_admin_updates_on_paid_costs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.sync_in_progress', true) = 'true'
     OR current_setting('app.bidirectional_sync', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF OLD.payment_date IS NOT NULL AND NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Este costo está marcado como pagado y no puede ser modificado sin autorización especial';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_supplier_payment_from_cost()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_payment_id uuid;
  v_sp_id uuid;
  v_status text;
  v_paid_amount numeric;
  v_paid_date date;
  v_should_sync boolean := false;
BEGIN
  IF current_setting('app.bidirectional_sync', true) = 'true'
     OR current_setting('app.cascade_delete', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.supplier_id IS NULL
       OR NEW.supplier_payment_id IS NOT NULL
       OR EXISTS (SELECT 1 FROM public.supplier_payments WHERE cost_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    IF NEW.payment_date IS NOT NULL AND NEW.payment_date <= CURRENT_DATE THEN
      v_status := 'paid';
      v_paid_amount := NEW.amount;
      v_paid_date := NEW.payment_date;
    ELSE
      v_status := 'pending';
      v_paid_amount := 0;
      v_paid_date := NULL;
    END IF;

    PERFORM set_config('app.bidirectional_sync', 'true', true);

    INSERT INTO public.supplier_payments (
      supplier_id,
      amount,
      paid_amount,
      description,
      due_date,
      status,
      paid_date,
      cost_id,
      created_by,
      category,
      subcategory,
      notes
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
      COALESCE(NEW.category_id::text, 'otros'),
      NULLIF(NEW.subcategory, ''),
      NEW.notes
    ) RETURNING id INTO v_payment_id;

    UPDATE public.costs
    SET supplier_payment_id = v_payment_id
    WHERE id = NEW.id
      AND supplier_payment_id IS DISTINCT FROM v_payment_id;

    PERFORM set_config('app.bidirectional_sync', 'false', true);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_sp_id := COALESCE(NEW.supplier_payment_id, OLD.supplier_payment_id);

    IF v_sp_id IS NULL THEN
      RETURN NEW;
    END IF;

    v_should_sync :=
      (OLD.amount IS DISTINCT FROM NEW.amount) OR
      (OLD.supplier_id IS DISTINCT FROM NEW.supplier_id) OR
      (OLD.description IS DISTINCT FROM NEW.description) OR
      (OLD.payment_date IS DISTINCT FROM NEW.payment_date) OR
      (OLD.date IS DISTINCT FROM NEW.date) OR
      (OLD.category_id IS DISTINCT FROM NEW.category_id) OR
      (OLD.subcategory IS DISTINCT FROM NEW.subcategory) OR
      (OLD.notes IS DISTINCT FROM NEW.notes);

    IF NOT v_should_sync THEN
      RETURN NEW;
    END IF;

    IF NEW.payment_date IS NOT NULL AND NEW.payment_date <= CURRENT_DATE THEN
      v_status := 'paid';
      v_paid_amount := NEW.amount;
      v_paid_date := NEW.payment_date;
    ELSE
      v_status := 'pending';
      v_paid_amount := 0;
      v_paid_date := NULL;
    END IF;

    PERFORM set_config('app.bidirectional_sync', 'true', true);

    UPDATE public.supplier_payments
    SET amount = NEW.amount,
        paid_amount = v_paid_amount,
        description = COALESCE(NEW.description, description),
        due_date = COALESCE(NEW.date, due_date),
        paid_date = v_paid_date,
        status = v_status,
        supplier_id = COALESCE(NEW.supplier_id, supplier_id),
        category = COALESCE(NEW.category_id::text, category),
        subcategory = CASE
          WHEN NEW.subcategory IS DISTINCT FROM OLD.subcategory THEN NULLIF(NEW.subcategory, '')
          ELSE subcategory
        END,
        notes = COALESCE(NEW.notes, notes)
    WHERE id = v_sp_id;

    PERFORM set_config('app.bidirectional_sync', 'false', true);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_cost_from_supplier_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cost_id uuid;
  v_maintenance_cat_id uuid;
  v_resolved_cat_id uuid;
  v_should_sync boolean := false;
BEGIN
  IF current_setting('app.bidirectional_sync', true) = 'true'
     OR current_setting('app.cascade_delete', true) = 'true' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_maintenance_cat_id
  FROM public.cost_categories
  WHERE name = 'Mantenimiento'
  LIMIT 1;

  IF v_maintenance_cat_id IS NULL THEN
    SELECT id INTO v_maintenance_cat_id
    FROM public.cost_categories
    LIMIT 1;
  END IF;

  IF NEW.category IS NOT NULL AND NEW.category <> '' THEN
    BEGIN
      v_resolved_cat_id := NEW.category::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM public.cost_categories WHERE id = v_resolved_cat_id
      ) THEN
        v_resolved_cat_id := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_resolved_cat_id := NULL;
    END;

    IF v_resolved_cat_id IS NULL THEN
      SELECT id INTO v_resolved_cat_id
      FROM public.cost_categories
      WHERE lower(name) = lower(NEW.category)
      LIMIT 1;
    END IF;
  ELSE
    v_resolved_cat_id := NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.cost_id IS NOT NULL
       OR EXISTS (SELECT 1 FROM public.costs WHERE supplier_payment_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    PERFORM set_config('app.bidirectional_sync', 'true', true);

    INSERT INTO public.costs (
      amount,
      category_id,
      subcategory,
      date,
      description,
      supplier_id,
      supplier_payment_id,
      payment_date,
      created_by,
      notes
    ) VALUES (
      NEW.amount,
      COALESCE(v_resolved_cat_id, v_maintenance_cat_id),
      NULLIF(NEW.subcategory, ''),
      COALESCE(NEW.due_date, CURRENT_DATE),
      COALESCE(NEW.description, 'Pago a proveedor'),
      NEW.supplier_id,
      NEW.id,
      CASE WHEN NEW.status = 'paid' THEN COALESCE(NEW.paid_date, CURRENT_DATE) ELSE NULL END,
      NEW.created_by,
      NEW.notes
    ) RETURNING id INTO v_cost_id;

    UPDATE public.supplier_payments
    SET cost_id = v_cost_id
    WHERE id = NEW.id
      AND cost_id IS DISTINCT FROM v_cost_id;

    PERFORM set_config('app.bidirectional_sync', 'false', true);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_cost_id := COALESCE(NEW.cost_id, OLD.cost_id);

    IF v_cost_id IS NULL THEN
      SELECT id INTO v_cost_id
      FROM public.costs
      WHERE supplier_payment_id = NEW.id
      LIMIT 1;
    END IF;

    IF v_cost_id IS NULL THEN
      RETURN NEW;
    END IF;

    IF NEW.cost_id IS NULL THEN
      PERFORM set_config('app.bidirectional_sync', 'true', true);
      UPDATE public.supplier_payments
      SET cost_id = v_cost_id
      WHERE id = NEW.id
        AND cost_id IS DISTINCT FROM v_cost_id;
      PERFORM set_config('app.bidirectional_sync', 'false', true);
    END IF;

    v_should_sync :=
      (OLD.amount IS DISTINCT FROM NEW.amount) OR
      (OLD.due_date IS DISTINCT FROM NEW.due_date) OR
      (OLD.description IS DISTINCT FROM NEW.description) OR
      (OLD.paid_date IS DISTINCT FROM NEW.paid_date) OR
      (OLD.status IS DISTINCT FROM NEW.status) OR
      (OLD.supplier_id IS DISTINCT FROM NEW.supplier_id) OR
      (OLD.category IS DISTINCT FROM NEW.category) OR
      (OLD.subcategory IS DISTINCT FROM NEW.subcategory) OR
      (OLD.notes IS DISTINCT FROM NEW.notes);

    IF NOT v_should_sync THEN
      RETURN NEW;
    END IF;

    PERFORM set_config('app.bidirectional_sync', 'true', true);

    UPDATE public.costs
    SET amount = NEW.amount,
        category_id = COALESCE(v_resolved_cat_id, category_id),
        subcategory = CASE
          WHEN NEW.subcategory IS DISTINCT FROM OLD.subcategory THEN NULLIF(NEW.subcategory, '')
          ELSE subcategory
        END,
        date = COALESCE(NEW.due_date, date),
        description = COALESCE(NEW.description, description),
        supplier_id = COALESCE(NEW.supplier_id, supplier_id),
        payment_date = CASE
          WHEN NEW.status = 'paid' THEN COALESCE(NEW.paid_date, CURRENT_DATE)
          ELSE NULL
        END,
        notes = COALESCE(NEW.notes, notes),
        updated_at = now()
    WHERE id = v_cost_id;

    PERFORM set_config('app.bidirectional_sync', 'false', true);
  END IF;

  RETURN NEW;
END;
$$;