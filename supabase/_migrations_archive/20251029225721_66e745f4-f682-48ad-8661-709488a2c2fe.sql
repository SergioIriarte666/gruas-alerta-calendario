-- Fix the create_cost_from_supplier_payment function to properly handle category_id

CREATE OR REPLACE FUNCTION public.create_cost_from_supplier_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_cost_category_id UUID;
  v_new_cost_id UUID;
  v_inventory_item_id UUID;
  v_location_id UUID;
  v_category_uuid UUID;
  v_supplier_category_name TEXT;
BEGIN
  -- Solo procesar pagos completados
  IF NEW.status != 'paid' THEN
    RETURN NEW;
  END IF;

  -- Verificar si ya existe un costo para este pago
  IF EXISTS (SELECT 1 FROM public.costs WHERE supplier_payment_id = NEW.id) THEN
    RAISE NOTICE '⚠️ Ya existe un costo para el pago %', NEW.id;
    RETURN NEW;
  END IF;

  -- Obtener el nombre de la categoría del proveedor si es un UUID
  BEGIN
    v_category_uuid := NEW.category::UUID;
    SELECT name INTO v_supplier_category_name
    FROM public.supplier_categories
    WHERE id = v_category_uuid;
  EXCEPTION WHEN OTHERS THEN
    v_supplier_category_name := NEW.category;
  END;

  -- Buscar categoría de costos adecuada
  -- 1. Si la categoría del supplier es "mantenimiento" o "inventario", buscar "Mantenimiento"
  IF v_supplier_category_name ILIKE '%mantenimiento%' OR v_supplier_category_name ILIKE '%inventario%' OR v_supplier_category_name ILIKE '%pieza%' OR v_supplier_category_name ILIKE '%repuesto%' THEN
    SELECT id INTO v_cost_category_id
    FROM public.cost_categories
    WHERE name ILIKE '%mantenimiento%'
    LIMIT 1;
  END IF;

  -- 2. Si no se encontró, buscar categoría "Administrativos" o similar
  IF v_cost_category_id IS NULL THEN
    SELECT id INTO v_cost_category_id
    FROM public.cost_categories
    WHERE name ILIKE '%administrativo%' OR name ILIKE '%general%' OR name ILIKE '%operacion%'
    LIMIT 1;
  END IF;

  -- 3. Si aún no hay categoría, usar la primera disponible
  IF v_cost_category_id IS NULL THEN
    SELECT id INTO v_cost_category_id
    FROM public.cost_categories
    WHERE id IS NOT NULL
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- 4. Si NO hay ninguna categoría de costos, no crear el cost
  IF v_cost_category_id IS NULL THEN
    RAISE WARNING 'No se puede crear cost: no existe ninguna categoría en cost_categories';
    RETURN NEW;
  END IF;

  -- Crear el costo
  INSERT INTO public.costs (
    description,
    amount,
    date,
    category_id,
    supplier_payment_id,
    supplier_id,
    notes,
    created_by
  )
  VALUES (
    NEW.description,
    NEW.amount,
    NEW.due_date,
    v_cost_category_id,
    NEW.id,
    NEW.supplier_id,
    COALESCE(NEW.notes, 'Generado automáticamente desde pago a proveedor'),
    NEW.created_by
  )
  RETURNING id INTO v_new_cost_id;

  -- Crear movimiento de inventario si tiene datos de producto y add_to_inventory es true
  IF NEW.add_to_inventory = true AND NEW.part_name IS NOT NULL AND NEW.part_quantity > 0 AND NEW.part_unit_price > 0 THEN
    
    -- Buscar o crear item de inventario
    SELECT id INTO v_inventory_item_id
    FROM public.inventory_items
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(NEW.part_name))
    LIMIT 1;

    IF v_inventory_item_id IS NULL THEN
      INSERT INTO public.inventory_items (name, unit_of_measure, unit_cost, created_by)
      VALUES (NEW.part_name, 'unidad', NEW.part_unit_price, NEW.created_by)
      RETURNING id INTO v_inventory_item_id;
    END IF;

    -- Obtener ubicación principal
    SELECT id INTO v_location_id
    FROM public.inventory_locations
    WHERE code = 'MAIN' OR is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_location_id IS NOT NULL THEN
      -- Crear movimiento de ENTRADA
      INSERT INTO public.inventory_movements (
        item_id,
        location_id,
        movement_type,
        quantity,
        unit_cost,
        total_cost,
        movement_date,
        reason,
        crane_id,
        cost_id,
        supplier_id,
        observations,
        created_by,
        status
      )
      VALUES (
        v_inventory_item_id,
        v_location_id,
        'entry',
        NEW.part_quantity,
        NEW.part_unit_price,
        NEW.amount,
        NEW.due_date,
        'Compra desde pago a proveedor',
        NEW.crane_id,
        v_new_cost_id,
        NEW.supplier_id,
        'Sincronización automática: Suppliers → Costs → Inventory',
        NEW.created_by,
        'active'
      );

      RAISE NOTICE '✅ [Supplier→Cost→Inventory] Sincronización triple completada para %', NEW.description;
    ELSE
      RAISE NOTICE '✅ [Supplier→Cost] Sincronización parcial (sin ubicación de inventario)';
    END IF;
  ELSE
    RAISE NOTICE '✅ [Supplier→Cost] Sincronización simple (sin inventario)';
  END IF;

  RETURN NEW;
END;
$function$;