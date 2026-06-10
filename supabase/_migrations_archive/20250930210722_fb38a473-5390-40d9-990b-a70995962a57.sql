-- Función para sincronizar manualmente un gasto de pieza con inventario
CREATE OR REPLACE FUNCTION sync_crane_part_to_inventory(
  p_part_name TEXT,
  p_inventory_item_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_crane_part_record RECORD;
  v_inventory_item_id UUID;
  v_location_id UUID;
  v_movement_id UUID;
BEGIN
  -- Buscar el item en inventario (usar el proporcionado o buscar por nombre)
  IF p_inventory_item_id IS NOT NULL THEN
    v_inventory_item_id := p_inventory_item_id;
  ELSE
    SELECT id INTO v_inventory_item_id
    FROM inventory_items
    WHERE LOWER(name) = LOWER(p_part_name)
    LIMIT 1;
  END IF;

  IF v_inventory_item_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Item de inventario no encontrado: ' || p_part_name
    );
  END IF;

  -- Buscar el registro de crane_parts sin sincronizar
  SELECT * INTO v_crane_part_record
  FROM crane_parts
  WHERE LOWER(part_name) = LOWER(p_part_name)
    AND inventory_movement_id IS NULL
    AND cost_id IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se encontró registro de pieza sin sincronizar: ' || p_part_name
    );
  END IF;

  -- Verificar si ya existe un movimiento para este cost_id
  SELECT id INTO v_movement_id
  FROM inventory_movements
  WHERE cost_id = v_crane_part_record.cost_id
  LIMIT 1;

  IF v_movement_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ya existe un movimiento de inventario para este costo',
      'movement_id', v_movement_id
    );
  END IF;

  -- Obtener ubicación principal
  SELECT id INTO v_location_id
  FROM inventory_locations
  WHERE is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_location_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se encontró ubicación de inventario activa'
    );
  END IF;

  -- Crear el movimiento de inventario
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
    'Sincronizado manualmente',
    v_crane_part_record.created_by
  )
  RETURNING id INTO v_movement_id;

  -- Actualizar crane_parts con el movimiento creado
  UPDATE crane_parts
  SET inventory_movement_id = v_movement_id
  WHERE id = v_crane_part_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'movement_id', v_movement_id,
    'crane_part_id', v_crane_part_record.id,
    'inventory_item_id', v_inventory_item_id,
    'message', 'Sincronización completada exitosamente'
  );
END;
$$;

-- Sincronizar inmediatamente el "Pasador Botella Levante"
SELECT sync_crane_part_to_inventory('Pasador Botella Levante');