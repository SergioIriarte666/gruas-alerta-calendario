BEGIN;

DO $$
DECLARE
  v_kube_supplier_id uuid;
  v_lowboy_location_id uuid := '49ea7343-d6cf-4231-9579-d924406f7b6b'::uuid;
  v_main_location_id uuid;
  v_item_id uuid;
  v_movement_id uuid;
  v_cost record;
BEGIN
  PERFORM set_config('app.sync_in_progress', 'true', true);
  PERFORM set_config('app.bidirectional_sync', 'true', true);

  SELECT id INTO v_kube_supplier_id
  FROM public.inventory_suppliers
  WHERE lower(trim(name)) = lower(trim('Kube SpA'))
  LIMIT 1;

  IF v_kube_supplier_id IS NULL THEN
    RAISE NOTICE 'Kube SpA no existe en inventory_suppliers; backfill omitido.';
    RETURN;
  END IF;

  SELECT id INTO v_main_location_id
  FROM public.inventory_locations
  WHERE COALESCE(entity, 'gruas_5_norte') = 'gruas_5_norte'
    AND is_active IS DISTINCT FROM false
  ORDER BY CASE WHEN code = 'MAIN' THEN 0 ELSE 1 END, created_at ASC NULLS LAST, name ASC
  LIMIT 1;

  FOR v_cost IN
    SELECT c.*
    FROM public.costs c
    JOIN public.cost_categories cc ON cc.id = c.category_id
    WHERE c.supplier_id = v_kube_supplier_id
      AND c.inventory_movement_id IS NULL
      AND c.purchase_quantity IS NOT NULL
      AND c.purchase_unit_cost IS NOT NULL
      AND (cc.name ILIKE '%inventario%' OR cc.name ILIKE '%pieza%' OR cc.name ILIKE '%repuesto%')
      AND NOT EXISTS (
        SELECT 1
        FROM public.inventory_movements im
        WHERE im.cost_id = c.id
          AND im.movement_type = 'entry'
          AND im.status = 'active'
      )
    ORDER BY c.date ASC, c.created_at ASC
  LOOP
    SELECT id INTO v_item_id
    FROM public.inventory_items
    WHERE lower(trim(name)) = lower(trim(v_cost.description))
    ORDER BY created_at ASC NULLS LAST
    LIMIT 1;

    IF v_item_id IS NULL THEN
      INSERT INTO public.inventory_items (
        name,
        unit_of_measure,
        unit_cost,
        created_by
      )
      VALUES (
        COALESCE(NULLIF(trim(v_cost.description), ''), 'Compra de inventario'),
        'unidad',
        COALESCE(v_cost.purchase_unit_cost, 0),
        v_cost.created_by
      )
      RETURNING id INTO v_item_id;
    ELSE
      UPDATE public.inventory_items
      SET unit_cost = v_cost.purchase_unit_cost
      WHERE id = v_item_id
        AND COALESCE(v_cost.purchase_unit_cost, 0) > 0
        AND (unit_cost IS NULL OR unit_cost <= 0);
    END IF;

    INSERT INTO public.inventory_movements (
      item_id,
      location_id,
      movement_type,
      quantity,
      unit_cost,
      total_cost,
      reference_document,
      supplier_id,
      reason,
      observations,
      status,
      movement_date,
      created_by,
      cost_id,
      supplier_invoice_id
    )
    VALUES (
      v_item_id,
      CASE WHEN v_cost.entity = 'lowboy' THEN v_lowboy_location_id ELSE v_main_location_id END,
      'entry',
      v_cost.purchase_quantity,
      v_cost.purchase_unit_cost,
      v_cost.amount,
      v_cost.document_number,
      v_cost.supplier_id,
      'Compra desde costo',
      COALESCE(v_cost.notes, 'Backfill automático: costo de Kube SpA a Bodega'),
      'active',
      v_cost.date::timestamptz,
      v_cost.created_by,
      v_cost.id,
      v_cost.supplier_invoice_id
    )
    RETURNING id INTO v_movement_id;

    UPDATE public.costs
    SET inventory_movement_id = v_movement_id,
        paid_by = CASE WHEN entity = 'lowboy' THEN 'gruas_5_norte' ELSE paid_by END,
        updated_at = now()
    WHERE id = v_cost.id;
  END LOOP;

  UPDATE public.costs c
  SET inventory_movement_id = im.id,
      paid_by = CASE WHEN c.entity = 'lowboy' THEN 'gruas_5_norte' ELSE c.paid_by END,
      updated_at = now()
  FROM public.inventory_movements im
  WHERE c.supplier_id = v_kube_supplier_id
    AND c.inventory_movement_id IS NULL
    AND im.cost_id = c.id
    AND im.movement_type = 'entry'
    AND im.status = 'active';

  PERFORM set_config('app.bidirectional_sync', 'false', true);
  PERFORM set_config('app.sync_in_progress', 'false', true);
END $$;

COMMIT;
