-- FASE 1: Trigger de sincronización automática
CREATE OR REPLACE FUNCTION public.sync_inventory_cost_to_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_category_name TEXT;
  v_inventory_item_id UUID;
  v_location_id UUID;
  v_category_id UUID;
  v_quantity INT := 1;
  v_unit_cost NUMERIC;
  v_movement_id UUID;
BEGIN
  SELECT name INTO v_category_name FROM cost_categories WHERE id = NEW.category_id;
  IF v_category_name NOT ILIKE '%inventario%' THEN RETURN NEW; END IF;
  IF NEW.inventory_movement_id IS NOT NULL THEN RETURN NEW; END IF;
  
  IF NEW.purchase_quantity IS NOT NULL AND NEW.purchase_quantity > 0 THEN
    v_quantity := NEW.purchase_quantity;
  END IF;
  
  IF NEW.purchase_unit_cost IS NOT NULL AND NEW.purchase_unit_cost > 0 THEN
    v_unit_cost := NEW.purchase_unit_cost;
  ELSE
    v_unit_cost := NEW.amount / v_quantity;
  END IF;
  
  SELECT id INTO v_category_id FROM inventory_categories WHERE name ILIKE '%compra%' OR name ILIKE '%general%' ORDER BY created_at ASC LIMIT 1;
  IF v_category_id IS NULL THEN
    INSERT INTO inventory_categories (name, description, code) VALUES ('Compras Generales', 'Productos comprados para inventario', 'PURCHASES') RETURNING id INTO v_category_id;
  END IF;
  
  SELECT id INTO v_inventory_item_id FROM inventory_items WHERE LOWER(TRIM(name)) = LOWER(TRIM(NEW.description)) LIMIT 1;
  IF v_inventory_item_id IS NULL THEN
    INSERT INTO inventory_items (name, description, category_id, unit_of_measure, minimum_stock, unit_cost, is_active)
    VALUES (NEW.description, 'Creado desde costos', v_category_id, 'unidad', 1, v_unit_cost, true) RETURNING id INTO v_inventory_item_id;
  END IF;
  
  SELECT id INTO v_location_id FROM inventory_locations WHERE is_active = true ORDER BY created_at ASC LIMIT 1;
  IF v_location_id IS NULL THEN
    INSERT INTO inventory_locations (name, code, description, is_active) VALUES ('Bodega Principal', 'MAIN', 'Ubicación principal', true) RETURNING id INTO v_location_id;
  END IF;
  
  INSERT INTO inventory_movements (item_id, location_id, movement_type, quantity, unit_cost, total_cost, movement_date, reason, crane_id, cost_id, observations, created_by, status)
  VALUES (v_inventory_item_id, v_location_id, 'entry', v_quantity, v_unit_cost, NEW.amount, NEW.date, 'Compra desde Costos', NEW.crane_id, NEW.id, COALESCE(NEW.notes, 'Auto-sync'), NEW.created_by, 'active')
  RETURNING id INTO v_movement_id;
  
  UPDATE costs SET inventory_movement_id = v_movement_id WHERE id = NEW.id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_inventory_cost_trigger ON costs;
CREATE TRIGGER sync_inventory_cost_trigger AFTER INSERT ON costs FOR EACH ROW EXECUTE FUNCTION sync_inventory_cost_to_movement();

-- FASE 2: Agregar campos de compra
ALTER TABLE public.costs ADD COLUMN IF NOT EXISTS purchase_quantity INTEGER;
ALTER TABLE public.costs ADD COLUMN IF NOT EXISTS purchase_unit_cost NUMERIC(12, 2);