-- Corregir trigger para no insertar en columna generada total_value
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
BEGIN
  -- Solo procesar movimientos de salida con crane_id
  IF NEW.movement_type = 'exit' AND NEW.crane_id IS NOT NULL THEN
    
    -- Calcular el costo (debe ser positivo para costs)
    cost_amount := COALESCE(NEW.total_cost, NEW.unit_cost * NEW.quantity, 0);
    
    -- Si el costo es 0 o negativo, usar un valor mínimo para cumplir constraint
    IF cost_amount <= 0 THEN
      cost_amount := 0.01; -- Valor mínimo para cumplir constraint amount > 0
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
      'Consumo de inventario: ' || (SELECT name FROM public.inventory_items WHERE id = NEW.item_id),
      'Consumo automático registrado desde inventario - Referencia: ' || COALESCE(NEW.reference_document, 'N/A') ||
      ' - Cantidad: ' || NEW.quantity || ' unidades',
      'Consumo de Inventario',
      COALESCE(NEW.created_by, auth.uid())
    ) RETURNING id INTO new_cost_id;

    -- Crear registro en crane_parts con cantidad negativa (consumo)
    -- NOTA: total_value se calculará automáticamente como quantity * unit_price
    INSERT INTO public.crane_parts (
      crane_id,
      part_name,
      date,
      quantity,
      unit_price,
      -- NO incluir total_value ya que es una columna generada automáticamente
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
      -- total_value se calculará automáticamente como (-quantity) * unit_cost
      COALESCE(NEW.supplier_name, 'Inventario interno'),
      'Consumo registrado automáticamente desde inventario' || 
      CASE WHEN NEW.observations IS NOT NULL THEN ' - ' || NEW.observations ELSE '' END,
      new_cost_id,
      NEW.id,
      COALESCE(NEW.created_by, auth.uid())
    );

    RAISE NOTICE 'Creado registro de consumo en crane_parts para item: %, crane: %, cantidad: %, costo: %', 
      (SELECT name FROM public.inventory_items WHERE id = NEW.item_id), NEW.crane_id, NEW.quantity, cost_amount;
  END IF;

  RETURN NEW;
END;
$$;