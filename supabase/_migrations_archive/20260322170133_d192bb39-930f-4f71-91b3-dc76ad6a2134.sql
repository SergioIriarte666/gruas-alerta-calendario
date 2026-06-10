
-- Disable only USER triggers (not system FK triggers)
ALTER TABLE costs DISABLE TRIGGER USER;
ALTER TABLE supplier_payments DISABLE TRIGGER USER;
ALTER TABLE inventory_movements DISABLE TRIGGER USER;
ALTER TABLE crane_parts DISABLE TRIGGER USER;

DO $$
DECLARE
  r RECORD;
  v_count INT := 0;
  v_mov_ids UUID[];
BEGIN
  FOR r IN
    SELECT c1.id as dup_cost_id
    FROM costs c1
    JOIN cost_categories cc ON c1.category_id = cc.id
    WHERE cc.name ILIKE '%mantenimiento%'
      AND c1.subcategory = 'Piezas y Repuestos'
      AND EXISTS (
        SELECT 1 FROM costs c2
        WHERE c2.id != c1.id
          AND c2.description = c1.description
          AND c2.amount = c1.amount
          AND c2.date = c1.date
          AND c2.crane_id IS NOT DISTINCT FROM c1.crane_id
          AND c2.category_id != c1.category_id
      )
  LOOP
    SELECT array_agg(id) INTO v_mov_ids FROM inventory_movements WHERE cost_id = r.dup_cost_id;
    
    IF v_mov_ids IS NOT NULL THEN
      UPDATE costs SET inventory_movement_id = NULL WHERE inventory_movement_id = ANY(v_mov_ids);
      DELETE FROM crane_parts WHERE inventory_movement_id = ANY(v_mov_ids);
      DELETE FROM inventory_consumptions WHERE movement_id = ANY(v_mov_ids);
    END IF;
    
    DELETE FROM crane_parts WHERE cost_id = r.dup_cost_id;
    UPDATE costs SET supplier_payment_id = NULL WHERE id = r.dup_cost_id;
    DELETE FROM supplier_payments WHERE cost_id = r.dup_cost_id;
    DELETE FROM inventory_movements WHERE cost_id = r.dup_cost_id;
    DELETE FROM costs WHERE id = r.dup_cost_id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Cleaned up % duplicate costs', v_count;
END $$;

-- Re-enable USER triggers
ALTER TABLE costs ENABLE TRIGGER USER;
ALTER TABLE supplier_payments ENABLE TRIGGER USER;
ALTER TABLE inventory_movements ENABLE TRIGGER USER;
ALTER TABLE crane_parts ENABLE TRIGGER USER;
