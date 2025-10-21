-- FASE 6: Backfill de datos históricos de inventario
DO $$
DECLARE
  v_cost_record RECORD;
  v_inventory_item_id UUID;
  v_location_id UUID;
  v_category_id UUID;
  v_movement_id UUID;
  v_processed_count INT := 0;
  v_error_count INT := 0;
BEGIN
  SELECT id INTO v_location_id FROM inventory_locations WHERE is_active = true ORDER BY created_at ASC LIMIT 1;
  IF v_location_id IS NULL THEN
    INSERT INTO inventory_locations (name, code, description, is_active) VALUES ('Bodega Principal', 'MAIN', 'Ubicación principal', true) RETURNING id INTO v_location_id;
  END IF;
  
  SELECT id INTO v_category_id FROM inventory_categories WHERE name ILIKE '%compra%' OR name ILIKE '%general%' ORDER BY created_at ASC LIMIT 1;
  IF v_category_id IS NULL THEN
    INSERT INTO inventory_categories (name, description, code) VALUES ('Compras Generales', 'Productos comprados', 'PURCHASES') RETURNING id INTO v_category_id;
  END IF;
  
  FOR v_cost_record IN
    SELECT c.id, c.description, c.amount, c.date, c.crane_id, c.created_by, c.notes,
           COALESCE(c.purchase_quantity, 1) as quantity,
           COALESCE(c.purchase_unit_cost, c.amount) as unit_cost
    FROM costs c
    JOIN cost_categories cc ON c.category_id = cc.id
    WHERE cc.name ILIKE '%inventario%' AND c.inventory_movement_id IS NULL
    ORDER BY c.date ASC
  LOOP
    BEGIN
      SELECT id INTO v_inventory_item_id FROM inventory_items WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_cost_record.description)) LIMIT 1;
      IF v_inventory_item_id IS NULL THEN
        INSERT INTO inventory_items (name, description, category_id, unit_of_measure, minimum_stock, unit_cost, is_active)
        VALUES (v_cost_record.description, 'Migrado', v_category_id, 'unidad', 1, v_cost_record.unit_cost, true) RETURNING id INTO v_inventory_item_id;
      END IF;
      
      INSERT INTO inventory_movements (item_id, location_id, movement_type, quantity, unit_cost, total_cost, movement_date, reason, crane_id, cost_id, observations, created_by, status)
      VALUES (v_inventory_item_id, v_location_id, 'entry', v_cost_record.quantity, v_cost_record.unit_cost, v_cost_record.amount, v_cost_record.date, 'Migración', v_cost_record.crane_id, v_cost_record.id, COALESCE(v_cost_record.notes, 'Auto'), v_cost_record.created_by, 'active')
      RETURNING id INTO v_movement_id;
      
      UPDATE costs SET inventory_movement_id = v_movement_id WHERE id = v_cost_record.id;
      v_processed_count := v_processed_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
    END;
  END LOOP;
END $$;