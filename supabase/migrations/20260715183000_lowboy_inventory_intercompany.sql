BEGIN;

ALTER TABLE public.inventory_locations
  ADD COLUMN IF NOT EXISTS entity text NOT NULL DEFAULT 'gruas_5_norte'
  CHECK (entity IN ('gruas_5_norte','lowboy'));

UPDATE public.inventory_locations
SET entity = 'lowboy'
WHERE id = '49ea7343-d6cf-4231-9579-d924406f7b6b'
  AND entity <> 'lowboy';

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS destination_location_id uuid;

ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_destination_location_id_fkey;

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_destination_location_id_fkey
  FOREIGN KEY (destination_location_id) REFERENCES public.inventory_locations(id);

ALTER TABLE public.intercompany_adjustments
  DROP CONSTRAINT IF EXISTS intercompany_adjustments_amount_check;

ALTER TABLE public.intercompany_adjustments
  ADD CONSTRAINT intercompany_adjustments_amount_check CHECK (amount >= 0);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_destination_location_id
  ON public.inventory_movements(destination_location_id);

CREATE INDEX IF NOT EXISTS idx_intercompany_adjustments_reference
  ON public.intercompany_adjustments(reference);

CREATE OR REPLACE FUNCTION public.sync_inventory_to_supplier_and_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_cost_category_id uuid;
  v_new_cost_id uuid;
  v_item_name text;
  v_location_entity text := 'gruas_5_norte';
