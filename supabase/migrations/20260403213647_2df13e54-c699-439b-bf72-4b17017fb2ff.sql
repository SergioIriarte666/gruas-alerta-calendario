DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sync_cost_to_supplier_payment_trigger'
      AND tgrelid = 'public.costs'::regclass
      AND NOT tgisinternal
  ) THEN
    EXECUTE 'DROP TRIGGER sync_cost_to_supplier_payment_trigger ON public.costs';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'create_supplier_payment_from_cost_trigger'
      AND tgrelid = 'public.costs'::regclass
      AND NOT tgisinternal
  ) THEN
    EXECUTE 'DROP TRIGGER create_supplier_payment_from_cost_trigger ON public.costs';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sync_cost_update_to_payment_trigger'
      AND tgrelid = 'public.costs'::regclass
      AND NOT tgisinternal
  ) THEN
    EXECUTE 'DROP TRIGGER sync_cost_update_to_payment_trigger ON public.costs';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sync_supplier_payment_update_to_cost_trigger'
      AND tgrelid = 'public.supplier_payments'::regclass
      AND NOT tgisinternal
  ) THEN
    EXECUTE 'DROP TRIGGER sync_supplier_payment_update_to_cost_trigger ON public.supplier_payments';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sync_cost_supplier_payment_deletion_trigger'
      AND tgrelid = 'public.supplier_payments'::regclass
      AND NOT tgisinternal
  ) THEN
    EXECUTE 'DROP TRIGGER sync_cost_supplier_payment_deletion_trigger ON public.supplier_payments';
  END IF;
