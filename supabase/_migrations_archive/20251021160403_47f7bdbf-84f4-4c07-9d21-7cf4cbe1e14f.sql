-- Agregar campo immediate_consumption a la tabla costs
ALTER TABLE public.costs 
ADD COLUMN IF NOT EXISTS immediate_consumption BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.costs.immediate_consumption IS 
'Indica si la compra debe consumirse inmediatamente. Si es true, se crea automáticamente un movimiento de salida a la grúa seleccionada.';

-- Modificar el trigger para manejar consumo inmediato
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
  SELECT cc.name INTO v_category_name FROM cost_categories cc WHERE cc.id = NEW.category_id;
  IF v_category_name IS NULL OR v_category_name NOT ILIKE '%inventario%' THEN RETURN NEW; END IF;
  
  SELECT id INTO v_location_id FROM inventory_locations WHERE is_active = true ORDER BY created_at ASC LIMIT 1;
  IF v_location_id IS NULL THEN
    INSERT INTO inventory_locations (name, code, description, is_active) VALUES ('Bodega Principal', 'MAIN', 'Ubicación principal', true) RETURNING id INTO v_location_id;
  END IF;
  
  SELECT id INTO v_category_id FROM inventory_categories WHERE name ILIKE '%compra%' OR name ILIKE '%general%' ORDER BY created_at ASC LIMIT 1;
  IF v_category_id IS NULL THEN
    INSERT INTO inventory_categories (name, description, code) VALUES ('Compras Generales', 'Productos comprados', 'PURCHASES') RETURNING id INTO v_category_id;
  END IF;
  
  v_quantity := COALESCE(NEW.purchase_quantity, 1);
  v_unit_cost := COALESCE(NEW.purchase_unit_cost, NEW.amount);
  
  SELECT id INTO v_inventory_item_id FROM inventory_items WHERE LOWER(TRIM(name)) = LOWER(TRIM(NEW.description)) LIMIT 1;
  IF v_inventory_item_id IS NULL THEN
    INSERT INTO inventory_items (name, description, category_id, unit_of_measure, minimum_stock, unit_cost, is_active)
    VALUES (NEW.description, 'Auto-creado desde costos', v_category_id, 'unidad', 1, v_unit_cost, true) RETURNING id INTO v_inventory_item_id;
  END IF;
  
  -- Crear movimiento de ENTRADA
  INSERT INTO inventory_movements (item_id, location_id, movement_type, quantity, unit_cost, total_cost, movement_date, reason, crane_id, cost_id, observations, created_by, status)
  VALUES (v_inventory_item_id, v_location_id, 'entry', v_quantity, v_unit_cost, NEW.amount, NEW.date, 'Compra desde módulo de costos', NEW.crane_id, NEW.id, COALESCE(NEW.notes, 'Sincronización automática'), NEW.created_by, 'active')
  RETURNING id INTO v_movement_id;
  
  UPDATE costs SET inventory_movement_id = v_movement_id WHERE id = NEW.id;
  
  -- Si es consumo inmediato Y tiene grúa seleccionada, crear movimiento de SALIDA
  IF NEW.immediate_consumption = true AND NEW.crane_id IS NOT NULL THEN
    INSERT INTO inventory_movements (
      item_id,
      location_id,
      movement_type,
      quantity,
      unit_cost,
      total_cost,
      movement_date,
      reason,
      crane_id,
      cost_id,
      observations,
      created_by,
      status
    )
    VALUES (
      v_inventory_item_id,
      v_location_id,
      'exit',                    -- Tipo SALIDA
      v_quantity,                -- Misma cantidad
      v_unit_cost,               -- Mismo costo unitario
      NEW.amount,                -- Mismo total
      NEW.date,                  -- Misma fecha
      'Consumo inmediato desde compra',  -- Razón específica
      NEW.crane_id,              -- Grúa destino
      NEW.id,                    -- Mismo cost_id para trazabilidad
      'Auto-generado: Consumo inmediato en grúa',
      NEW.created_by,
      'active'
    );
    
    RAISE NOTICE 'Movimiento de salida por consumo inmediato creado para grúa %', NEW.crane_id;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN 
  RAISE WARNING 'Error en sync_inventory_cost_to_movement: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Comentario explicativo
COMMENT ON FUNCTION public.sync_inventory_cost_to_movement() IS 
'Sincroniza automáticamente los costos de inventario con inventory_movements. Si immediate_consumption=true, crea entrada y salida inmediata a la grúa.';