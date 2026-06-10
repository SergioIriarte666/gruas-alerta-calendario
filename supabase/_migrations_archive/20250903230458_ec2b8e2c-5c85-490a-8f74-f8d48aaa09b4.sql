-- ELIMINACIÓN DEFINITIVA DE TRIGGERS DUPLICADOS Y CONFLICTIVOS
-- Solución para la duplicación de registros en supplier_payments -> costs -> crane_parts

-- 1. Eliminar trigger duplicado en crane_parts (mantener solo uno)
DROP TRIGGER IF EXISTS sync_parts_purchase_trigger ON public.crane_parts;

-- 2. Eliminar trigger que crea costos adicionales desde crane_parts 
-- (porque los costos se crean desde supplier_payments, no desde crane_parts)
DROP TRIGGER IF EXISTS crane_parts_create_cost_conditional ON public.crane_parts;

-- 3. Verificar que el trigger principal de supplier_payments funcione correctamente
-- Asegurar que create_cost_from_supplier_payment no cree duplicados
CREATE OR REPLACE FUNCTION public.create_cost_from_supplier_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  payment_category_id UUID;
  cost_description TEXT;
  cost_notes TEXT;
  supplier_name_value TEXT;
  existing_cost_count INTEGER;
BEGIN
  -- Solo procesar cuando el pago cambia a estado "paid"
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    
    -- Verificar si ya existe un costo para este pago (evitar duplicados)
    SELECT COUNT(*) INTO existing_cost_count
    FROM public.costs
    WHERE supplier_payment_id = NEW.id;
    
    -- Si ya existe un costo, no crear otro
    IF existing_cost_count > 0 THEN
      RETURN NEW;
    END IF;
    
    -- Obtener nombre del proveedor de la tabla suppliers si existe supplier_id
    IF NEW.supplier_id IS NOT NULL THEN
      SELECT name INTO supplier_name_value
      FROM public.suppliers 
      WHERE id = NEW.supplier_id;
    END IF;
    
    -- Si no se encontró nombre, usar valor por defecto
    IF supplier_name_value IS NULL THEN
      supplier_name_value := 'Proveedor no especificado';
    END IF;
    
    -- Obtener o crear la categoría "Pagos a Proveedores"
    SELECT id INTO payment_category_id
    FROM public.cost_categories
    WHERE name ILIKE '%pago%proveedor%' OR name ILIKE '%supplier%payment%'
    LIMIT 1;
    
    -- Si no existe la categoría, crearla
    IF payment_category_id IS NULL THEN
      INSERT INTO public.cost_categories (name, description)
      VALUES ('Pagos a Proveedores', 'Pagos realizados a proveedores y facturas de servicios')
      RETURNING id INTO payment_category_id;
    END IF;
    
    -- Construir descripción del costo
    cost_description := 'Pago a proveedor: ' || supplier_name_value;
    IF NEW.reference_number IS NOT NULL THEN
      cost_description := cost_description || ' - Referencia: ' || NEW.reference_number;
    END IF;
    
    -- Construir notas del costo
    cost_notes := 'Pago generado automáticamente desde proveedor.';
    IF NEW.description IS NOT NULL THEN
      cost_notes := cost_notes || ' Descripción: ' || NEW.description;
    END IF;
    IF NEW.notes IS NOT NULL THEN
      cost_notes := cost_notes || ' Notas: ' || NEW.notes;
    END IF;
    
    -- Crear registro en costos solo si no existe uno previo
    INSERT INTO public.costs (
      amount,
      category_id,
      date,
      description,
      notes,
      subcategory,
      supplier_payment_id,
      created_by
    ) VALUES (
      COALESCE(NEW.amount, 0),
      payment_category_id,
      COALESCE(NEW.paid_date, CURRENT_DATE),
      cost_description,
      cost_notes,
      CASE 
        WHEN NEW.category ILIKE '%combustible%' OR NEW.category ILIKE '%gasolina%' OR NEW.category ILIKE '%diesel%' THEN 'Combustible'
        WHEN NEW.category ILIKE '%mantenimiento%' OR NEW.category ILIKE '%reparaci%' OR NEW.category ILIKE '%repuesto%' THEN 'Mantenimiento General'
        WHEN NEW.category ILIKE '%seguro%' OR NEW.category ILIKE '%insurance%' THEN 'Seguros'
        WHEN NEW.category ILIKE '%administrat%' OR NEW.category ILIKE '%oficina%' THEN 'Administrativo'
        ELSE NEW.category
      END,
      NEW.id,
      NEW.created_by
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 4. Mejorar el trigger de sincronización de inventario para evitar duplicados
CREATE OR REPLACE FUNCTION public.sync_parts_purchase_to_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  inventory_item_id UUID;
  location_id UUID;
  existing_movement_count INTEGER;
  item_name TEXT;
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
    
    -- Si las notas indican que se registró desde pago de proveedor, no crear automático
    -- para evitar duplicados con el flujo manual del frontend
    IF NEW.notes LIKE '%Registrado automáticamente desde pago de proveedor%' THEN
      RETURN NEW;
    END IF;
    
    -- Obtener nombre del item
    SELECT name INTO item_name FROM public.inventory_items WHERE id = NEW.inventory_item_id;
    IF item_name IS NULL THEN
      item_name := NEW.part_name;
    END IF;
    
    -- Verificar si ya existe un movimiento para esta pieza en la misma fecha
    SELECT COUNT(*) INTO existing_movement_count
    FROM public.inventory_movements im
    JOIN public.inventory_items ii ON im.item_id = ii.id
    WHERE LOWER(TRIM(ii.name)) = LOWER(TRIM(item_name))
      AND im.movement_date::date = NEW.date
      AND im.movement_type = 'entry';
    
    -- Si ya existe, no crear otro
    IF existing_movement_count > 0 THEN
      RETURN NEW;
    END IF;
    
    -- Buscar o crear item de inventario
    SELECT id INTO inventory_item_id
    FROM public.inventory_items
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(item_name))
    LIMIT 1;
    
    IF inventory_item_id IS NULL THEN
      INSERT INTO public.inventory_items (
        name, 
        description, 
        unit_of_measure, 
        unit_cost,
        created_by
      ) VALUES (
        item_name,
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
      'Compra de piezas para grúa',
      'Movimiento creado automáticamente para pieza: ' || item_name,
      NEW.created_by
    );
    
  END IF;
  
  RETURN NEW;
END;
$function$;