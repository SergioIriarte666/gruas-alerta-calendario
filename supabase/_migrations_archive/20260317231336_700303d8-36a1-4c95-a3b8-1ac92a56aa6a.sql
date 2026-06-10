
-- Reconciliation function: link orphan records between costs, supplier_payments, inventory_movements, crane_parts
CREATE OR REPLACE FUNCTION public.reconcile_orphan_records()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_payments int := 0;
  linked_movements int := 0;
  linked_parts int := 0;
  duplicates_found int := 0;
  result jsonb;
BEGIN
  -- 1. Link costs to supplier_payments by matching supplier_id + amount + date (within 3 days)
  UPDATE costs c
  SET supplier_payment_id = sp.id
  FROM supplier_payments sp
  WHERE c.supplier_payment_id IS NULL
    AND c.supplier_id IS NOT NULL
    AND c.supplier_id = sp.supplier_id
    AND c.amount = sp.amount
    AND ABS(c.date - sp.due_date::date) <= 3
    AND sp.id NOT IN (SELECT supplier_payment_id FROM costs WHERE supplier_payment_id IS NOT NULL);
  GET DIAGNOSTICS linked_payments = ROW_COUNT;

  -- 2. Link costs to inventory_movements by matching amount + date
  UPDATE costs c
  SET inventory_movement_id = im.id
  FROM inventory_movements im
  WHERE c.inventory_movement_id IS NULL
    AND im.cost_id IS NULL
    AND im.total_cost = c.amount
    AND im.movement_date::date = c.date
    AND im.movement_type = 'entry';
  GET DIAGNOSTICS linked_movements = ROW_COUNT;

  -- Also set the reverse link
  UPDATE inventory_movements im
  SET cost_id = c.id
  FROM costs c
  WHERE im.cost_id IS NULL
    AND c.inventory_movement_id = im.id;

  -- 3. Link crane_parts to costs by matching crane_id + total_value + date
  UPDATE crane_parts cp
  SET cost_id = c.id
  FROM costs c
  WHERE cp.cost_id IS NULL
    AND c.crane_id IS NOT NULL
    AND cp.crane_id = c.crane_id
    AND cp.total_value = c.amount
    AND cp.date = c.date
    AND c.id NOT IN (SELECT cost_id FROM crane_parts WHERE cost_id IS NOT NULL);
  GET DIAGNOSTICS linked_parts = ROW_COUNT;

  -- 4. Count potential duplicates (same supplier + amount + date in costs)
  SELECT COUNT(*) INTO duplicates_found
  FROM (
    SELECT supplier_id, amount, date, COUNT(*) as cnt
    FROM costs
    WHERE supplier_id IS NOT NULL
    GROUP BY supplier_id, amount, date
    HAVING COUNT(*) > 1
  ) dups;

  result := jsonb_build_object(
    'linked_payments', linked_payments,
    'linked_movements', linked_movements,
    'linked_parts', linked_parts,
    'potential_duplicates', duplicates_found,
    'executed_at', now()
  );

  RETURN result;
END;
$$;
