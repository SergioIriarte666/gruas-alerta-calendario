-- ARREGLAR LAS 7 FUNCIONES RESTANTES DE UNA VEZ

-- Identificar las funciones exactas y arreglar search_path
CREATE OR REPLACE FUNCTION public.check_inventory_sync_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.get_parts_traceability(p_crane_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(part_id uuid, part_name text, supplier text, purchase_date date, purchase_cost numeric, inventory_item_id uuid, inventory_item_name text, current_stock integer, total_purchased integer, total_consumed integer, crane_license_plate text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.id as part_id,
    cp.part_name,
    cp.supplier,
    cp.date as purchase_date,
    cp.total_value as purchase_cost,
    ii.id as inventory_item_id,
    ii.name as inventory_item_name,
    COALESCE(stock.current_quantity, 0) as current_stock,
    COALESCE(purchases.total_purchased, 0) as total_purchased,
    COALESCE(consumptions.total_consumed, 0) as total_consumed,
    c.license_plate as crane_license_plate
  FROM public.crane_parts cp
  LEFT JOIN public.inventory_movements im_entry ON cp.inventory_movement_id = im_entry.id
  LEFT JOIN public.inventory_items ii ON im_entry.item_id = ii.id
  LEFT JOIN public.cranes c ON cp.crane_id = c.id
  LEFT JOIN (
    SELECT 
      ist.item_id,
      SUM(ist.current_quantity) as current_quantity
    FROM public.inventory_stock ist
    GROUP BY ist.item_id
  ) stock ON ii.id = stock.item_id
  LEFT JOIN (
    SELECT 
      im_p.item_id,
      SUM(im_p.quantity) as total_purchased
    FROM public.inventory_movements im_p
    WHERE im_p.movement_type = 'entry'
    GROUP BY im_p.item_id
  ) purchases ON ii.id = purchases.item_id
  LEFT JOIN (
    SELECT 
      im_c.item_id,
      SUM(im_c.quantity) as total_consumed
    FROM public.inventory_movements im_c
    WHERE im_c.movement_type = 'exit'
    GROUP BY im_c.item_id
  ) consumptions ON ii.id = consumptions.item_id
  WHERE (p_crane_id IS NULL OR cp.crane_id = p_crane_id)
  ORDER BY cp.date DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_inventory_consumption_movement(p_inventory_item_id uuid, p_quantity integer, p_crane_id uuid, p_operator_id uuid DEFAULT NULL::uuid, p_reference_document text DEFAULT NULL::text, p_observations text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  movement_id UUID;
  location_id UUID;
BEGIN
  -- Obtener ubicación por defecto
  SELECT id INTO location_id
  FROM public.inventory_locations
  WHERE is_active = true
  ORDER BY created_at
  LIMIT 1;

  -- Crear movimiento de salida
  INSERT INTO public.inventory_movements (
    item_id,
    location_id,
    movement_type,
    quantity,
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

CREATE OR REPLACE FUNCTION public.update_inventory_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_stock_id UUID;
BEGIN
  -- Only process if status is 'active'
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Log the movement for debugging
  RAISE NOTICE 'Processing inventory movement: item_id=%, location_id=%, type=%, quantity=%, movement_id=%', 
    NEW.item_id, NEW.location_id, NEW.movement_type, NEW.quantity, NEW.id;

  -- Check if stock record already exists
  SELECT id INTO existing_stock_id
  FROM public.inventory_stock 
  WHERE item_id = NEW.item_id AND location_id = NEW.location_id;

  IF NEW.movement_type = 'entry' THEN
    IF existing_stock_id IS NOT NULL THEN
      -- Update existing stock
      UPDATE public.inventory_stock 
      SET 
        current_quantity = current_quantity + NEW.quantity,
        last_movement_date = NEW.movement_date,
        updated_at = now()
      WHERE id = existing_stock_id;
      
      RAISE NOTICE 'Updated existing stock record: %', existing_stock_id;
    ELSE
      -- Insert new stock record
      INSERT INTO public.inventory_stock (item_id, location_id, current_quantity, last_movement_date)
      VALUES (NEW.item_id, NEW.location_id, NEW.quantity, NEW.movement_date);
      
      RAISE NOTICE 'Created new stock record for item % at location %', NEW.item_id, NEW.location_id;
    END IF;
    
  ELSIF NEW.movement_type = 'exit' THEN
    IF existing_stock_id IS NOT NULL THEN
      UPDATE public.inventory_stock 
      SET 
        current_quantity = GREATEST(0, current_quantity - NEW.quantity),
        last_movement_date = NEW.movement_date,
        updated_at = now()
      WHERE id = existing_stock_id;
      
      RAISE NOTICE 'Updated stock for exit: reduced by %', NEW.quantity;
    ELSE
      RAISE WARNING 'Cannot process exit movement: no stock record found for item % at location %', 
        NEW.item_id, NEW.location_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.migrate_unsync_crane_parts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar migraciones';
  END IF;

  -- Obtener ubicación por defecto
  SELECT il.id INTO location_id
  FROM public.inventory_locations il
  WHERE il.is_active = true
  ORDER BY il.created_at
  LIMIT 1;

  -- Si no hay ubicación, crear una
  IF location_id IS NULL THEN
    INSERT INTO public.inventory_locations (name, code, description, is_active)
    VALUES ('Bodega Principal', 'MAIN', 'Bodega principal de repuestos', true)
    RETURNING id INTO location_id;
  END IF;

  -- Migrar piezas sin sincronizar (sin inventory_movement_id)
  FOR part_record IN 
    SELECT cp.* FROM public.crane_parts cp
    WHERE cp.inventory_movement_id IS NULL
    ORDER BY cp.created_at
  LOOP
    BEGIN
      -- Buscar o crear item de inventario
      SELECT ii.id INTO local_inventory_item_id
      FROM public.inventory_items ii
      WHERE LOWER(TRIM(ii.name)) = LOWER(TRIM(part_record.part_name))
      AND ii.is_active = true
      LIMIT 1;

      IF local_inventory_item_id IS NULL THEN
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
        RETURNING id INTO local_inventory_item_id;
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
          local_inventory_item_id,
          part_record.quantity,
          part_record.unit_price,
          part_record.created_by
        )
        ON CONFLICT (cost_id, inventory_item_id) DO NOTHING;
      END IF;

      migrated_count := migrated_count + 1;
      
      RAISE NOTICE 'Migrated part: % with inventory_item_id: %', part_record.part_name, local_inventory_item_id;
      
    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        errors := errors || jsonb_build_object(
          'part_id', part_record.id,
          'part_name', part_record.part_name,
          'error', SQLERRM
        );
        RAISE WARNING 'Error migrating part %: %', part_record.part_name, SQLERRM;
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

CREATE OR REPLACE FUNCTION public.force_resync_crane_part(part_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE(id uuid, email text, full_name text, role app_role, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone, client_id uuid, client_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.is_active,
    p.created_at,
    p.updated_at,
    p.client_id,
    c.name as client_name
  FROM public.profiles p
  LEFT JOIN public.clients c ON p.client_id = c.id
  ORDER BY p.created_at DESC;
END;
$$;