-- Fix existing inconsistent data using the sync flag
DO $$
BEGIN
  PERFORM set_config('app.sync_in_progress', 'true', true);
  
  UPDATE costs c SET
    payment_date = sp.paid_date,
    updated_at = now()
  FROM supplier_payments sp
  WHERE (c.supplier_payment_id = sp.id OR sp.cost_id = c.id)
    AND sp.paid_date IS NOT NULL
    AND (c.payment_date IS DISTINCT FROM sp.paid_date);

  PERFORM set_config('app.sync_in_progress', 'false', true);
END $$;