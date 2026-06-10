-- Implementar sincronización bidireccional completa para inventario

-- 1. Crear función para sincronizar salidas de inventario a crane_parts
CREATE OR REPLACE FUNCTION public.sync_inventory_exit_to_crane_parts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  maintenance_category_id UUID;
  new_cost_id UUID;
BEGIN
  -- Solo procesar movimientos de salida con crane_id
  IF NEW.movement_type = 'exit' AND NEW.crane_id IS NOT NULL THEN
    
    -- Obtener categoría de mantenimiento
    SELECT id INTO maintenance_category_id
    FROM public.cost_categories
    WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%maintenance%'
    LIMIT 1;

    -- Si no existe, crear categoría de mantenimiento
    IF maintenance_category_id IS NULL THEN
      INSERT INTO public.cost_categories (name, description)
      VALUES ('Mantenimiento', 'Gastos de mantenimiento y reparaciones')
      RETURNING id INTO maintenance_category_id;
    END IF;

    -- Crear registro de costo para el consumo
    INSERT INTO public.costs (
      amount,
      category_id,
      crane_id,
      date,
      description,
      notes,
      subcategory,
      created_by
    ) VALUES (
      COALESCE(NEW.total_cost, NEW.unit_cost * NEW.quantity, 0),
      maintenance_category_id,
      NEW.crane_id,
      NEW.movement_date::date,
      'Consumo de inventario: ' || (SELECT name FROM public.inventory_items WHERE id = NEW.item_id),
      'Consumo automático registrado desde inventario - Referencia: ' || COALESCE(NEW.reference_document, 'N/A'),
      'Consumo de Inventario',
      COALESCE(NEW.created_by, auth.uid())
    ) RETURNING id INTO new_cost_id;

    -- Crear registro en crane_parts con cantidad negativa (consumo)
    INSERT INTO public.crane_parts (
      crane_id,
      part_name,
      date,
      quantity,
      unit_price,
      total_value,
      supplier,
      notes,
      cost_id,
      inventory_movement_id,
      created_by
    ) VALUES (
      NEW.crane_id,
      (SELECT name FROM public.inventory_items WHERE id = NEW.item_id),
      NEW.movement_date::date,
      -NEW.quantity, -- Cantidad negativa para indicar consumo
      COALESCE(NEW.unit_cost, 0),
      -COALESCE(NEW.total_cost, NEW.unit_cost * NEW.quantity, 0), -- Valor negativo
      COALESCE(NEW.supplier_name, 'Inventario interno'),
      'Consumo registrado automáticamente desde inventario' || 
      CASE WHEN NEW.observations IS NOT NULL THEN ' - ' || NEW.observations ELSE '' END,
      new_cost_id,
      NEW.id,
      COALESCE(NEW.created_by, auth.uid())
    );

    RAISE NOTICE 'Creado registro de consumo en crane_parts para item: %, crane: %, cantidad: %', 
      (SELECT name FROM public.inventory_items WHERE id = NEW.item_id), NEW.crane_id, NEW.quantity;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Crear trigger para sincronización automática
DROP TRIGGER IF EXISTS sync_inventory_exit_to_crane_parts_trigger ON public.inventory_movements;
CREATE TRIGGER sync_inventory_exit_to_crane_parts_trigger
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_inventory_exit_to_crane_parts();

