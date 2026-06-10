-- =====================================================
-- SOLUCIÓN COMPLETA PARA PROBLEMAS DE INVENTARIO
-- =====================================================

-- 1. ACTUALIZAR FUNCIÓN sync_inventory_exit_to_crane_parts()
-- Corregir costos y eliminar duplicación de registros
CREATE OR REPLACE FUNCTION public.sync_inventory_exit_to_crane_parts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item_name TEXT;
  item_unit_cost NUMERIC;
  fallback_unit_cost NUMERIC;
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
    
    -- Determinar el costo unitario a usar
    IF item_unit_cost IS NOT NULL AND item_unit_cost > 0 THEN
      final_unit_cost := item_unit_cost;
      RAISE NOTICE 'Usando costo de catálogo: $% para %', final_unit_cost, item_name;
    ELSE
      -- Fallback: buscar promedio de costos históricos de entrada
      SELECT AVG(unit_cost) INTO fallback_unit_cost
      FROM public.inventory_movements 
      WHERE item_id = NEW.item_id 
        AND movement_type IN ('entry', 'purchase')
        AND unit_cost > 0
        AND unit_cost IS NOT NULL;
      
      IF fallback_unit_cost IS NOT NULL AND fallback_unit_cost > 0 THEN
        final_unit_cost := fallback_unit_cost;
        RAISE NOTICE 'Usando costo promedio histórico: $% para %', final_unit_cost, item_name;
      ELSE
        -- Último recurso: usar $0.01 pero generar advertencia
        final_unit_cost := 0.01;
        RAISE WARNING 'ATENCIÓN: No se encontró costo para %. Usando $0.01 como último recurso. Revisar inventory_items.unit_cost', item_name;
      END IF;
    END IF;
    
    -- Asegurar valores válidos
    safe_quantity := COALESCE(ABS(NEW.quantity), 1);
    
    -- IMPORTANTE: NO CREAR REGISTRO EN COSTS
    -- Solo crear registro en crane_parts para trazabilidad
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
      final_unit_cost, -- Usar el costo real calculado
      COALESCE(NEW.supplier_name, 'Inventario interno'),
      format('Consumo automático desde inventario. Costo: $%s (fuente: %s)', 
        final_unit_cost, 
        CASE 
          WHEN item_unit_cost IS NOT NULL AND item_unit_cost > 0 THEN 'catálogo'
          WHEN fallback_unit_cost IS NOT NULL AND fallback_unit_cost > 0 THEN 'promedio histórico'
          ELSE 'valor por defecto'
        END
      ),
      NULL, -- No crear cost asociado
      NEW.id,
      COALESCE(NEW.created_by, auth.uid())
    );
    
    RAISE NOTICE 'Registro de consumo creado para %: $% x % = $%', 
      item_name, final_unit_cost, safe_quantity, (final_unit_cost * safe_quantity);
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. FUNCIÓN PARA LIMPIAR DATOS HISTÓRICOS
-- Eliminar costos duplicados de "Consumo de Inventario"
CREATE OR REPLACE FUNCTION public.cleanup_duplicate_inventory_costs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  duplicate_costs_count INTEGER := 0;
  cleaned_costs_count INTEGER := 0;
  cost_record RECORD;
  maintenance_category_id UUID;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar la limpieza de duplicados';
  END IF;

  -- Obtener ID de categoría de mantenimiento
  SELECT id INTO maintenance_category_id
  FROM public.cost_categories
  WHERE name ILIKE '%mantenimiento%' 
  LIMIT 1;

  -- Contar costos de "Consumo de Inventario" con valores sospechosos
  SELECT COUNT(*) INTO duplicate_costs_count
  FROM public.costs c
  WHERE c.category_id = maintenance_category_id
    AND c.subcategory = 'Consumo de Inventario'
    AND (c.amount = 0.01 OR c.description ILIKE '%consumo de inventario%');

  RAISE NOTICE 'Encontrados % costos duplicados de consumo de inventario', duplicate_costs_count;

  -- Eliminar costos duplicados y actualizar crane_parts asociados
  FOR cost_record IN 
    SELECT c.*, cp.id as crane_part_id
    FROM public.costs c
    LEFT JOIN public.crane_parts cp ON c.id = cp.cost_id
    WHERE c.category_id = maintenance_category_id
      AND c.subcategory = 'Consumo de Inventario'
      AND (c.amount = 0.01 OR c.description ILIKE '%consumo de inventario%')
  LOOP
    -- Desvincular crane_parts del cost que se va a eliminar
    IF cost_record.crane_part_id IS NOT NULL THEN
      UPDATE public.crane_parts 
      SET cost_id = NULL,
          notes = COALESCE(notes, '') || ' [Cost duplicado eliminado automáticamente]'
      WHERE id = cost_record.crane_part_id;
    END IF;
    
    -- Eliminar el cost duplicado
    DELETE FROM public.costs WHERE id = cost_record.id;
    cleaned_costs_count := cleaned_costs_count + 1;
    
    RAISE NOTICE 'Eliminado cost duplicado: % ($%)', cost_record.description, cost_record.amount;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_duplicates_found', duplicate_costs_count,
    'costs_cleaned', cleaned_costs_count,
    'message', format('Limpieza completada: eliminados %s costos duplicados de consumo de inventario', cleaned_costs_count)
  );