END $$;

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
  IF current_setting('app.bidirectional_sync', true) = 'true'
     OR current_setting('app.sync_in_progress', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.supplier_id IS NULL THEN
    RETURN NEW;
  END IF;

  effective_due_date := COALESCE(NEW.payment_date, NEW.date, CURRENT_DATE);
  effective_status := CASE WHEN NEW.payment_date IS NOT NULL THEN 'paid' ELSE 'pending' END;
  effective_paid_amount := CASE WHEN NEW.payment_date IS NOT NULL THEN COALESCE(NEW.amount, 0) ELSE 0 END;
  effective_category := COALESCE(NULLIF(BTRIM(NEW.subcategory), ''), NULLIF(BTRIM(NEW.other_reason), ''), 'Costos');
  effective_notes := NEW.notes;

  PERFORM set_config('app.bidirectional_sync', 'true', true);
  PERFORM set_config('app.sync_in_progress', 'true', true);

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

  SELECT sp.id
  INTO existing_payment_id
  FROM public.supplier_payments sp
  WHERE sp.cost_id = NEW.id
  ORDER BY sp.created_at ASC NULLS LAST, sp.id ASC
  LIMIT 1;

  IF existing_payment_id IS NULL THEN
    INSERT INTO public.supplier_payments (
      supplier_id,
      amount,
      paid_amount,
      description,
      category,
      due_date,
      status,
      paid_date,
      notes,
      cost_id
    )
    VALUES (
      NEW.supplier_id,
      NEW.amount,
      effective_paid_amount,
      COALESCE(NULLIF(BTRIM(NEW.description), ''), 'Gasto registrado'),
      effective_category,
      effective_due_date,
      effective_status,
      NEW.payment_date,
      effective_notes,
      NEW.id
    )
    RETURNING id INTO existing_payment_id;
  ELSE
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

  UPDATE public.costs
  SET supplier_payment_id = existing_payment_id,
      updated_at = now()
  WHERE id = NEW.id
    AND supplier_payment_id IS DISTINCT FROM existing_payment_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('app.bidirectional_sync', 'false', true);
    PERFORM set_config('app.sync_in_progress', 'false', true);
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_supplier_payment_update_to_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.bidirectional_sync', true) = 'true'
     OR current_setting('app.sync_in_progress', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.cost_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.bidirectional_sync', 'true', true);
  PERFORM set_config('app.sync_in_progress', 'true', true);

  UPDATE public.costs
  SET supplier_id = NEW.supplier_id,
      supplier_payment_id = NEW.id,
      amount = NEW.amount,
      description = COALESCE(NULLIF(BTRIM(NEW.description), ''), description),
      payment_date = NEW.paid_date,
      updated_at = now()
  WHERE id = NEW.cost_id
    AND (
      supplier_id IS DISTINCT FROM NEW.supplier_id
      OR supplier_payment_id IS DISTINCT FROM NEW.id
      OR amount IS DISTINCT FROM NEW.amount
      OR description IS DISTINCT FROM COALESCE(NULLIF(BTRIM(NEW.description), ''), description)
      OR payment_date IS DISTINCT FROM NEW.paid_date
    );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('app.bidirectional_sync', 'false', true);
    PERFORM set_config('app.sync_in_progress', 'false', true);
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_cost_supplier_payment_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.bidirectional_sync', true) = 'true'
     OR current_setting('app.sync_in_progress', true) = 'true' THEN
    RETURN OLD;
  END IF;

  IF OLD.cost_id IS NULL THEN
    RETURN OLD;
  END IF;

  PERFORM set_config('app.bidirectional_sync', 'true', true);
  PERFORM set_config('app.sync_in_progress', 'true', true);

  UPDATE public.costs
  SET supplier_payment_id = NULL,
      payment_date = NULL,
      updated_at = now()
  WHERE id = OLD.cost_id
    AND supplier_payment_id = OLD.id;

  RETURN OLD;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('app.bidirectional_sync', 'false', true);
    PERFORM set_config('app.sync_in_progress', 'false', true);
    RAISE;
END;
$$;

CREATE TRIGGER create_supplier_payment_from_cost_trigger
AFTER INSERT OR UPDATE ON public.costs
FOR EACH ROW
WHEN (NEW.supplier_id IS NOT NULL)
EXECUTE FUNCTION public.create_supplier_payment_from_cost();

CREATE TRIGGER sync_supplier_payment_update_to_cost_trigger
AFTER UPDATE ON public.supplier_payments
FOR EACH ROW
WHEN (NEW.cost_id IS NOT NULL)
EXECUTE FUNCTION public.sync_supplier_payment_update_to_cost();

CREATE TRIGGER sync_cost_supplier_payment_deletion_trigger
BEFORE DELETE ON public.supplier_payments
FOR EACH ROW
WHEN (OLD.cost_id IS NOT NULL)
EXECUTE FUNCTION public.sync_cost_supplier_payment_deletion();

CREATE OR REPLACE FUNCTION public.backfill_supplier_payments_from_costs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fixed_count integer := 0;
BEGIN
  PERFORM set_config('app.bidirectional_sync', 'true', true);
  PERFORM set_config('app.sync_in_progress', 'true', true);

  WITH candidate_costs AS (
    SELECT c.id,
           c.supplier_id,
           c.amount,
           c.description,
           c.date,
           c.payment_date,
           c.notes,
           c.subcategory,
           c.other_reason
    FROM public.costs c
    WHERE c.supplier_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.supplier_payments sp
        WHERE sp.cost_id = c.id
      )
  ),
  inserted_payments AS (
    INSERT INTO public.supplier_payments (
      supplier_id,
      amount,
      paid_amount,
      description,
      category,
      due_date,
      status,
      paid_date,
      notes,
      cost_id
    )
    SELECT cc.supplier_id,
           cc.amount,
           CASE WHEN cc.payment_date IS NOT NULL THEN cc.amount ELSE 0 END,
           COALESCE(NULLIF(BTRIM(cc.description), ''), 'Gasto registrado'),
           COALESCE(NULLIF(BTRIM(cc.subcategory), ''), NULLIF(BTRIM(cc.other_reason), ''), 'Costos'),
           COALESCE(cc.payment_date, cc.date, CURRENT_DATE),
           CASE WHEN cc.payment_date IS NOT NULL THEN 'paid' ELSE 'pending' END,
           cc.payment_date,
           cc.notes,
           cc.id
    FROM candidate_costs cc
    RETURNING id, cost_id
  )
  UPDATE public.costs c
  SET supplier_payment_id = ip.id,
      updated_at = now()
  FROM inserted_payments ip
  WHERE c.id = ip.cost_id
    AND c.supplier_payment_id IS DISTINCT FROM ip.id;

  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  RETURN fixed_count;
END;
$$;

DO $$
DECLARE
  repaired_count integer;
  costs_trigger_count integer;
  payments_trigger_count integer;
BEGIN
  SELECT public.backfill_supplier_payments_from_costs() INTO repaired_count;

  SELECT COUNT(*) INTO costs_trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'public.costs'::regclass
    AND tgname = 'create_supplier_payment_from_cost_trigger'
    AND NOT tgisinternal;

  SELECT COUNT(*) INTO payments_trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'public.supplier_payments'::regclass
    AND tgname IN (
      'sync_supplier_payment_update_to_cost_trigger',
      'sync_cost_supplier_payment_deletion_trigger'
    )
    AND NOT tgisinternal;

  IF costs_trigger_count <> 1 THEN
    RAISE EXCEPTION 'No se pudo crear correctamente el trigger de costos hacia pagos';
  END IF;

  IF payments_trigger_count <> 2 THEN
    RAISE EXCEPTION 'No se pudieron crear correctamente los triggers de pagos hacia costos';
  END IF;

  RAISE NOTICE 'Backfill completado. Costos reparados: %', repaired_count;
END;
$$;