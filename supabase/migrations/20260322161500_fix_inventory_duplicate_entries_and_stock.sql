-- Corrige duplicación de entradas de inventario originadas por inserts en crane_parts
-- y reconstruye inventory_stock a partir del ledger de inventory_movements.
--
-- Objetivos:
-- 1) Evitar que crane_parts generados desde consumos (inventory_movement_id no null)
--    creen una ENTRADA adicional.
-- 2) Evitar duplicación de entradas por cost_id o por inserciones repetidas.
-- 3) Reparar stock actual cancelando duplicados y recalculando inventory_stock.

-- 1) Reemplazar función de sync (crane_parts -> inventory_movements)
DROP TRIGGER IF EXISTS sync_parts_purchase_to_inventory_trigger ON public.crane_parts;
DROP TRIGGER IF EXISTS sync_parts_purchase_trigger ON public.crane_parts;

CREATE OR REPLACE FUNCTION public.sync_parts_purchase_to_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inventory_item_id uuid;
  v_location_id uuid;
  v_existing_id uuid;
  v_part_key text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Solo compras con cantidad positiva
  IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN
    RETURN NEW;
  END IF;

  -- Si ya está vinculado a un movimiento, no crear nada (evita duplicar consumos)
  IF NEW.inventory_movement_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Si explícitamente es consumo interno, no crear entrada
  IF COALESCE(NEW.supplier, '') ILIKE '%inventario interno%' THEN
    RETURN NEW;
  END IF;

  -- Si las notas parecen consumo o auto-sync de consumo, no crear entrada
  IF COALESCE(NEW.notes, '') ILIKE '%consumo%' THEN
    RETURN NEW;
  END IF;

  -- Si hay cost_id, evitar duplicado por costo
  IF NEW.cost_id IS NOT NULL THEN
    SELECT im.id INTO v_existing_id
    FROM public.inventory_movements im
    WHERE im.cost_id = NEW.cost_id
      AND im.movement_type = 'entry'
      AND im.status = 'active'
    ORDER BY im.created_at ASC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Obtener ubicación principal
  SELECT id INTO v_location_id
  FROM public.inventory_locations
  WHERE is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_location_id IS NULL THEN
    INSERT INTO public.inventory_locations (name, code, description, is_active)
    VALUES ('Bodega Principal', 'MAIN', 'Ubicación principal de inventario', true)
    RETURNING id INTO v_location_id;
  END IF;

  -- Normalización simple (trim + colapsar espacios + lower) para matching
  v_part_key := lower(regexp_replace(trim(NEW.part_name), '\s+', ' ', 'g'));

  SELECT ii.id INTO v_inventory_item_id
  FROM public.inventory_items ii
  WHERE ii.is_active = true
    AND lower(regexp_replace(trim(ii.name), '\s+', ' ', 'g')) = v_part_key
  ORDER BY ii.created_at ASC
  LIMIT 1;

  IF v_inventory_item_id IS NULL THEN
    INSERT INTO public.inventory_items (
      name,
      description,
      unit_of_measure,
      unit_cost,
      minimum_stock,
      is_active,
      created_by
    )
    VALUES (
      trim(NEW.part_name),
      'Creado automáticamente desde crane_parts',
      'unidad',
      COALESCE(NEW.unit_price, 0),
      1,
      true,
      NEW.created_by
    )
    RETURNING id INTO v_inventory_item_id;
  END IF;

  -- Dedupe conservador: si ya existe una entrada idéntica (mismo item + grúa + fecha + cantidad + proveedor), no crear otra
  SELECT im.id INTO v_existing_id
  FROM public.inventory_movements im
  WHERE im.item_id = v_inventory_item_id
    AND im.location_id = v_location_id
    AND im.movement_type = 'entry'
    AND im.status = 'active'
    AND im.crane_id IS NOT DISTINCT FROM NEW.crane_id
    AND im.quantity = NEW.quantity
    AND im.movement_date::date = NEW.date
    AND coalesce(im.supplier_name, '') = coalesce(NEW.supplier, '')
  ORDER BY im.created_at ASC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.inventory_movements (
    item_id,
    location_id,
    movement_type,
    quantity,
    unit_cost,
    total_cost,
    movement_date,
    reason,
    supplier_name,
    crane_id,
    cost_id,
    observations,
    created_by,
    status
  )
  VALUES (
    v_inventory_item_id,
    v_location_id,
    'entry',
    NEW.quantity,
    NEW.unit_price,
    NEW.total_value,
    NEW.date,
    'Compra de pieza: ' || trim(NEW.part_name),
    NEW.supplier,
    NEW.crane_id,
    NEW.cost_id,
    COALESCE(NEW.notes, ''),
    NEW.created_by,
    'active'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error en sync_parts_purchase_to_inventory: % - %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

CREATE TRIGGER sync_parts_purchase_to_inventory_trigger
AFTER INSERT ON public.crane_parts
FOR EACH ROW
EXECUTE FUNCTION public.sync_parts_purchase_to_inventory();

-- 2) Reparación: cancelar duplicados y recalcular stock
DO $$
DECLARE
  v_cancelled int := 0;
BEGIN
  -- 2.1) Cancelar duplicados de ENTRADAS por cost_id
  WITH ranked AS (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY cost_id, movement_type
        ORDER BY created_at ASC
      ) AS rn
    FROM public.inventory_movements
    WHERE status = 'active'
      AND movement_type = 'entry'
      AND cost_id IS NOT NULL
  )
  UPDATE public.inventory_movements im
  SET status = 'cancelled'
  FROM ranked r
  WHERE im.id = r.id
    AND r.rn > 1;

  GET DIAGNOSTICS v_cancelled = ROW_COUNT;
  RAISE NOTICE 'Cancelados duplicados por cost_id: %', v_cancelled;

  -- 2.2) Cancelar duplicados "idénticos" de ENTRADAS sin cost_id (mantener el que tenga proveedor informado)
  WITH ranked2 AS (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY
          movement_type,
          item_id,
          location_id,
          crane_id,
          movement_date::date,
          quantity,
          unit_cost,
          total_cost,
          coalesce(supplier_id::text, ''),
          coalesce(supplier_name, ''),
          coalesce(reason, ''),
          coalesce(observations, '')
        ORDER BY
          CASE WHEN (supplier_id IS NOT NULL OR coalesce(supplier_name, '') <> '') THEN 0 ELSE 1 END,
          created_at ASC
      ) AS rn
    FROM public.inventory_movements
    WHERE status = 'active'
      AND movement_type = 'entry'
      AND cost_id IS NULL
  )
  UPDATE public.inventory_movements im
  SET status = 'cancelled'
  FROM ranked2 r
  WHERE im.id = r.id
    AND r.rn > 1;

  -- 2.3) Recalcular inventory_stock desde inventory_movements (solo activos)
  DELETE FROM public.inventory_stock;

  INSERT INTO public.inventory_stock (
    item_id,
    location_id,
    current_quantity,
    reserved_quantity,
    last_movement_date,
    created_at,
    updated_at
  )
  SELECT
    im.item_id,
    im.location_id,
    COALESCE(SUM(
      CASE
        WHEN im.movement_type = 'entry' THEN im.quantity
        WHEN im.movement_type = 'exit' THEN -im.quantity
        ELSE 0
      END
    ), 0) AS current_quantity,
    0 AS reserved_quantity,
    MAX(im.movement_date) AS last_movement_date,
    now() AS created_at,
    now() AS updated_at
  FROM public.inventory_movements im
  WHERE im.status = 'active'
  GROUP BY im.item_id, im.location_id;
END $$;