BEGIN
  -- Solo para movimientos de ENTRADA con costo unitario
  IF NEW.movement_type != 'entry' OR NEW.unit_cost IS NULL OR NEW.unit_cost <= 0 THEN
    RETURN NEW;
  END IF;

  -- Si ya tiene cost_id asociado, no duplicar
  IF NEW.cost_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Si tiene supplier_id pero no cost_id, crear el costo
  IF NEW.supplier_id IS NOT NULL THEN

    -- Obtener categoría "Inventario"
    SELECT id INTO v_cost_category_id
    FROM public.cost_categories
    WHERE name ILIKE '%inventario%'
    LIMIT 1;

    -- Si no existe, crear la categoría
    IF v_cost_category_id IS NULL THEN
      INSERT INTO public.cost_categories (name, description)
      VALUES ('Inventario', 'Compras de inventario generadas automáticamente')
      RETURNING id INTO v_cost_category_id;
    END IF;

    -- Obtener nombre del producto
    SELECT name INTO v_item_name
    FROM public.inventory_items
    WHERE id = NEW.item_id;

    SELECT COALESCE(entity, 'gruas_5_norte') INTO v_location_entity
    FROM public.inventory_locations
    WHERE id = NEW.location_id;

    v_location_entity := COALESCE(v_location_entity, 'gruas_5_norte');

    -- Crear el costo. Las entradas directas a bodega LowBoy se reflejan en la
    -- cuenta intercompañía por costs.entity='lowboy' + paid_by='gruas_5_norte'.
    -- Los traspasos entre bodegas generan intercompany_adjustments aparte; son
    -- flujos excluyentes para evitar doble conteo.
    IF v_location_entity = 'lowboy' THEN
      INSERT INTO public.costs (
        description,
        amount,
        date,
        category_id,
        supplier_id,
        inventory_movement_id,
        purchase_quantity,
        purchase_unit_cost,
        crane_id,
        notes,
        created_by,
        entity,
        paid_by
      )
      VALUES (
        COALESCE(v_item_name, 'Compra de inventario'),
        COALESCE(NEW.total_cost, NEW.unit_cost * NEW.quantity),
        NEW.movement_date::date,
        v_cost_category_id,
        NEW.supplier_id,
        NEW.id,
        NEW.quantity,
        NEW.unit_cost,
        NEW.crane_id,
        'Generado automáticamente desde movimiento de inventario',
        NEW.created_by,
        'lowboy',
        'gruas_5_norte'
      )
      RETURNING id INTO v_new_cost_id;
    ELSE
      INSERT INTO public.costs (
        description,
        amount,
        date,
        category_id,
        supplier_id,
        inventory_movement_id,
        purchase_quantity,
        purchase_unit_cost,
        crane_id,
        notes,
        created_by
      )
      VALUES (
        COALESCE(v_item_name, 'Compra de inventario'),
        COALESCE(NEW.total_cost, NEW.unit_cost * NEW.quantity),
        NEW.movement_date::date,
        v_cost_category_id,
        NEW.supplier_id,
        NEW.id,
        NEW.quantity,
        NEW.unit_cost,
        NEW.crane_id,
        'Generado automáticamente desde movimiento de inventario',
        NEW.created_by
      )
      RETURNING id INTO v_new_cost_id;
    END IF;

    -- Actualizar el movimiento con el cost_id
    UPDATE public.inventory_movements
    SET cost_id = v_new_cost_id
    WHERE id = NEW.id;

    RAISE NOTICE '✅ [Inventory→Cost] Costo creado automáticamente para movimiento %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_inventory_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old_item_id uuid;
  v_old_location_id uuid;
  v_old_destination_location_id uuid;
  v_new_item_id uuid;
  v_new_location_id uuid;
  v_new_destination_location_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new_item_id := NEW.item_id;
    v_new_location_id := NEW.location_id;
    v_new_destination_location_id := NEW.destination_location_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_item_id := OLD.item_id;
    v_old_location_id := OLD.location_id;
    v_old_destination_location_id := OLD.destination_location_id;
    v_new_item_id := NEW.item_id;
    v_new_location_id := NEW.location_id;
    v_new_destination_location_id := NEW.destination_location_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_item_id := OLD.item_id;
    v_old_location_id := OLD.location_id;
    v_old_destination_location_id := OLD.destination_location_id;
  END IF;

  IF v_old_item_id IS NOT NULL AND v_old_location_id IS NOT NULL THEN
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
      v_old_item_id,
      v_old_location_id,
      COALESCE(SUM(
        CASE
          WHEN im.movement_type = 'entry' THEN im.quantity
          WHEN im.movement_type IN ('exit', 'sale') THEN -im.quantity
          WHEN im.movement_type = 'transfer' AND im.location_id = v_old_location_id THEN -im.quantity
          WHEN im.movement_type = 'transfer' AND im.destination_location_id = v_old_location_id THEN im.quantity
          ELSE 0
        END
      ), 0),
      COALESCE((
        SELECT s.reserved_quantity
        FROM public.inventory_stock s
        WHERE s.item_id = v_old_item_id AND s.location_id = v_old_location_id
      ), 0),
      MAX(im.movement_date),
      now(),
      now()
    FROM public.inventory_movements im
    WHERE im.status = 'active'
      AND im.item_id = v_old_item_id
      AND (im.location_id = v_old_location_id OR im.destination_location_id = v_old_location_id)
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET
      current_quantity = EXCLUDED.current_quantity,
      reserved_quantity = EXCLUDED.reserved_quantity,
      last_movement_date = EXCLUDED.last_movement_date,
      updated_at = now();
  END IF;

  IF v_old_item_id IS NOT NULL AND v_old_destination_location_id IS NOT NULL THEN
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
      v_old_item_id,
      v_old_destination_location_id,
      COALESCE(SUM(
        CASE
          WHEN im.movement_type = 'entry' THEN im.quantity
          WHEN im.movement_type IN ('exit', 'sale') THEN -im.quantity
          WHEN im.movement_type = 'transfer' AND im.location_id = v_old_destination_location_id THEN -im.quantity
          WHEN im.movement_type = 'transfer' AND im.destination_location_id = v_old_destination_location_id THEN im.quantity
          ELSE 0
        END
      ), 0),
      COALESCE((
        SELECT s.reserved_quantity
        FROM public.inventory_stock s
        WHERE s.item_id = v_old_item_id AND s.location_id = v_old_destination_location_id
      ), 0),
      MAX(im.movement_date),
      now(),
      now()
    FROM public.inventory_movements im
    WHERE im.status = 'active'
      AND im.item_id = v_old_item_id
      AND (im.location_id = v_old_destination_location_id OR im.destination_location_id = v_old_destination_location_id)
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET
      current_quantity = EXCLUDED.current_quantity,
      reserved_quantity = EXCLUDED.reserved_quantity,
      last_movement_date = EXCLUDED.last_movement_date,
      updated_at = now();
  END IF;

  IF v_new_item_id IS NOT NULL AND v_new_location_id IS NOT NULL
     AND (v_new_item_id IS DISTINCT FROM v_old_item_id OR v_new_location_id IS DISTINCT FROM v_old_location_id) THEN
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
      v_new_item_id,
      v_new_location_id,
      COALESCE(SUM(
        CASE
          WHEN im.movement_type = 'entry' THEN im.quantity
          WHEN im.movement_type IN ('exit', 'sale') THEN -im.quantity
          WHEN im.movement_type = 'transfer' AND im.location_id = v_new_location_id THEN -im.quantity
          WHEN im.movement_type = 'transfer' AND im.destination_location_id = v_new_location_id THEN im.quantity
          ELSE 0
        END
      ), 0),
      COALESCE((
        SELECT s.reserved_quantity
        FROM public.inventory_stock s
        WHERE s.item_id = v_new_item_id AND s.location_id = v_new_location_id
      ), 0),
      MAX(im.movement_date),
      now(),
      now()
    FROM public.inventory_movements im
    WHERE im.status = 'active'
      AND im.item_id = v_new_item_id
      AND (im.location_id = v_new_location_id OR im.destination_location_id = v_new_location_id)
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET
      current_quantity = EXCLUDED.current_quantity,
      reserved_quantity = EXCLUDED.reserved_quantity,
      last_movement_date = EXCLUDED.last_movement_date,
      updated_at = now();
  END IF;

  IF v_new_item_id IS NOT NULL AND v_new_destination_location_id IS NOT NULL
     AND (v_new_item_id IS DISTINCT FROM v_old_item_id OR v_new_destination_location_id IS DISTINCT FROM v_old_destination_location_id) THEN
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
      v_new_item_id,
      v_new_destination_location_id,
      COALESCE(SUM(
        CASE
          WHEN im.movement_type = 'entry' THEN im.quantity
          WHEN im.movement_type IN ('exit', 'sale') THEN -im.quantity
          WHEN im.movement_type = 'transfer' AND im.location_id = v_new_destination_location_id THEN -im.quantity
          WHEN im.movement_type = 'transfer' AND im.destination_location_id = v_new_destination_location_id THEN im.quantity
          ELSE 0
        END
      ), 0),
      COALESCE((
        SELECT s.reserved_quantity
        FROM public.inventory_stock s
        WHERE s.item_id = v_new_item_id AND s.location_id = v_new_destination_location_id
      ), 0),
      MAX(im.movement_date),
      now(),
      now()
    FROM public.inventory_movements im
    WHERE im.status = 'active'
      AND im.item_id = v_new_item_id
      AND (im.location_id = v_new_destination_location_id OR im.destination_location_id = v_new_destination_location_id)
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET
      current_quantity = EXCLUDED.current_quantity,
      reserved_quantity = EXCLUDED.reserved_quantity,
      last_movement_date = EXCLUDED.last_movement_date,
      updated_at = now();
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_inventory_transfer_intercompany_adjustment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_origin_entity text;
  v_destination_entity text;
  v_origin_name text;
  v_destination_name text;
  v_item_name text;
  v_unit_cost numeric;
  v_amount numeric := 0;
  v_direction text;
  v_description text;
