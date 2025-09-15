-- ===================================
-- SOLUCIÓN GLOBAL DEFINITIVA PARA DUPLICADOS DE INVENTARIO
-- ===================================

-- 1. ELIMINAR TODOS LOS COSTOS DUPLICADOS DE $0.01 DE "CONSUMO DE INVENTARIO"
DELETE FROM public.costs 
WHERE id IN (
  SELECT c.id 
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name = 'Mantenimiento'
    AND c.subcategory = 'Consumo de Inventario'
    AND c.amount = 0.01
    AND (c.description ILIKE '%materiales%eléctricos%' OR c.description ILIKE '%materiales%electricos%')
);

-- 2. ACTUALIZAR CRANE_PARTS QUE TENÍAN COST_ID VINCULADO A LOS COSTOS ELIMINADOS
UPDATE public.crane_parts 
SET 
  cost_id = NULL,
  notes = COALESCE(notes, '') || ' [Cost duplicado eliminado - limpieza global]'
WHERE cost_id IN (
  SELECT c.id 
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name = 'Mantenimiento'
    AND c.subcategory = 'Consumo de Inventario'
    AND c.amount = 0.01
) AND cost_id IS NOT NULL;

-- 3. CREAR FUNCIÓN GLOBAL DE LIMPIEZA DEFINITIVA
CREATE OR REPLACE FUNCTION public.global_inventory_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_costs INTEGER := 0;
  updated_parts INTEGER := 0;
  materiales_cost NUMERIC;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar la limpieza global';
  END IF;

  -- PASO 1: Eliminar TODOS los costos de $0.01 de "Consumo de Inventario"
  DELETE FROM public.costs 
  WHERE id IN (
    SELECT c.id 
    FROM public.costs c
    JOIN public.cost_categories cc ON c.category_id = cc.id
    WHERE cc.name = 'Mantenimiento'
      AND c.subcategory = 'Consumo de Inventario'
      AND c.amount = 0.01
  );
  
  GET DIAGNOSTICS deleted_costs = ROW_COUNT;

  -- PASO 2: Actualizar crane_parts huérfanos (cost_id que ya no existe)
  UPDATE public.crane_parts 
  SET 
    cost_id = NULL,
    notes = COALESCE(notes, '') || ' [Desvinculado - limpieza global]'
  WHERE cost_id IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM public.costs WHERE id = crane_parts.cost_id);
    
  GET DIAGNOSTICS updated_parts = ROW_COUNT;

  -- PASO 3: Verificar y corregir unit_cost de "Materiales Eléctricos"
  SELECT unit_cost INTO materiales_cost
  FROM public.inventory_items 
  WHERE LOWER(name) LIKE '%materiales%eléctricos%' 
     OR LOWER(name) LIKE '%materiales%electricos%'
  LIMIT 1;

  -- Si el costo es 0 o nulo, corregirlo
  IF materiales_cost IS NULL OR materiales_cost = 0 THEN
    UPDATE public.inventory_items
    SET 
      unit_cost = 19960.00,
      updated_at = NOW()
    WHERE LOWER(name) LIKE '%materiales%eléctricos%' 
       OR LOWER(name) LIKE '%materiales%electricos%';
       
    materiales_cost := 19960.00;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'timestamp', NOW(),
    'deleted_costs', deleted_costs,
    'updated_crane_parts', updated_parts,
    'materiales_unit_cost', materiales_cost,
    'message', format('Limpieza global completada: eliminados %s costos duplicados, actualizados %s crane_parts', deleted_costs, updated_parts)
  );
END;
$$;

-- 4. MODIFICAR EL TRIGGER PARA PREVENIR DUPLICADOS FUTUROS
CREATE OR REPLACE FUNCTION public.sync_inventory_exit_to_crane_parts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item_name TEXT;
  item_unit_cost NUMERIC;
  final_unit_cost NUMERIC;
  safe_quantity INTEGER;
  existing_manual_record_count INTEGER;
BEGIN
  -- Solo procesar movimientos de salida con crane_id
  IF NEW.movement_type = 'exit' AND NEW.crane_id IS NOT NULL THEN
    
    -- Obtener nombre y costo del item desde inventory_items
    SELECT name, unit_cost INTO item_name, item_unit_cost
    FROM public.inventory_items 
    WHERE id = NEW.item_id;
    
    -- Verificar si ya existe un registro manual
    SELECT COUNT(*) INTO existing_manual_record_count
    FROM public.crane_parts
    WHERE crane_id = NEW.crane_id
    AND LOWER(TRIM(part_name)) = LOWER(TRIM(COALESCE(item_name, 'Item desconocido')))
    AND date = NEW.movement_date::date
    AND inventory_movement_id IS NULL;
    
    -- Si ya existe un registro manual, no crear automático
    IF existing_manual_record_count > 0 THEN
      RAISE NOTICE 'Ya existe registro manual para % en grúa % fecha %', item_name, NEW.crane_id, NEW.movement_date::date;
      RETURN NEW;
    END IF;
    
    -- CRÍTICO: Solo usar unit_cost si es > 0, sino NO CREAR REGISTRO
    IF item_unit_cost IS NOT NULL AND item_unit_cost > 0 THEN
      final_unit_cost := item_unit_cost;
      RAISE NOTICE 'Usando costo de catálogo: $% para %', final_unit_cost, item_name;
    ELSE
      -- NO CREAR REGISTRO SI NO HAY COSTO VÁLIDO
      RAISE WARNING 'OMITIENDO creación automática: No hay costo válido para %. Unit_cost actual: %', item_name, item_unit_cost;
      RETURN NEW;
    END IF;
    
    -- Asegurar valores válidos
    safe_quantity := COALESCE(ABS(NEW.quantity), 1);
    
    -- SOLO crear registro en crane_parts para trazabilidad (NO EN COSTS)
    INSERT INTO public.crane_parts (
      crane_id,
      part_name,
      date,
      quantity,
      unit_price,
      supplier,
      notes,
      cost_id,           -- NULL - no vincular a cost
      inventory_movement_id,
      created_by
    ) VALUES (
      NEW.crane_id,
      COALESCE(item_name, 'Item desconocido'),
      NEW.movement_date::date,
      -safe_quantity, -- Cantidad negativa para consumo
      final_unit_cost,
      COALESCE(NEW.supplier_name, 'Inventario interno'),
      format('Consumo automático desde inventario. Costo: $%s (catálogo)', final_unit_cost),
      NULL, -- CRÍTICO: NO crear cost asociado
      NEW.id,
      COALESCE(NEW.created_by, auth.uid())
    );
    
    RAISE NOTICE 'Registro de consumo creado para %: $% x % = $%', 
      item_name, final_unit_cost, safe_quantity, (final_unit_cost * safe_quantity);
  END IF;

  RETURN NEW;
END;
$$;