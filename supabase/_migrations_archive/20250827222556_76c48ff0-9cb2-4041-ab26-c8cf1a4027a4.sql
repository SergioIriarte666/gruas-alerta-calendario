-- FASE 1: LIMPIAR REGISTROS DUPLICADOS EXISTENTES

-- A. Eliminar costos genéricos "Pagos a Proveedores" cuando existe uno específico "Mantenimiento"
DELETE FROM public.costs WHERE id IN (
  SELECT c1.id FROM public.costs c1
  JOIN public.cost_categories cc1 ON c1.category_id = cc1.id
  WHERE cc1.name ILIKE '%pago%proveedor%'
    AND c1.supplier_payment_id IN (
      SELECT c2.supplier_payment_id FROM public.costs c2
      JOIN public.cost_categories cc2 ON c2.category_id = cc2.id
      WHERE cc2.name = 'Mantenimiento'
        AND c2.supplier_payment_id IS NOT NULL
    )
);

-- B. Eliminar movimientos de inventario duplicados automáticos cuando existe uno manual
DELETE FROM public.inventory_movements WHERE id IN (
  SELECT im1.id FROM public.inventory_movements im1
  WHERE im1.movement_type = 'entry'
    AND im1.reason IS NULL
    AND EXISTS (
      SELECT 1 FROM public.inventory_movements im2
      WHERE im2.item_id = im1.item_id
        AND im2.movement_date::date = im1.movement_date::date
        AND im2.unit_cost = im1.unit_cost
        AND im2.movement_type = 'entry'
        AND im2.reason IS NOT NULL
        AND im2.id != im1.id
    )
);

-- FASE 2: PREVENIR DUPLICIDAD FUTURA

-- A. Eliminar trigger duplicado de creación de costos
DROP TRIGGER IF EXISTS trigger_create_cost_for_crane_part ON public.crane_parts;

-- B. Modificar función de sincronización de inventario para prevenir duplicados
CREATE OR REPLACE FUNCTION public.sync_parts_purchase_to_inventory()
RETURNS TRIGGER AS $$
DECLARE
  inventory_item_id UUID;
  location_id UUID;
  existing_movement_count INTEGER;
BEGIN
  -- Solo procesar para inserciones de crane_parts con cantidad positiva
  IF TG_OP = 'INSERT' AND NEW.quantity > 0 THEN
    
    -- Si ya tiene inventory_movement_id, no crear movimiento automático
    IF NEW.inventory_movement_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
    -- Si las notas indican que viene del frontend unificado, no crear automático
    IF NEW.notes LIKE '%frontend-unified%' OR NEW.notes LIKE '%Compra unificada%' THEN
      RETURN NEW;
    END IF;
    
    -- Verificar si ya existe un movimiento para esta pieza en la misma fecha
    SELECT COUNT(*) INTO existing_movement_count
    FROM public.inventory_movements im
    JOIN public.inventory_items ii ON im.item_id = ii.id
    WHERE LOWER(TRIM(ii.name)) = LOWER(TRIM(NEW.part_name))
      AND im.movement_date::date = NEW.date
      AND im.movement_type = 'entry';
    
    -- Si ya existe, no crear otro
    IF existing_movement_count > 0 THEN
      RETURN NEW;
    END IF;
    
    -- Buscar o crear item de inventario
    SELECT id INTO inventory_item_id
    FROM public.inventory_items
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(NEW.part_name))
    LIMIT 1;
    
    IF inventory_item_id IS NULL THEN
      INSERT INTO public.inventory_items (
        name, 
        description, 
        unit_of_measure, 
        unit_cost,
        created_by
      ) VALUES (
        NEW.part_name,
        'Creado automáticamente desde crane_parts',
        'unidad',
        NEW.unit_price,
        NEW.created_by
      ) RETURNING id INTO inventory_item_id;
    END IF;
    
    -- Obtener ubicación por defecto
    SELECT id INTO location_id
    FROM public.inventory_locations
    WHERE is_active = true
    ORDER BY created_at
    LIMIT 1;
    
    -- Si no hay ubicación, crear una por defecto
    IF location_id IS NULL THEN
      INSERT INTO public.inventory_locations (
        name, 
        code, 
        description,
        created_by
      ) VALUES (
        'Almacén Principal',
        'ALM-001',
        'Ubicación principal para inventario',
        NEW.created_by
      ) RETURNING id INTO location_id;
    END IF;
    
    -- Crear movimiento de inventario solo si no existe
    INSERT INTO public.inventory_movements (
      item_id,
      location_id,
      movement_type,
      quantity,
      unit_cost,
      total_cost,
      movement_date,
      supplier_name,
      reason,
      observations,
      created_by
    ) VALUES (
      inventory_item_id,
      location_id,
      'entry',
      NEW.quantity,
      NEW.unit_price,
      NEW.total_value,
      NEW.date::timestamp,
      NEW.supplier,
      'Migración automática desde crane_parts',
      'Movimiento creado automáticamente para pieza: ' || NEW.part_name,
      NEW.created_by
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. Recrear trigger con la función modificada
DROP TRIGGER IF EXISTS sync_parts_purchase_to_inventory_trigger ON public.crane_parts;
CREATE TRIGGER sync_parts_purchase_to_inventory_trigger
  AFTER INSERT ON public.crane_parts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_parts_purchase_to_inventory();