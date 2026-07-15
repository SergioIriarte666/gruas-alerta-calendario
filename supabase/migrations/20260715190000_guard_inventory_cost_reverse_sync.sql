BEGIN;

CREATE OR REPLACE FUNCTION public.sync_inventory_cost_to_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_item_id UUID;
  v_location_id UUID;
  v_cost_category_name TEXT;
  v_entry_id UUID;
  v_exit_id UUID;
BEGIN
  -- Inventory-originated costs already point to their movement. Do not create
  -- a second movement for the same cost when the reverse trigger fires.
  IF NEW.inventory_movement_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_cost_category_name
  FROM public.cost_categories
  WHERE id = NEW.category_id;

  IF (v_cost_category_name ILIKE '%inventario%' OR v_cost_category_name ILIKE '%pieza%' OR v_cost_category_name ILIKE '%repuesto%')
     AND NEW.purchase_quantity IS NOT NULL
     AND NEW.purchase_unit_cost IS NOT NULL THEN

    SELECT id INTO v_item_id
    FROM public.inventory_items
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(NEW.description))
    LIMIT 1;

    IF v_item_id IS NULL THEN
      INSERT INTO public.inventory_items (
        name,
        unit_of_measure,
        unit_cost,
        created_by
      )
      VALUES (
        NEW.description,
        'unidad',
        NEW.purchase_unit_cost,
        NEW.created_by
      )
      RETURNING id INTO v_item_id;
    END IF;

    UPDATE public.inventory_items
    SET unit_cost = NEW.purchase_unit_cost
    WHERE id = v_item_id
      AND NEW.purchase_unit_cost > 0
      AND (unit_cost IS NULL OR unit_cost <= 0);

    SELECT id INTO v_location_id
    FROM public.inventory_locations
    WHERE code = 'MAIN' OR is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_location_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT id INTO v_entry_id
    FROM public.inventory_movements
    WHERE cost_id = NEW.id
      AND movement_type = 'entry'
      AND status = 'active'
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_entry_id IS NULL THEN
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
        v_item_id,
        v_location_id,
        'entry',
        NEW.purchase_quantity,
        NEW.purchase_unit_cost,
        NEW.amount,
        NEW.date,
        'Compra desde costo',
        NEW.crane_id,
        NEW.id,
        NEW.supplier_id,
        COALESCE(NEW.notes, 'Sincronización automática: Costs → Inventory'),
        NEW.created_by,
        'active'
      )
      RETURNING id INTO v_entry_id;
    END IF;

    IF COALESCE(NEW.immediate_consumption, false) = false OR NEW.crane_id IS NULL THEN
      UPDATE public.costs
      SET inventory_movement_id = v_entry_id
      WHERE id = NEW.id AND inventory_movement_id IS NULL;
      RETURN NEW;
    END IF;

    SELECT id INTO v_exit_id
    FROM public.inventory_movements
    WHERE cost_id = NEW.id
      AND movement_type = 'exit'
      AND status = 'active'
      AND crane_id = NEW.crane_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_exit_id IS NULL THEN
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
        v_item_id,
        v_location_id,
        'exit',
        NEW.purchase_quantity,
        NEW.purchase_unit_cost,
        NEW.amount,
        NEW.date,
        'Consumo inmediato',
        NEW.crane_id,
        NEW.id,
        NEW.supplier_id,
        'Consumo inmediato (creado desde Costos)',
        NEW.created_by,
        'active'
      )
      RETURNING id INTO v_exit_id;
    END IF;

    UPDATE public.costs
    SET inventory_movement_id = v_exit_id
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_inventory_cost_to_movement() IS 'Sincroniza automáticamente los costos de inventario con inventory_movements. Si immediate_consumption=true, crea entrada y salida inmediata a la grúa. Omite costos que ya vienen enlazados desde un movimiento de inventario.';

COMMIT;
