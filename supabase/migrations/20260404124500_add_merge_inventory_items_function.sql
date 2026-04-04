CREATE OR REPLACE FUNCTION public.merge_inventory_items(
  p_master_item_id uuid,
  p_duplicate_item_ids uuid[],
  p_master_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master_item record;
  v_duplicate_count integer := 0;
  v_moved_movements integer := 0;
  v_moved_alerts integer := 0;
  v_moved_cost_links integer := 0;
  v_moved_supplier_invoice_links integer := 0;
  v_deleted_stock_rows integer := 0;
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Solo los administradores pueden fusionar productos';
  END IF;

  IF p_master_item_id IS NULL THEN
    RAISE EXCEPTION 'Debes indicar un producto maestro';
  END IF;

  IF p_duplicate_item_ids IS NULL OR array_length(p_duplicate_item_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debes indicar al menos un producto duplicado';
  END IF;

  IF p_master_item_id = ANY(p_duplicate_item_ids) THEN
    RAISE EXCEPTION 'El producto maestro no puede estar incluido entre los duplicados';
  END IF;

  SELECT *
  INTO v_master_item
  FROM public.inventory_items
  WHERE id = p_master_item_id
  LIMIT 1;

  IF v_master_item IS NULL THEN
    RAISE EXCEPTION 'No se encontro el producto maestro';
  END IF;

  SELECT COUNT(*)
  INTO v_duplicate_count
  FROM public.inventory_items
  WHERE id = ANY(p_duplicate_item_ids);

  IF v_duplicate_count = 0 THEN
    RAISE EXCEPTION 'No se encontraron productos duplicados validos';
  END IF;

  UPDATE public.inventory_items
  SET
    name = COALESCE(NULLIF(btrim(p_master_name), ''), name),
    is_active = true,
    updated_at = now()
  WHERE id = p_master_item_id;

  UPDATE public.inventory_movements
  SET item_id = p_master_item_id
  WHERE item_id = ANY(p_duplicate_item_ids);
  GET DIAGNOSTICS v_moved_movements = ROW_COUNT;

  UPDATE public.inventory_alerts
  SET item_id = p_master_item_id,
      updated_at = now()
  WHERE item_id = ANY(p_duplicate_item_ids);
  GET DIAGNOSTICS v_moved_alerts = ROW_COUNT;

  UPDATE public.cost_inventory_items
  SET inventory_item_id = p_master_item_id
  WHERE inventory_item_id = ANY(p_duplicate_item_ids);
  GET DIAGNOSTICS v_moved_cost_links = ROW_COUNT;

  UPDATE public.supplier_invoice_items
  SET inventory_item_id = p_master_item_id,
      updated_at = now()
  WHERE inventory_item_id = ANY(p_duplicate_item_ids);
  GET DIAGNOSTICS v_moved_supplier_invoice_links = ROW_COUNT;

  DELETE FROM public.inventory_stock
  WHERE item_id = ANY(p_duplicate_item_ids);
  GET DIAGNOSTICS v_deleted_stock_rows = ROW_COUNT;

  DELETE FROM public.inventory_stock
  WHERE item_id = p_master_item_id;

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
    p_master_item_id,
    im.location_id,
    COALESCE(SUM(
      CASE
        WHEN im.movement_type = 'entry' THEN im.quantity
        WHEN im.movement_type = 'exit' THEN -im.quantity
        ELSE 0
      END
    ), 0) AS current_quantity,
    0,
    MAX(im.movement_date) AS last_movement_date,
    now(),
    now()
  FROM public.inventory_movements im
  WHERE im.item_id = p_master_item_id
    AND im.status = 'active'
  GROUP BY im.location_id;

  UPDATE public.inventory_items
  SET
    is_active = false,
    updated_at = now(),
    description = concat_ws(
      E'\n',
      nullif(description, ''),
      'Fusionado en producto maestro: ' || COALESCE(NULLIF(btrim(p_master_name), ''), v_master_item.name)
    )
  WHERE id = ANY(p_duplicate_item_ids);

  RETURN jsonb_build_object(
    'success', true,
    'master_item_id', p_master_item_id,
    'duplicate_items_merged', v_duplicate_count,
    'movements_reassigned', v_moved_movements,
    'alerts_reassigned', v_moved_alerts,
    'cost_links_reassigned', v_moved_cost_links,
    'supplier_invoice_links_reassigned', v_moved_supplier_invoice_links,
    'stock_rows_rebuilt', v_deleted_stock_rows,
    'master_name', COALESCE(NULLIF(btrim(p_master_name), ''), v_master_item.name)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_inventory_items(uuid, uuid[], text) TO authenticated;