BEGIN
  IF NEW.movement_type <> 'transfer'
     OR NEW.status <> 'active'
     OR NEW.location_id IS NULL
     OR NEW.destination_location_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(entity, 'gruas_5_norte'), name
  INTO v_origin_entity, v_origin_name
  FROM public.inventory_locations
  WHERE id = NEW.location_id;

  SELECT COALESCE(entity, 'gruas_5_norte'), name
  INTO v_destination_entity, v_destination_name
  FROM public.inventory_locations
  WHERE id = NEW.destination_location_id;

  IF COALESCE(v_origin_entity, 'gruas_5_norte') = COALESCE(v_destination_entity, 'gruas_5_norte') THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_item_name
  FROM public.inventory_items
  WHERE id = NEW.item_id;

  -- Criterio de valorización: usar unit_cost del traspaso; si viene vacío,
  -- usar el último costo unitario de una entrada activa del mismo ítem.
  -- No se usa costo promedio para no alterar fill_exit_costs ni su criterio.
  v_unit_cost := NULLIF(NEW.unit_cost, 0);

  IF v_unit_cost IS NULL THEN
    SELECT NULLIF(im.unit_cost, 0)
    INTO v_unit_cost
    FROM public.inventory_movements im
    WHERE im.item_id = NEW.item_id
      AND im.movement_type = 'entry'
      AND im.status = 'active'
      AND im.unit_cost IS NOT NULL
      AND im.unit_cost > 0
    ORDER BY im.movement_date DESC, im.created_at DESC
    LIMIT 1;
  END IF;

  IF v_unit_cost IS NULL THEN
    v_amount := 0;
  ELSE
    v_amount := v_unit_cost * NEW.quantity;
  END IF;

  IF v_origin_entity = 'gruas_5_norte' AND v_destination_entity = 'lowboy' THEN
    v_direction := 'g5n_to_lowboy';
  ELSIF v_origin_entity = 'lowboy' AND v_destination_entity = 'gruas_5_norte' THEN
    v_direction := 'lowboy_to_g5n';
  ELSE
    RETURN NEW;
  END IF;

  v_description := format(
    'Traspaso inventario: %s x%s (%s → %s)',
    COALESCE(v_item_name, 'Producto desconocido'),
    NEW.quantity,
    COALESCE(v_origin_name, 'Bodega origen'),
    COALESCE(v_destination_name, 'Bodega destino')
  );

  IF v_amount = 0 THEN
    v_description := 'SIN VALORIZAR — completar manualmente. ' || v_description;
  END IF;

  INSERT INTO public.intercompany_adjustments (
    adjustment_date,
    amount,
    direction,
    description,
    reference,
    created_by
  )
  SELECT
    NEW.movement_date::date,
    v_amount,
    v_direction,
    v_description,
    'inv_movement:' || NEW.id::text,
    NEW.created_by
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.intercompany_adjustments existing
    WHERE existing.reference = 'inv_movement:' || NEW.id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_transfer_intercompany_adjustment ON public.inventory_movements;
CREATE TRIGGER trg_inventory_transfer_intercompany_adjustment
AFTER INSERT ON public.inventory_movements
FOR EACH ROW
EXECUTE FUNCTION public.create_inventory_transfer_intercompany_adjustment();

COMMENT ON COLUMN public.inventory_movements.destination_location_id IS
  'Ubicación destino para movement_type=transfer. location_id se mantiene como origen.';

COMMIT;
