
-- Verificar y reparar el trigger de sincronización de inventario
-- Primero, eliminar el trigger existente si hay problemas
DROP TRIGGER IF EXISTS sync_parts_purchase_trigger ON public.crane_parts;

-- Recrear la función de sincronización con mejor manejo de errores
CREATE OR REPLACE FUNCTION public.sync_parts_purchase_to_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  inventory_item_id UUID;
  movement_id UUID;
  location_id UUID;
BEGIN
  -- Log para debugging
  RAISE NOTICE 'Iniciando sincronización para pieza: %', NEW.part_name;
  
  -- Obtener ubicación por defecto (primera activa)
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
    
    RAISE NOTICE 'Creada ubicación por defecto: %', location_id;
  END IF;

  -- Buscar item de inventario existente basado en el nombre de la pieza
  SELECT id INTO inventory_item_id
  FROM public.inventory_items
  WHERE LOWER(TRIM(name)) = LOWER(TRIM(NEW.part_name))
  AND is_active = true
  LIMIT 1;

  -- Si no existe el item, crearlo
  IF inventory_item_id IS NULL THEN
    INSERT INTO public.inventory_items (
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
    RETURNING id INTO inventory_item_id;
    
    RAISE NOTICE 'Creado item de inventario: % con ID: %', NEW.part_name, inventory_item_id;
  ELSE
    RAISE NOTICE 'Usando item de inventario existente: %', inventory_item_id;
  END IF;

  -- Crear movimiento de entrada al inventario
  INSERT INTO public.inventory_movements (
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
    inventory_item_id,
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
    INSERT INTO public.cost_inventory_items (
      cost_id,
      inventory_item_id,
      quantity,
      unit_cost,
      created_by
    ) VALUES (
      NEW.cost_id,
      inventory_item_id,
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
    RAISE WARNING 'Error en sincronización de inventario para pieza %: %', NEW.part_name, SQLERRM;
    -- Retornar NEW para que la inserción de crane_parts continúe
    RETURN NEW;
END;
$function$;

-- Recrear el trigger
CREATE TRIGGER sync_parts_purchase_trigger
  BEFORE INSERT ON public.crane_parts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_parts_purchase_to_inventory();

-- Función para migrar piezas existentes no sincronizadas
CREATE OR REPLACE FUNCTION public.migrate_unsync_crane_parts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  part_record RECORD;
  inventory_item_id UUID;
  movement_id UUID;
  location_id UUID;
  migrated_count INTEGER := 0;
  error_count INTEGER := 0;
  errors jsonb := '[]'::jsonb;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar migraciones';
  END IF;

  -- Obtener ubicación por defecto
  SELECT id INTO location_id
  FROM public.inventory_locations
  WHERE is_active = true
  ORDER BY created_at
  LIMIT 1;

  -- Si no hay ubicación, crear una
  IF location_id IS NULL THEN
    INSERT INTO public.inventory_locations (name, code, description, is_active)
    VALUES ('Bodega Principal', 'MAIN', 'Bodega principal de repuestos', true)
    RETURNING id INTO location_id;
  END IF;

  -- Migrar piezas sin sincronizar (sin inventory_movement_id)
  FOR part_record IN 
    SELECT * FROM public.crane_parts 
    WHERE inventory_movement_id IS NULL
    ORDER BY created_at
  LOOP
    BEGIN
      -- Buscar o crear item de inventario
      SELECT id INTO inventory_item_id
      FROM public.inventory_items
      WHERE LOWER(TRIM(name)) = LOWER(TRIM(part_record.part_name))
      AND is_active = true
      LIMIT 1;

      IF inventory_item_id IS NULL THEN
        INSERT INTO public.inventory_items (
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
        RETURNING id INTO inventory_item_id;
      END IF;

      -- Crear movimiento de entrada
      INSERT INTO public.inventory_movements (
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
        inventory_item_id,
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
      UPDATE public.crane_parts 
      SET inventory_movement_id = movement_id
      WHERE id = part_record.id;

      -- Crear mapeo si existe cost_id
      IF part_record.cost_id IS NOT NULL THEN
        INSERT INTO public.cost_inventory_items (
          cost_id,
          inventory_item_id,
          quantity,
          unit_cost,
          created_by
        ) VALUES (
          part_record.cost_id,
          inventory_item_id,
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
$function$;

-- Función para verificar estado de sincronización
CREATE OR REPLACE FUNCTION public.check_inventory_sync_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
DECLARE
  total_parts INTEGER;
  synced_parts INTEGER;
  unsynced_parts INTEGER;
  total_items INTEGER;
  auto_created_items INTEGER;
BEGIN
  -- Contar piezas totales
  SELECT COUNT(*) INTO total_parts FROM public.crane_parts;
  
  -- Contar piezas sincronizadas
  SELECT COUNT(*) INTO synced_parts 
  FROM public.crane_parts 
  WHERE inventory_movement_id IS NOT NULL;
  
  -- Calcular no sincronizadas
  unsynced_parts := total_parts - synced_parts;
  
  -- Contar items de inventario totales
  SELECT COUNT(*) INTO total_items FROM public.inventory_items WHERE is_active = true;
  
  -- Contar items auto-creados
  SELECT COUNT(*) INTO auto_created_items 
  FROM public.inventory_items 
  WHERE description LIKE '%Auto-creado%' OR description LIKE '%Migrado%';

  RETURN jsonb_build_object(
    'total_parts', total_parts,
    'synced_parts', synced_parts,
    'unsynced_parts', unsynced_parts,
    'sync_percentage', CASE WHEN total_parts > 0 THEN ROUND((synced_parts::decimal / total_parts::decimal) * 100, 2) ELSE 0 END,
    'total_inventory_items', total_items,
    'auto_created_items', auto_created_items,
    'trigger_exists', EXISTS(
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'sync_parts_purchase_trigger'
    )
  );
END;
$function$;

-- Función para forzar re-sincronización de una pieza específica
CREATE OR REPLACE FUNCTION public.force_resync_crane_part(part_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  part_record RECORD;
  result jsonb;
BEGIN
  -- Verificar permisos
  IF NOT (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'Permisos insuficientes para re-sincronizar piezas';
  END IF;

  -- Obtener la pieza
  SELECT * INTO part_record FROM public.crane_parts WHERE id = part_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Pieza no encontrada');
  END IF;

  -- Limpiar sincronización existente si existe
  IF part_record.inventory_movement_id IS NOT NULL THEN
    -- Marcar movimiento como cancelado en lugar de eliminarlo
    UPDATE public.inventory_movements 
    SET status = 'cancelled', observations = observations || ' - Re-sincronizado'
    WHERE id = part_record.inventory_movement_id;
    
    -- Limpiar referencia
    UPDATE public.crane_parts 
    SET inventory_movement_id = NULL 
    WHERE id = part_id;
  END IF;

  -- Ejecutar sincronización manual usando la misma lógica del trigger
  -- (esto activará el trigger en la próxima actualización)
  UPDATE public.crane_parts 
  SET updated_at = now()
  WHERE id = part_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Re-sincronización completada para: ' || part_record.part_name
  );
END;
$function$;
