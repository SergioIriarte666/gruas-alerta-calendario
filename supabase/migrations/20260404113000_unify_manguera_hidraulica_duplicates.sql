-- Consolidacion segura de productos equivalentes de "Manguera Hidraulica"
-- Maestro canonico: "Manguera Hidraulica"
-- Variantes a consolidar:
-- - Manguera Hidraulica
-- - Manguera Hidraulico
-- - Mangueras Hidraulico
--
-- Nota:
-- "Mangueras y Adaptadores" NO se consolida aqui porque aparenta ser
-- una categoria/item distinto y mezclarlo afectaria la trazabilidad.

DO $$
DECLARE
  v_master_id uuid;
  v_master_created_at timestamptz;
BEGIN
  -- Seleccionar el registro canonico mas antiguo entre las variantes.
  SELECT id, created_at
  INTO v_master_id, v_master_created_at
  FROM public.inventory_items
  WHERE lower(trim(name)) IN (
    'manguera hidraulica',
    'manguera hidraulico',
    'mangueras hidraulico'
  )
  ORDER BY
    CASE WHEN lower(trim(name)) = 'manguera hidraulica' THEN 0 ELSE 1 END,
    created_at ASC,
    id ASC
  LIMIT 1;

  IF v_master_id IS NULL THEN
    RAISE NOTICE 'No se encontraron items a consolidar para Manguera Hidraulica';
    RETURN;
  END IF;

  -- Estandarizar el item maestro.
  UPDATE public.inventory_items
  SET
    name = 'Manguera Hidraulica',
    is_active = true,
    updated_at = now()
  WHERE id = v_master_id;

  -- Reasignar referencias directas al item maestro.
  UPDATE public.inventory_movements
  SET item_id = v_master_id
  WHERE item_id IN (
    SELECT id
    FROM public.inventory_items
    WHERE lower(trim(name)) IN (
      'manguera hidraulica',
      'manguera hidraulico',
      'mangueras hidraulico'
    )
      AND id <> v_master_id
  );

  UPDATE public.cost_inventory_items
  SET inventory_item_id = v_master_id
  WHERE inventory_item_id IN (
    SELECT id
    FROM public.inventory_items
    WHERE lower(trim(name)) IN (
      'manguera hidraulica',
      'manguera hidraulico',
      'mangueras hidraulico'
    )
      AND id <> v_master_id
  );

  UPDATE public.supplier_invoice_items
  SET inventory_item_id = v_master_id
  WHERE inventory_item_id IN (
    SELECT id
    FROM public.inventory_items
    WHERE lower(trim(name)) IN (
      'manguera hidraulica',
      'manguera hidraulico',
      'mangueras hidraulico'
    )
      AND id <> v_master_id
  );

  UPDATE public.inventory_alerts
  SET item_id = v_master_id
  WHERE item_id IN (
    SELECT id
    FROM public.inventory_items
    WHERE lower(trim(name)) IN (
      'manguera hidraulica',
      'manguera hidraulico',
      'mangueras hidraulico'
    )
      AND id <> v_master_id
  );

  -- Limpiar stock historico de duplicados y recalcular el stock del maestro.
  DELETE FROM public.inventory_stock
  WHERE item_id IN (
    SELECT id
    FROM public.inventory_items
    WHERE lower(trim(name)) IN (
      'manguera hidraulica',
      'manguera hidraulico',
      'mangueras hidraulico'
    )
      AND id <> v_master_id
  );

  WITH stock_calculation AS (
    SELECT
      v_master_id AS item_id,
      im.location_id,
      COALESCE(SUM(
        CASE
          WHEN im.movement_type = 'entry' THEN im.quantity
          WHEN im.movement_type = 'exit' THEN -im.quantity
          ELSE 0
        END
      ), 0) AS current_quantity,
      MAX(im.movement_date) AS last_movement_date
    FROM public.inventory_movements im
    WHERE im.item_id = v_master_id
      AND im.status = 'active'
    GROUP BY im.location_id
  )
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
    sc.item_id,
    sc.location_id,
    sc.current_quantity,
    0,
    sc.last_movement_date,
    now(),
    now()
  FROM stock_calculation sc
  ON CONFLICT (item_id, location_id)
  DO UPDATE SET
    current_quantity = EXCLUDED.current_quantity,
    reserved_quantity = 0,
    last_movement_date = EXCLUDED.last_movement_date,
    updated_at = now();

  -- Desactivar duplicados para mantener historial sin dejar registros activos repetidos.
  UPDATE public.inventory_items
  SET
    is_active = false,
    updated_at = now(),
    description = concat_ws(
      E'\n',
      nullif(description, ''),
      'Consolidado en item maestro: Manguera Hidraulica'
    )
  WHERE lower(trim(name)) IN (
    'manguera hidraulica',
    'manguera hidraulico',
    'mangueras hidraulico'
  )
    AND id <> v_master_id;

  RAISE NOTICE 'Consolidacion completada. Item maestro: % (creado %)', v_master_id, v_master_created_at;
END $$;

-- Verificacion sugerida posterior a la migracion:
-- SELECT id, name, is_active FROM public.inventory_items
-- WHERE lower(trim(name)) IN ('manguera hidraulica', 'manguera hidraulico', 'mangueras hidraulico')
-- ORDER BY is_active DESC, created_at ASC;
