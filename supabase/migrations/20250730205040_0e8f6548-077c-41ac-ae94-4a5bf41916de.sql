-- Corregir función de sincronización de inventario con mejor manejo de errores
CREATE OR REPLACE FUNCTION public.sync_parts_purchase_to_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  local_inventory_item_id UUID;
  movement_id UUID;
  location_id UUID;
  error_message TEXT;
BEGIN
  -- Log de inicio
  RAISE NOTICE 'Iniciando sincronización para pieza: % (ID: %)', NEW.part_name, NEW.id;
  
  -- Si ya tiene inventory_movement_id, no hacer nada
  IF NEW.inventory_movement_id IS NOT NULL THEN
    RAISE NOTICE 'Pieza ya sincronizada: %', NEW.part_name;
    RETURN NEW;
  END IF;

  -- Obtener ubicación por defecto (primera activa)
  SELECT il.id INTO location_id
  FROM inventory_locations il
  WHERE il.is_active = true
  ORDER BY il.created_at
  LIMIT 1;

  -- Si no hay ubicación, crear una por defecto
  IF location_id IS NULL THEN
    INSERT INTO inventory_locations (name, code, description, is_active, created_by)
    VALUES ('Bodega Principal', 'MAIN', 'Bodega principal de repuestos', true, COALESCE(NEW.created_by, auth.uid()))
    RETURNING id INTO location_id;
    
    RAISE NOTICE 'Creada ubicación por defecto: %', location_id;
  END IF;

  -- Buscar item de inventario existente basado en el nombre de la pieza
  SELECT ii.id INTO local_inventory_item_id
  FROM inventory_items ii
  WHERE LOWER(TRIM(ii.name)) = LOWER(TRIM(NEW.part_name))
  AND ii.is_active = true
  LIMIT 1;

  -- Si no existe el item, crearlo
  IF local_inventory_item_id IS NULL THEN
    INSERT INTO inventory_items (
      name,
      description,
      unit_of_measure,
      unit_cost,
      minimum_stock,
      is_active,
      created_by
    ) VALUES (
      TRIM(NEW.part_name),
      'Auto-creado desde compra de pieza para grúa',
      'unidad',
      NEW.unit_price,
      1,
      true,
      COALESCE(NEW.created_by, auth.uid())
    )
    RETURNING id INTO local_inventory_item_id;
    
    RAISE NOTICE 'Creado item de inventario: % con ID: %', NEW.part_name, local_inventory_item_id;
  ELSE
    RAISE NOTICE 'Usando item de inventario existente: %', local_inventory_item_id;
  END IF;

  -- Crear movimiento de entrada al inventario
  INSERT INTO inventory_movements (
    item_id,
    location_id,
    movement_type,
    quantity,
    unit_cost,
    total_cost,
    supplier_name,
    reference_document,
    observations,
    movement_date,
    status,
    created_by
  ) VALUES (
    local_inventory_item_id,
    location_id,
    'entry',
    NEW.quantity,
    NEW.unit_price,
    NEW.total_value,
    NEW.supplier,
    'Compra de pieza para grúa - Pieza ID: ' || NEW.id,
    'Movimiento automático generado desde compra de pieza',
    NEW.date,
    'active',
    COALESCE(NEW.created_by, auth.uid())
  )
  RETURNING id INTO movement_id;
  
  RAISE NOTICE 'Creado movimiento de inventario: %', movement_id;

  -- Actualizar crane_parts con referencia al movimiento
  NEW.inventory_movement_id := movement_id;

  -- Crear mapeo en cost_inventory_items si existe cost_id
  IF NEW.cost_id IS NOT NULL THEN
    INSERT INTO cost_inventory_items (
      cost_id,
      inventory_item_id,
      quantity,
      unit_cost,
      created_by
    ) VALUES (
      NEW.cost_id,
      local_inventory_item_id,
      NEW.quantity,
      NEW.unit_price,
      COALESCE(NEW.created_by, auth.uid())
    )
    ON CONFLICT (cost_id, inventory_item_id) DO UPDATE SET
      quantity = EXCLUDED.quantity,
      unit_cost = EXCLUDED.unit_cost;
      
    RAISE NOTICE 'Creado/actualizado mapeo cost_inventory_items';
  END IF;

  RAISE NOTICE 'Sincronización completada exitosamente para: %', NEW.part_name;
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Capturar error específico
    error_message := SQLERRM;
    RAISE WARNING 'Error en sincronización de inventario para pieza %: %', NEW.part_name, error_message;
    
    -- Log detallado del error
    RAISE NOTICE 'Error details - Part: %, Error: %, SQLState: %', NEW.part_name, error_message, SQLSTATE;
    
    -- Retornar NEW para que la inserción de crane_parts continúe
    RETURN NEW;
