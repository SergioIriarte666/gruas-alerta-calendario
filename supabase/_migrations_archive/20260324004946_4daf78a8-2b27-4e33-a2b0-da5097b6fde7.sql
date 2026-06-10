CREATE OR REPLACE FUNCTION public.create_cost_from_supplier_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_cost_id UUID;
  v_maintenance_cat_id UUID;
  v_resolved_cat_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.cost_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    IF EXISTS (SELECT 1 FROM public.costs WHERE supplier_payment_id = NEW.id) THEN
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

    v_resolved_cat_id := NULL;

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
    END IF;

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
      NEW.paid_date,
      NEW.created_by,
      NEW.notes
    ) RETURNING id INTO v_cost_id;

    UPDATE public.supplier_payments
    SET cost_id = v_cost_id
    WHERE id = NEW.id;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_cost_id := COALESCE(NEW.cost_id, OLD.cost_id);

    IF v_cost_id IS NULL THEN
      SELECT id INTO v_cost_id
      FROM public.costs
      WHERE supplier_payment_id = NEW.id
      LIMIT 1;
    END IF;

    IF v_cost_id IS NOT NULL THEN
      v_resolved_cat_id := NULL;

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
      END IF;

      UPDATE public.costs
      SET amount = NEW.amount,
          category_id = COALESCE(v_resolved_cat_id, category_id),
          subcategory = NULLIF(NEW.subcategory, ''),
          date = COALESCE(NEW.due_date, date),
          description = COALESCE(NEW.description, description),
          supplier_id = COALESCE(NEW.supplier_id, supplier_id),
          payment_date = CASE
            WHEN NEW.status = 'paid' THEN COALESCE(NEW.paid_date, CURRENT_DATE)
            WHEN NEW.status IS DISTINCT FROM 'paid' THEN NULL
            ELSE payment_date
          END,
          notes = COALESCE(NEW.notes, notes),
          updated_at = now()
      WHERE id = v_cost_id;

      IF NEW.cost_id IS NULL THEN
        UPDATE public.supplier_payments
        SET cost_id = v_cost_id
        WHERE id = NEW.id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_supplier_payment_from_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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

    IF EXISTS (SELECT 1 FROM public.supplier_payments WHERE cost_id = NEW.id) THEN
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
    WHERE id = NEW.id;
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
          SELECT status, paid_amount, paid_date
          INTO v_status, v_paid_amount, v_paid_date
          FROM public.supplier_payments
          WHERE id = v_sp_id;
        END IF;

        UPDATE public.supplier_payments
        SET amount = NEW.amount,
            paid_amount = CASE WHEN v_status = 'paid' THEN NEW.amount ELSE paid_amount END,
            description = COALESCE(NEW.description, description),
            due_date = COALESCE(NEW.date, due_date),
            paid_date = CASE WHEN v_status = 'paid' THEN v_paid_date ELSE paid_date END,
            status = v_status,
            supplier_id = COALESCE(NEW.supplier_id, supplier_id),
            category = COALESCE(NEW.category_id::text, category),
            subcategory = COALESCE(NULLIF(NEW.subcategory, ''), subcategory),
            notes = COALESCE(NEW.notes, notes)
        WHERE id = v_sp_id;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;