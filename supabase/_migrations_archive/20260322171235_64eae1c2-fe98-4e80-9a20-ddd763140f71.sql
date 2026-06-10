
-- Temporarily disable the paid costs protection trigger
ALTER TABLE costs DISABLE TRIGGER prevent_non_admin_updates_on_paid_costs_trigger;

-- Backfill: link costs that already have movements but missing inventory_movement_id
UPDATE costs SET inventory_movement_id = '20f26652-c84d-4af8-b6b5-6e3de760d49f'
WHERE id = 'd755a1a4-123f-4499-8948-74cb642173c4' AND inventory_movement_id IS NULL;

UPDATE costs SET inventory_movement_id = '2bb8795b-7cab-4a49-a965-88b26d1666cb'
WHERE id = '22338c4a-c487-4687-939d-289b860506f3' AND inventory_movement_id IS NULL;

UPDATE costs SET inventory_movement_id = '9dc0c978-3c4b-46ef-96b5-32d766d0e62e'
WHERE id = 'e236dfb3-d2cb-40b7-995c-28406f2facb6' AND inventory_movement_id IS NULL;

-- Create crane_parts for these 3 costs (without total_value since it's generated)
INSERT INTO crane_parts (crane_id, date, part_name, supplier, quantity, unit_price, cost_id, inventory_movement_id)
SELECT c.crane_id, c.date, c.description, COALESCE(s.name, 'Sin proveedor'), 
       COALESCE(c.purchase_quantity, 1), COALESCE(c.purchase_unit_cost, c.amount), c.id,
       c.inventory_movement_id
FROM costs c
LEFT JOIN inventory_suppliers s ON s.id = c.supplier_id
WHERE c.id IN ('d755a1a4-123f-4499-8948-74cb642173c4','22338c4a-c487-4687-939d-289b860506f3','e236dfb3-d2cb-40b7-995c-28406f2facb6')
  AND NOT EXISTS (SELECT 1 FROM crane_parts cp WHERE cp.cost_id = c.id);

-- Handle the 5 costs with NO movements
DO $$
DECLARE
  v_location_id UUID := '5e0d4585-2d9e-4aa2-b15b-8f88f5efcf7c';
  r RECORD;
  v_item_id UUID;
  v_entry_id UUID;
  v_exit_id UUID;
  v_qty INT;
BEGIN
  FOR r IN
    SELECT c.id, c.description, c.crane_id, c.date, c.amount, 
           c.purchase_quantity, c.purchase_unit_cost, c.supplier_id,
           s.name as supplier_name
    FROM costs c
    LEFT JOIN inventory_suppliers s ON s.id = c.supplier_id
    WHERE c.id IN (
      '84d02680-6bd1-4230-951a-755cb0b216c8',
      '429d43e3-27d3-4627-b43a-ce34dfb25214',
      'a70c6f7b-b576-4d6f-ac83-623d08f03c12',
      '7496b57c-4976-4d07-a05f-c3a08c64e3ff',
      '139b5847-2331-4ad2-8dde-96c6400e769a'
    )
    AND c.crane_id IS NOT NULL
  LOOP
    SELECT id INTO v_item_id FROM inventory_items WHERE lower(trim(name)) = lower(trim(r.description)) LIMIT 1;
    IF v_item_id IS NULL THEN
      INSERT INTO inventory_items (name, unit_of_measure, unit_cost, is_active)
      VALUES (trim(r.description), 'unidad', COALESCE(r.purchase_unit_cost, r.amount), true)
      RETURNING id INTO v_item_id;
    END IF;

    v_qty := COALESCE(r.purchase_quantity, 1);

    INSERT INTO inventory_movements (
      item_id, location_id, movement_type, quantity, unit_cost, total_cost,
      movement_date, reason, observations, status, cost_id, supplier_id
    ) VALUES (
      v_item_id, v_location_id, 'entry', v_qty, 
      COALESCE(r.purchase_unit_cost, r.amount), r.amount,
      r.date, 'Compra con consumo inmediato (backfill)',
      'Backfill desde costo ID: ' || r.id, 'active', r.id, r.supplier_id
    ) RETURNING id INTO v_entry_id;

    INSERT INTO inventory_movements (
      item_id, location_id, movement_type, quantity, unit_cost, total_cost,
      movement_date, reason, observations, status, cost_id, crane_id
    ) VALUES (
      v_item_id, v_location_id, 'exit', v_qty,
      COALESCE(r.purchase_unit_cost, r.amount), r.amount,
      r.date, 'Consumo inmediato (backfill)',
      'Consumo directo a grúa desde costo ID: ' || r.id, 'active', r.id, r.crane_id
    ) RETURNING id INTO v_exit_id;

    UPDATE costs SET inventory_movement_id = v_exit_id WHERE id = r.id;

    INSERT INTO crane_parts (crane_id, date, part_name, supplier, quantity, unit_price, cost_id, inventory_movement_id)
    VALUES (r.crane_id, r.date, r.description, COALESCE(r.supplier_name, 'Sin proveedor'),
            v_qty, COALESCE(r.purchase_unit_cost, r.amount), r.id, v_exit_id);
  END LOOP;
END $$;

-- Re-enable the trigger
ALTER TABLE costs ENABLE TRIGGER prevent_non_admin_updates_on_paid_costs_trigger;
