-- Paso 1: Asegurar que el trigger esté correctamente vinculado a crane_parts
DROP TRIGGER IF EXISTS sync_parts_to_inventory_trigger ON crane_parts;

CREATE TRIGGER sync_parts_to_inventory_trigger
  AFTER INSERT ON crane_parts
  FOR EACH ROW
  EXECUTE FUNCTION sync_parts_purchase_to_inventory();

-- Paso 2: Actualizar la función para usar el tipo de movimiento correcto
CREATE OR REPLACE FUNCTION public.sync_parts_purchase_to_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inventory_item_id UUID;
  v_location_id UUID;
  v_category_id UUID;
BEGIN
  -- Solo procesar si tiene cost_id (viene de una compra real)
  IF NEW.cost_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Obtener o crear categoría de piezas de grúa
  SELECT id INTO v_category_id
  FROM inventory_categories
  WHERE name ILIKE '%pieza%' OR name ILIKE '%repuesto%'
  LIMIT 1;

  IF v_category_id IS NULL THEN
    INSERT INTO inventory_categories (name, description, code)
    VALUES ('Piezas de Grúa', 'Repuestos y piezas para mantenimiento de grúas', 'CRANE_PARTS')
    RETURNING id INTO v_category_id;
  END IF;

  -- Buscar o crear el item en inventario basado en el nombre de la pieza
  SELECT id INTO v_inventory_item_id
  FROM inventory_items
  WHERE LOWER(name) = LOWER(NEW.part_name)
  LIMIT 1;

  IF v_inventory_item_id IS NULL THEN
    INSERT INTO inventory_items (
      name,
      description,
      category_id,
      unit_of_measure,
      minimum_stock,
      unit_cost,
      is_active
    ) VALUES (
      NEW.part_name,
      'Pieza para grúa - ' || COALESCE(NEW.supplier, 'Proveedor no especificado'),
      v_category_id,
      'unidad',
      1,
      NEW.unit_price,
      true
    )
    RETURNING id INTO v_inventory_item_id;
    
    RAISE NOTICE 'Creado nuevo item de inventario: % (ID: %)', NEW.part_name, v_inventory_item_id;
  END IF;

  -- Obtener ubicación principal
  SELECT id INTO v_location_id
  FROM inventory_locations
  WHERE is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_location_id IS NULL THEN
    INSERT INTO inventory_locations (name, code, description, is_active)
    VALUES ('Bodega Principal', 'MAIN', 'Ubicación principal de inventario', true)
    RETURNING id INTO v_location_id;
  END IF;

  -- Crear movimiento de inventario de tipo 'entry' (entrada por compra)
  INSERT INTO inventory_movements (
    item_id,
    location_id,
    movement_type,
    quantity,
    unit_cost,
    total_cost,
    movement_date,
    reason,
    supplier_name,
    crane_id,
    cost_id,
    observations,
    created_by
  ) VALUES (
    v_inventory_item_id,
    v_location_id,
    'entry',
    NEW.quantity,
    NEW.unit_price,
    NEW.total_value,
    NEW.date,
    'Compra de pieza: ' || NEW.part_name,
    NEW.supplier,
    NEW.crane_id,
    NEW.cost_id,
    COALESCE(NEW.notes, ''),
    NEW.created_by
  );

  RAISE NOTICE 'Sincronizado movimiento de inventario para pieza: %', NEW.part_name;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error en sync_parts_purchase_to_inventory: % - %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- Paso 3: Crear manualmente el item "PASADOR DE BOTELLA DE LEVANTE" en inventario
DO $$
DECLARE
  v_category_id UUID;
  v_location_id UUID;
  v_inventory_item_id UUID;
  v_crane_part_record RECORD;
BEGIN
  -- Obtener o crear categoría de piezas de grúa
  SELECT id INTO v_category_id
  FROM inventory_categories
  WHERE name ILIKE '%pieza%' OR name ILIKE '%repuesto%'
  LIMIT 1;

  IF v_category_id IS NULL THEN
    INSERT INTO inventory_categories (name, description, code)
    VALUES ('Piezas de Grúa', 'Repuestos y piezas para mantenimiento de grúas', 'CRANE_PARTS')
    RETURNING id INTO v_category_id;
  END IF;

  -- Obtener ubicación principal
  SELECT id INTO v_location_id
  FROM inventory_locations
  WHERE is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_location_id IS NULL THEN
    INSERT INTO inventory_locations (name, code, description, is_active)
    VALUES ('Bodega Principal', 'MAIN', 'Ubicación principal de inventario', true)
    RETURNING id INTO v_location_id;
  END IF;

  -- Buscar el registro de crane_parts para "PASADOR DE BOTELLA DE LEVANTE"
  SELECT * INTO v_crane_part_record
  FROM crane_parts
  WHERE part_name ILIKE '%PASADOR%BOTELLA%LEVANTE%'
    AND NOT EXISTS (
      SELECT 1 FROM inventory_movements im WHERE im.cost_id = crane_parts.cost_id
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Crear o actualizar el item en inventario
    SELECT id INTO v_inventory_item_id
    FROM inventory_items
    WHERE LOWER(name) = LOWER(v_crane_part_record.part_name)
    LIMIT 1;

    IF v_inventory_item_id IS NULL THEN
      INSERT INTO inventory_items (
        name,
        description,
        category_id,
        unit_of_measure,
        minimum_stock,
        unit_cost,
        is_active
      ) VALUES (
        v_crane_part_record.part_name,
        'Pieza para grúa - ' || COALESCE(v_crane_part_record.supplier, 'Proveedor no especificado'),
        v_category_id,
        'unidad',
        1,
        v_crane_part_record.unit_price,
        true
      )
      RETURNING id INTO v_inventory_item_id;
    END IF;

    -- Crear el movimiento de inventario con tipo 'entry'
    INSERT INTO inventory_movements (
      item_id,
      location_id,
      movement_type,
      quantity,
      unit_cost,
      total_cost,
      movement_date,
      reason,
      supplier_name,
      crane_id,
      cost_id,
      observations,
      created_by
    ) VALUES (
      v_inventory_item_id,
      v_location_id,
      'entry',
      v_crane_part_record.quantity,
      v_crane_part_record.unit_price,
      v_crane_part_record.total_value,
      v_crane_part_record.date,
      'Compra de pieza: ' || v_crane_part_record.part_name,
      v_crane_part_record.supplier,
      v_crane_part_record.crane_id,
      v_crane_part_record.cost_id,
      'Sincronizado manualmente desde crane_parts',
      v_crane_part_record.created_by
    );

    -- Vincular el movimiento con el crane_part
    UPDATE crane_parts
    SET inventory_movement_id = (
      SELECT id FROM inventory_movements
      WHERE cost_id = v_crane_part_record.cost_id
      ORDER BY created_at DESC
      LIMIT 1
    )
    WHERE id = v_crane_part_record.id;

    RAISE NOTICE 'Item sincronizado: %', v_crane_part_record.part_name;
  END IF;
END $$;