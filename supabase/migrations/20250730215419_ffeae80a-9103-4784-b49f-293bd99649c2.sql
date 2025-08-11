-- Limpiar datos duplicados y corregir trigger para prevenir duplicaciones

-- 1. Identificar y eliminar registros duplicados problemáticos
-- Eliminar registros que tienen inventory_movement_id pero representan compras directas (cantidad positiva)
DELETE FROM public.crane_parts 
WHERE inventory_movement_id IS NOT NULL 
AND quantity > 0 
AND part_name ILIKE '%parachoques%'
AND EXISTS (
  SELECT 1 FROM public.crane_parts cp2 
  WHERE cp2.part_name = crane_parts.part_name 
  AND cp2.date = crane_parts.date 
  AND cp2.quantity > 0 
  AND cp2.inventory_movement_id IS NULL
  AND cp2.id != crane_parts.id
);

-- 2. Corregir el trigger para prevenir duplicados futuros
CREATE OR REPLACE FUNCTION public.sync_inventory_exit_to_crane_parts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  maintenance_category_id UUID;
  new_cost_id UUID;
  cost_amount NUMERIC;
  safe_unit_price NUMERIC;
  existing_manual_record_count INTEGER;
  item_name TEXT;
BEGIN
  -- Solo procesar movimientos de salida con crane_id
  IF NEW.movement_type = 'exit' AND NEW.crane_id IS NOT NULL THEN
    
    -- Obtener nombre del item
    SELECT name INTO item_name FROM public.inventory_items WHERE id = NEW.item_id;
    
    -- Verificar si ya existe un registro manual para la misma pieza y fecha
    SELECT COUNT(*) INTO existing_manual_record_count
    FROM public.crane_parts
    WHERE crane_id = NEW.crane_id
    AND LOWER(TRIM(part_name)) = LOWER(TRIM(item_name))
    AND date = NEW.movement_date::date
    AND inventory_movement_id IS NULL; -- Registro manual (no automático)
    
    -- Si ya existe un registro manual, NO crear automático para evitar duplicados
    IF existing_manual_record_count > 0 THEN
      RAISE NOTICE 'Registro manual ya existe para %, fecha %, grúa %. No se crea automático.', 
        item_name, NEW.movement_date::date, NEW.crane_id;
      RETURN NEW;
    END IF;
    
    -- Calcular el costo (debe ser positivo para costs)
    cost_amount := COALESCE(NEW.total_cost, NEW.unit_cost * NEW.quantity, 0);
    
    -- Si el costo es 0 o negativo, usar un valor mínimo para cumplir constraint
    IF cost_amount <= 0 THEN
      cost_amount := 0.01; -- Valor mínimo para cumplir constraint amount > 0
    END IF;
    
    -- Asegurar que unit_price sea positivo (constraint unit_price > 0)
    safe_unit_price := COALESCE(NEW.unit_cost, 0);
    IF safe_unit_price <= 0 THEN
      safe_unit_price := 0.01; -- Valor mínimo para cumplir constraint unit_price > 0
    END IF;
    
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

    -- Crear registro de costo para el consumo (SIEMPRE POSITIVO)
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
      cost_amount, -- Valor positivo para cumplir constraint
      maintenance_category_id,
      NEW.crane_id,
      NEW.movement_date::date,
      'Consumo de inventario: ' || item_name,
      'Consumo automático registrado desde inventario - Referencia: ' || COALESCE(NEW.reference_document, 'N/A') ||
      ' - Cantidad: ' || NEW.quantity || ' unidades' ||
      CASE WHEN NEW.unit_cost IS NULL OR NEW.unit_cost = 0 THEN ' - Precio unitario no disponible, usado valor mínimo' ELSE '' END,
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
      supplier,
      notes,
      cost_id,
      inventory_movement_id,
      created_by
    ) VALUES (
      NEW.crane_id,
      item_name,
      NEW.movement_date::date,
      -NEW.quantity, -- Cantidad negativa para indicar consumo
      safe_unit_price, -- Precio unitario siempre positivo
      COALESCE(NEW.supplier_name, 'Inventario interno'),
      'Consumo registrado automáticamente desde inventario' || 
      CASE WHEN NEW.observations IS NOT NULL THEN ' - ' || NEW.observations ELSE '' END ||
      CASE WHEN NEW.unit_cost IS NULL OR NEW.unit_cost = 0 THEN ' - Precio unitario ajustado por constraint' ELSE '' END,
      new_cost_id,
      NEW.id,
      COALESCE(NEW.created_by, auth.uid())
    );

    RAISE NOTICE 'Creado registro de consumo automático en crane_parts para item: %, crane: %, cantidad: %, precio: %, costo: %', 
      item_name, NEW.crane_id, NEW.quantity, safe_unit_price, cost_amount;
  END IF;

  RETURN NEW;
END;
$$;