END;
$function$;

-- 3. FUNCIÓN PARA RECALCULAR COSTOS EN CRANE_PARTS EXISTENTES
CREATE OR REPLACE FUNCTION public.recalculate_crane_parts_costs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated_parts_count INTEGER := 0;
  part_record RECORD;
  item_unit_cost NUMERIC;
  fallback_unit_cost NUMERIC;
  final_unit_cost NUMERIC;
  item_name TEXT;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden recalcular costos de crane_parts';
  END IF;

  -- Recalcular costos para crane_parts con inventory_movement_id
  FOR part_record IN 
    SELECT cp.*, im.item_id
    FROM public.crane_parts cp
    JOIN public.inventory_movements im ON cp.inventory_movement_id = im.id
    WHERE cp.unit_price <= 0.01  -- Solo los que tienen costos incorrectos
      AND im.movement_type = 'exit'
  LOOP
    -- Obtener costo real del item
    SELECT unit_cost, name INTO item_unit_cost, item_name
    FROM public.inventory_items 
    WHERE id = part_record.item_id;
    
    -- Determinar el costo a usar
    IF item_unit_cost IS NOT NULL AND item_unit_cost > 0 THEN
      final_unit_cost := item_unit_cost;
    ELSE
      -- Fallback: promedio histórico
      SELECT AVG(unit_cost) INTO fallback_unit_cost
      FROM public.inventory_movements 
      WHERE item_id = part_record.item_id 
        AND movement_type IN ('entry', 'purchase')
        AND unit_cost > 0;
      
      final_unit_cost := COALESCE(fallback_unit_cost, part_record.unit_price);
    END IF;

    -- Actualizar crane_parts con el costo correcto
    UPDATE public.crane_parts
    SET 
      unit_price = final_unit_cost,
      total_value = final_unit_cost * ABS(quantity),
      notes = COALESCE(notes, '') || format(' [Costo recalculado: $%s -> $%s]', part_record.unit_price, final_unit_cost),
      updated_at = NOW()
    WHERE id = part_record.id;
    
    updated_parts_count := updated_parts_count + 1;
    
    RAISE NOTICE 'Actualizado crane_part %: % de $% a $%', 
      part_record.id, part_record.part_name, part_record.unit_price, final_unit_cost;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_parts', updated_parts_count,
    'message', format('Recalculados costos de %s registros en crane_parts', updated_parts_count)
  );
END;
$function$;

-- 4. FUNCIÓN PARA EJECUTAR LIMPIEZA COMPLETA
CREATE OR REPLACE FUNCTION public.fix_inventory_cost_issues()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cleanup_result jsonb;
  recalc_result jsonb;
  final_result jsonb;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar la corrección completa';
  END IF;

  RAISE NOTICE 'Iniciando corrección completa de problemas de inventario...';

  -- Paso 1: Limpiar costos duplicados
  SELECT public.cleanup_duplicate_inventory_costs() INTO cleanup_result;
  
  -- Paso 2: Recalcular costos en crane_parts
  SELECT public.recalculate_crane_parts_costs() INTO recalc_result;

  -- Compilar resultado final
  final_result := jsonb_build_object(
    'success', true,
    'timestamp', NOW(),
    'cleanup_phase', cleanup_result,
    'recalculation_phase', recalc_result,
    'message', 'Corrección completa de problemas de inventario ejecutada exitosamente'
  );

  RAISE NOTICE 'Corrección completa finalizada exitosamente';
  RETURN final_result;
END;
$function$;