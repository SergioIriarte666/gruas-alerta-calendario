-- ===================================
-- FASE 1: Corregir movimiento problemático específico
-- ===================================

-- 1. Actualizar el costo real en inventory_movements primero
UPDATE inventory_movements
SET 
  unit_cost = 52333.00,
  total_cost = 52333.00
WHERE id = 'e4ce553a-3fef-4969-a025-d32228b94ef2';

-- 2. Eliminar TODOS los crane_parts asociados al movimiento (incluyendo duplicados)
DELETE FROM crane_parts 
WHERE inventory_movement_id = 'e4ce553a-3fef-4969-a025-d32228b94ef2';

-- 3. Insertar crane_part correcto (ahora no hay conflicto)
INSERT INTO crane_parts (
  crane_id,
  date,
  supplier,
  part_name,
  quantity,
  unit_price,
  notes,
  inventory_movement_id,
  created_by
)
SELECT
  crane_id,
  movement_date::date,
  'Inventario interno',
  (SELECT name FROM inventory_items WHERE id = item_id),
  quantity,
  52333.00,
  'Consumo desde inventario. Costo real: $52,333',
  id,
  created_by
FROM inventory_movements
WHERE id = 'e4ce553a-3fef-4969-a025-d32228b94ef2';

-- ===================================
-- FASE 2: Actualizar trigger para usar costos reales FIFO
-- ===================================

CREATE OR REPLACE FUNCTION sync_inventory_consumption_to_parts()
RETURNS TRIGGER AS $$
DECLARE
  v_item_name text;
  v_existing_part_id uuid;
BEGIN
  IF NEW.movement_type = 'exit' AND NEW.crane_id IS NOT NULL THEN
    
    SELECT name INTO v_item_name
    FROM inventory_items
    WHERE id = NEW.item_id;
    
    -- Verificar si ya existe un crane_part para este movimiento
    SELECT id INTO v_existing_part_id
    FROM crane_parts
    WHERE inventory_movement_id = NEW.id;
    
    IF v_existing_part_id IS NULL THEN
      -- Insertar nuevo crane_part
      INSERT INTO crane_parts (
        crane_id,
        date,
        supplier,
        part_name,
        quantity,
        unit_price,
        notes,
        inventory_movement_id,
        created_by
      ) VALUES (
        NEW.crane_id,
        NEW.movement_date::date,
        'Inventario interno',
        v_item_name,
        NEW.quantity,
        COALESCE(NEW.unit_cost, 0),
        format('Consumo desde inventario. Costo real: $%s', COALESCE(NEW.total_cost, 0)::text),
        NEW.id,
        NEW.created_by
      );
    ELSE
      -- Actualizar crane_part existente
      UPDATE crane_parts
      SET
        quantity = NEW.quantity,
        unit_price = COALESCE(NEW.unit_cost, 0),
        notes = format('Consumo desde inventario. Costo real: $%s', COALESCE(NEW.total_cost, 0)::text)
      WHERE id = v_existing_part_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;