END;
$$;

-- Función para migrar piezas existentes sin sincronizar
CREATE OR REPLACE FUNCTION public.migrate_unsynced_crane_parts_to_inventory()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  part_record RECORD;
  local_inventory_item_id UUID;
  movement_id UUID;
  location_id UUID;
  migrated_count INTEGER := 0;
  error_count INTEGER := 0;
  errors jsonb := '[]'::jsonb;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar migraciones';
  END IF;

  -- Obtener ubicación por defecto
  SELECT il.id INTO location_id
  FROM inventory_locations il
  WHERE il.is_active = true
  ORDER BY il.created_at
  LIMIT 1;

  -- Si no hay ubicación, crear una
  IF location_id IS NULL THEN
    INSERT INTO inventory_locations (name, code, description, is_active)
    VALUES ('Bodega Principal', 'MAIN', 'Bodega principal de repuestos', true)
    RETURNING id INTO location_id;
  END IF;

  -- Migrar piezas sin sincronizar (sin inventory_movement_id)
  FOR part_record IN 
    SELECT cp.* FROM crane_parts cp
    WHERE cp.inventory_movement_id IS NULL
    ORDER BY cp.created_at
  LOOP
    BEGIN
      -- Buscar o crear item de inventario
      SELECT ii.id INTO local_inventory_item_id
      FROM inventory_items ii
      WHERE LOWER(TRIM(ii.name)) = LOWER(TRIM(part_record.part_name))
      AND ii.is_active = true
      LIMIT 1;

      IF local_inventory_item_id IS NULL THEN
        INSERT INTO inventory_items (
          name,
          description,
          unit_of_measure,
          unit_cost,
          minimum_stock,
          is_active,
          created_by
        ) VALUES (
          TRIM(part_record.part_name),
          'Migrado desde pieza de grúa existente',
          'unidad',
          part_record.unit_price,
          1,
          true,
          part_record.created_by
        )
        RETURNING id INTO local_inventory_item_id;
      END IF;

      -- Crear movimiento de entrada
      INSERT INTO inventory_movements (
        item_id,
        location_id,
        movement_type,
        quantity,
        unit_cost,
        total_cost,
        supplier_name,
        reference_document,
        observations,
        movement_date,
        status,
        created_by
      ) VALUES (
        local_inventory_item_id,
        location_id,
        'entry',
        part_record.quantity,
        part_record.unit_price,
        part_record.total_value,
        part_record.supplier,
        'Migración de pieza existente - ID: ' || part_record.id,
        'Movimiento migrado automáticamente',
        part_record.date,
        'active',
        part_record.created_by
      )
      RETURNING id INTO movement_id;

      -- Actualizar crane_parts con referencia
      UPDATE crane_parts 
      SET inventory_movement_id = movement_id
      WHERE id = part_record.id;

      -- Crear mapeo si existe cost_id
      IF part_record.cost_id IS NOT NULL THEN
        INSERT INTO cost_inventory_items (
          cost_id,
          inventory_item_id,
          quantity,
          unit_cost,
          created_by
        ) VALUES (
          part_record.cost_id,
          local_inventory_item_id,
          part_record.quantity,
          part_record.unit_price,
          part_record.created_by
        )
        ON CONFLICT (cost_id, inventory_item_id) DO NOTHING;
      END IF;

      migrated_count := migrated_count + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        errors := errors || jsonb_build_object(
          'part_id', part_record.id,
          'part_name', part_record.part_name,
          'error', SQLERRM
        );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'migrated_count', migrated_count,
    'error_count', error_count,
    'errors', errors,
    'message', format('Migración completada: %s piezas migradas, %s errores', migrated_count, error_count)
  );
END;
$$;