-- 3. Mejorar función de consumo de inventario para incluir más datos
CREATE OR REPLACE FUNCTION public.create_inventory_consumption_movement(
  p_inventory_item_id uuid, 
  p_quantity integer, 
  p_crane_id uuid, 
  p_operator_id uuid DEFAULT NULL::uuid, 
  p_reference_document text DEFAULT NULL::text, 
  p_observations text DEFAULT NULL::text,
  p_unit_cost numeric DEFAULT NULL::numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  movement_id UUID;
  location_id UUID;
  item_unit_cost NUMERIC;
BEGIN
  -- Obtener ubicación por defecto
  SELECT id INTO location_id
  FROM public.inventory_locations
  WHERE is_active = true
  ORDER BY created_at
  LIMIT 1;

  -- Si no hay ubicación, crear una por defecto
  IF location_id IS NULL THEN
    INSERT INTO public.inventory_locations (name, code, description, is_active)
    VALUES ('Bodega Principal', 'MAIN', 'Bodega principal de repuestos', true)
    RETURNING id INTO location_id;
  END IF;

  -- Obtener costo unitario del item si no se proporciona
  IF p_unit_cost IS NULL THEN
    SELECT unit_cost INTO item_unit_cost
    FROM public.inventory_items
    WHERE id = p_inventory_item_id;
  ELSE
    item_unit_cost := p_unit_cost;
  END IF;

  -- Crear movimiento de salida (el trigger se encargará de crear el crane_parts)
  INSERT INTO public.inventory_movements (
    item_id,
    location_id,
    movement_type,
    quantity,
    unit_cost,
    total_cost,
    crane_id,
    operator_id,
    reference_document,
    observations,
    movement_date,
    status,
    created_by
  ) VALUES (
    p_inventory_item_id,
    location_id,
    'exit',
    p_quantity,
    item_unit_cost,
    item_unit_cost * p_quantity,
    p_crane_id,
    p_operator_id,
    p_reference_document,
    p_observations,
    CURRENT_DATE,
    'active',
    auth.uid()
  )
  RETURNING id INTO movement_id;

  RETURN movement_id;
END;
$$;

-- 4. Función para migrar consumos existentes no sincronizados
CREATE OR REPLACE FUNCTION public.migrate_existing_consumption_movements()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  movement_record RECORD;
  migrated_count INTEGER := 0;
  error_count INTEGER := 0;
  errors jsonb := '[]'::jsonb;
  maintenance_category_id UUID;
  new_cost_id UUID;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar migraciones';
  END IF;

  -- Obtener categoría de mantenimiento
  SELECT id INTO maintenance_category_id
  FROM public.cost_categories
  WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%maintenance%'
  LIMIT 1;

  -- Migrar movimientos de salida existentes que no tienen crane_parts
  FOR movement_record IN 
    SELECT im.* 
    FROM public.inventory_movements im
    WHERE im.movement_type = 'exit' 
    AND im.crane_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.crane_parts cp 
      WHERE cp.inventory_movement_id = im.id
    )
    ORDER BY im.created_at
  LOOP
    BEGIN
      -- Crear registro de costo
      INSERT INTO public.costs (
        amount,
        category_id,
        crane_id,
        date,
        description,
        notes,
        subcategory,
        created_by
      ) VALUES (
        COALESCE(movement_record.total_cost, movement_record.unit_cost * movement_record.quantity, 0),
        maintenance_category_id,
        movement_record.crane_id,
        movement_record.movement_date::date,
        'Consumo de inventario: ' || (SELECT name FROM public.inventory_items WHERE id = movement_record.item_id),
        'Consumo migrado desde movimiento existente - ID: ' || movement_record.id,
        'Consumo de Inventario',
        movement_record.created_by
      ) RETURNING id INTO new_cost_id;

      -- Crear registro en crane_parts
      INSERT INTO public.crane_parts (
        crane_id,
        part_name,
        date,
        quantity,
        unit_price,
        total_value,
        supplier,
        notes,
        cost_id,
        inventory_movement_id,
        created_by
      ) VALUES (
        movement_record.crane_id,
        (SELECT name FROM public.inventory_items WHERE id = movement_record.item_id),
        movement_record.movement_date::date,
        -movement_record.quantity,
        COALESCE(movement_record.unit_cost, 0),
        -COALESCE(movement_record.total_cost, movement_record.unit_cost * movement_record.quantity, 0),
        COALESCE(movement_record.supplier_name, 'Inventario interno'),
        'Consumo migrado automáticamente' || 
        CASE WHEN movement_record.observations IS NOT NULL THEN ' - ' || movement_record.observations ELSE '' END,
        new_cost_id,
        movement_record.id,
        movement_record.created_by
      );

      migrated_count := migrated_count + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        errors := errors || jsonb_build_object(
          'movement_id', movement_record.id,
          'item_id', movement_record.item_id,
          'error', SQLERRM
        );
        RAISE WARNING 'Error migrating consumption movement %: %', movement_record.id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'migrated_count', migrated_count,
    'error_count', error_count,
    'errors', errors,
    'message', format('Migración de consumos completada: %s movimientos migrados, %s errores', migrated_count, error_count)
  );
END;
$$;

-- 5. Función para verificar estado de sincronización bidireccional
CREATE OR REPLACE FUNCTION public.check_bidirectional_sync_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  purchase_movements INTEGER;
  consumption_movements INTEGER;
  synced_purchases INTEGER;
  synced_consumptions INTEGER;
  total_crane_parts INTEGER;
  purchase_parts INTEGER;
  consumption_parts INTEGER;
BEGIN
  -- Contar movimientos de compra (entry)
  SELECT COUNT(*) INTO purchase_movements
  FROM public.inventory_movements
  WHERE movement_type = 'entry';

  -- Contar movimientos de consumo (exit con crane_id)
  SELECT COUNT(*) INTO consumption_movements
  FROM public.inventory_movements
  WHERE movement_type = 'exit' AND crane_id IS NOT NULL;

  -- Contar compras sincronizadas
  SELECT COUNT(*) INTO synced_purchases
  FROM public.crane_parts cp
  INNER JOIN public.inventory_movements im ON cp.inventory_movement_id = im.id
  WHERE im.movement_type = 'entry' AND cp.quantity > 0;

  -- Contar consumos sincronizados
  SELECT COUNT(*) INTO synced_consumptions
  FROM public.crane_parts cp
  INNER JOIN public.inventory_movements im ON cp.inventory_movement_id = im.id
  WHERE im.movement_type = 'exit' AND cp.quantity < 0;

  -- Contar piezas totales
  SELECT COUNT(*) INTO total_crane_parts FROM public.crane_parts;

  -- Contar piezas de compra vs consumo
  SELECT COUNT(*) INTO purchase_parts FROM public.crane_parts WHERE quantity > 0;
  SELECT COUNT(*) INTO consumption_parts FROM public.crane_parts WHERE quantity < 0;

  RETURN jsonb_build_object(
    'purchase_movements', purchase_movements,
    'consumption_movements', consumption_movements,
    'synced_purchases', synced_purchases,
    'synced_consumptions', synced_consumptions,
    'total_crane_parts', total_crane_parts,
    'purchase_parts', purchase_parts,
    'consumption_parts', consumption_parts,
    'purchase_sync_rate', CASE WHEN purchase_movements > 0 THEN ROUND((synced_purchases::decimal / purchase_movements::decimal) * 100, 2) ELSE 0 END,
    'consumption_sync_rate', CASE WHEN consumption_movements > 0 THEN ROUND((synced_consumptions::decimal / consumption_movements::decimal) * 100, 2) ELSE 0 END,
    'bidirectional_complete', (synced_purchases + synced_consumptions) = (purchase_movements + consumption_movements)
  );
END;
$$;