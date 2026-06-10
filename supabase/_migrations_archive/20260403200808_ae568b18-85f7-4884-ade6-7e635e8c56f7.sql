
-- Backfill: propagate supplier_invoice_id/supplier_invoice_item_id from the most recent entry to exit movements
UPDATE inventory_movements exit_m
SET 
  supplier_invoice_id = entry_m.supplier_invoice_id,
  supplier_invoice_item_id = entry_m.supplier_invoice_item_id
FROM (
  SELECT DISTINCT ON (exit_id) 
    e.exit_id,
    e.supplier_invoice_id,
    e.supplier_invoice_item_id
  FROM (
    SELECT 
      exit_m2.id as exit_id,
      entry_m2.supplier_invoice_id,
      entry_m2.supplier_invoice_item_id,
      entry_m2.movement_date
    FROM inventory_movements exit_m2
    JOIN inventory_movements entry_m2 
      ON entry_m2.item_id = exit_m2.item_id
      AND entry_m2.location_id = exit_m2.location_id
      AND entry_m2.movement_type = 'entry'
      AND entry_m2.status = 'active'
      AND entry_m2.supplier_invoice_id IS NOT NULL
      AND entry_m2.movement_date <= exit_m2.movement_date
    WHERE exit_m2.movement_type = 'exit'
      AND exit_m2.status = 'active'
      AND exit_m2.supplier_invoice_id IS NULL
  ) e
  ORDER BY e.exit_id, e.movement_date DESC
) entry_m
WHERE exit_m.id = entry_m.exit_id;
