
-- Corregir la función migrate_unsync_crane_parts para eliminar referencias ambiguas de columnas
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
      SELECT ii.id INTO inventory_item_id
      FROM public.inventory_items ii
      WHERE LOWER(TRIM(ii.name)) = LOWER(TRIM(part_record.part_name))
      AND ii.is_active = true
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
      
      RAISE NOTICE 'Migrated part: % with inventory_item_id: %', part_record.part_name, inventory_item_id;
      
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
$function$;

-- También corregir la función get_parts_traceability para evitar ambigüedades similares
CREATE OR REPLACE FUNCTION public.get_parts_traceability(p_crane_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(part_id uuid, part_name text, supplier text, purchase_date date, purchase_cost numeric, inventory_item_id uuid, inventory_item_name text, current_stock integer, total_purchased integer, total_consumed integer, crane_license_plate text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
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
$function$;
