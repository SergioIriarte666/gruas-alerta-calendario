DO $$
DECLARE
  r RECORD;
  v_payment_id UUID;
  v_status TEXT;
  v_paid_amount NUMERIC;
  v_paid_date DATE;
  v_count INT := 0;
BEGIN
  ALTER TABLE costs DISABLE TRIGGER prevent_non_admin_updates_on_paid_costs_trigger;
  ALTER TABLE costs DISABLE TRIGGER sync_cost_update_to_payment_trigger;
  ALTER TABLE costs DISABLE TRIGGER create_supplier_payment_from_cost;
  ALTER TABLE costs DISABLE TRIGGER create_supplier_payment_from_cost_trigger;

  FOR r IN
    SELECT c.*
    FROM costs c
    WHERE c.supplier_id IS NOT NULL
      AND c.supplier_payment_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM supplier_payments sp WHERE sp.cost_id = c.id
      )
  LOOP
    IF r.payment_date IS NOT NULL AND r.payment_date <= CURRENT_DATE THEN
      v_status := 'paid';
      v_paid_amount := r.amount;
      v_paid_date := r.payment_date;
    ELSE
      v_status := 'pending';
      v_paid_amount := 0;
      v_paid_date := NULL;
    END IF;

    INSERT INTO supplier_payments (
      supplier_id, amount, paid_amount, description,
      due_date, status, paid_date, cost_id, created_by, category
    ) VALUES (
      r.supplier_id, r.amount, v_paid_amount,
      COALESCE(r.description, 'Gasto registrado'),
      COALESCE(r.date, CURRENT_DATE),
      v_status, v_paid_date, r.id, r.created_by, r.subcategory
    ) RETURNING id INTO v_payment_id;

    UPDATE costs SET supplier_payment_id = v_payment_id WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  ALTER TABLE costs ENABLE TRIGGER prevent_non_admin_updates_on_paid_costs_trigger;
  ALTER TABLE costs ENABLE TRIGGER sync_cost_update_to_payment_trigger;
  ALTER TABLE costs ENABLE TRIGGER create_supplier_payment_from_cost;
  ALTER TABLE costs ENABLE TRIGGER create_supplier_payment_from_cost_trigger;

  RAISE NOTICE 'Backfill completado: % pagos creados', v_count;
END $$