-- =====================================================
-- Anular Compra de Bodega: búsqueda + impacto + anulación reforzada
-- =====================================================

-- 1) Búsqueda segura (admin-only)
CREATE OR REPLACE FUNCTION public.search_voidable_inventory_purchases(p_search text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  date date,
  description text,
  amount numeric,
  supplier_id uuid,
  supplier_name text,
  document_number text,
  service_folio text,
  payment_date date,
  immediate_consumption boolean,
  inventory_movement_id uuid,
  supplier_payment_id uuid,
  supplier_invoice_id uuid,
  purchase_quantity numeric,
  purchase_unit_cost numeric,
  has_inventory_link boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_term text := nullif(trim(coalesce(p_search, '')), '');
  v_pat  text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_pat := '%' || lower(coalesce(v_term, '')) || '%';

  RETURN QUERY
  WITH base AS (
    SELECT c.*
    FROM public.costs c
    WHERE
      -- Solo costos vinculados a bodega
      (
        c.inventory_movement_id IS NOT NULL
        OR c.purchase_quantity IS NOT NULL
        OR EXISTS (SELECT 1 FROM public.inventory_movements im WHERE im.cost_id = c.id)
      )
  ),
  matched AS (
    SELECT b.*
    FROM base b
    LEFT JOIN public.suppliers s ON s.id = b.supplier_id
    WHERE
      v_term IS NULL
      OR lower(coalesce(b.description, ''))     LIKE v_pat
      OR lower(coalesce(b.document_number, '')) LIKE v_pat
      OR lower(coalesce(b.service_folio, ''))   LIKE v_pat
      OR lower(coalesce(b.notes, ''))           LIKE v_pat
      OR lower(coalesce(s.name, ''))            LIKE v_pat
      OR EXISTS (
        SELECT 1 FROM public.inventory_movements im
        WHERE im.cost_id = b.id
          AND (
            lower(coalesce(im.supplier_name, ''))      LIKE v_pat
            OR lower(coalesce(im.reference_document, '')) LIKE v_pat
          )
      )
  )
  SELECT
    m.id,
    m.date,
    m.description,
    m.amount,
    m.supplier_id,
    s.name AS supplier_name,
    m.document_number,
    m.service_folio,
    m.payment_date,
    m.immediate_consumption,
    m.inventory_movement_id,
    m.supplier_payment_id,
    m.supplier_invoice_id,
    m.purchase_quantity,
    m.purchase_unit_cost,
    (m.inventory_movement_id IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.inventory_movements im WHERE im.cost_id = m.id)) AS has_inventory_link
  FROM matched m
  LEFT JOIN public.suppliers s ON s.id = m.supplier_id
  ORDER BY m.date DESC NULLS LAST, m.created_at DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.search_voidable_inventory_purchases(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_voidable_inventory_purchases(text) TO authenticated;


-- 2) Vista previa de impacto (admin-only)
CREATE OR REPLACE FUNCTION public.get_purchase_void_impact(p_cost_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost record;
  v_movements jsonb;
  v_payment jsonb;
  v_invoice jsonb;
  v_entry record;
  v_current_stock numeric;
  v_stock_after numeric;
  v_net_change numeric := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_cost FROM public.costs WHERE id = p_cost_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Costo no encontrado';
  END IF;

  -- Movimientos relacionados (por cost_id o por inventory_movement_id directo)
  SELECT jsonb_agg(jsonb_build_object(
    'id', im.id,
    'movement_type', im.movement_type,
    'quantity', im.quantity,
    'unit_cost', im.unit_cost,
    'item_id', im.item_id,
    'item_name', ii.name,
    'location_id', im.location_id,
    'location_name', il.name,
    'crane_id', im.crane_id
  ) ORDER BY im.movement_type DESC, im.movement_date)
  INTO v_movements
  FROM public.inventory_movements im
  LEFT JOIN public.inventory_items ii ON ii.id = im.item_id
  LEFT JOIN public.inventory_locations il ON il.id = im.location_id
  WHERE im.cost_id = p_cost_id
     OR im.id = v_cost.inventory_movement_id;

  -- Calcular stock proyectado: tomamos cualquier entrada vinculada
  SELECT * INTO v_entry
  FROM public.inventory_movements
  WHERE (cost_id = p_cost_id OR id = v_cost.inventory_movement_id)
    AND movement_type = 'entry'
    AND status = 'active'
  LIMIT 1;

  IF v_entry.id IS NOT NULL THEN
    SELECT COALESCE(current_quantity, 0) INTO v_current_stock
    FROM public.inventory_stock
    WHERE item_id = v_entry.item_id AND location_id = v_entry.location_id;

    -- Cambio neto = -entradas + salidas (lo que se "deshace")
    SELECT COALESCE(SUM(
      CASE
        WHEN movement_type = 'entry' THEN -quantity
        WHEN movement_type = 'exit'  THEN  quantity
        ELSE 0
      END
    ), 0)
    INTO v_net_change
    FROM public.inventory_movements
    WHERE (cost_id = p_cost_id OR id = v_cost.inventory_movement_id)
      AND status = 'active'
      AND item_id = v_entry.item_id
      AND location_id = v_entry.location_id;

    v_stock_after := COALESCE(v_current_stock, 0) + v_net_change;
  END IF;

  -- Pago vinculado
  IF v_cost.supplier_payment_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', sp.id,
      'amount', sp.amount,
      'paid_date', sp.paid_date,
      'reference_number', sp.reference_number,
      'description', sp.description
    ) INTO v_payment
    FROM public.supplier_payments sp
    WHERE sp.id = v_cost.supplier_payment_id;
  END IF;

  -- Factura vinculada
  IF v_cost.supplier_invoice_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', si.id,
      'invoice_number', si.invoice_number,
      'issue_date', si.issue_date,
      'amount', si.amount
    ) INTO v_invoice
    FROM public.supplier_invoices si
    WHERE si.id = v_cost.supplier_invoice_id;
  END IF;

  RETURN jsonb_build_object(
    'cost', jsonb_build_object(
      'id', v_cost.id,
      'date', v_cost.date,
      'description', v_cost.description,
      'amount', v_cost.amount,
      'document_number', v_cost.document_number,
      'service_folio', v_cost.service_folio,
      'immediate_consumption', v_cost.immediate_consumption
    ),
    'movements', COALESCE(v_movements, '[]'::jsonb),
    'payment', v_payment,
    'invoice', v_invoice,
    'currentStock', v_current_stock,
    'stockAfter', v_stock_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_purchase_void_impact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_purchase_void_impact(uuid) TO authenticated;


-- 3) Anulación reforzada
CREATE OR REPLACE FUNCTION public.void_inventory_purchase(
  p_cost_id uuid,
  p_reason text,
  p_replacement_supplier_id uuid DEFAULT NULL,
  p_revert_payment boolean DEFAULT true,
  p_revert_invoice boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_cost record;
  v_payment record;
  v_invoice record;
  v_summary jsonb;
  v_cost_snapshot jsonb;
  v_movements_snapshot jsonb;
  v_payment_snapshot jsonb;
  v_invoice_snapshot jsonb;
  v_movements_count integer := 0;
  v_payment_reverted boolean := false;
  v_invoice_reverted boolean := false;
  v_movement_ids uuid[];
  v_entry record;
  v_stock_after numeric;
  v_net_change numeric;
BEGIN
  IF NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'No autorizado: solo administradores pueden anular compras';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Debe proporcionar un motivo de al menos 5 caracteres';
  END IF;

  SELECT * INTO v_cost FROM public.costs WHERE id = p_cost_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Costo no encontrado: %', p_cost_id;
  END IF;

  v_cost_snapshot := to_jsonb(v_cost);

  -- Recolectar IDs de TODOS los movimientos relacionados
  SELECT ARRAY_AGG(id) INTO v_movement_ids
  FROM public.inventory_movements
  WHERE cost_id = p_cost_id
     OR id = v_cost.inventory_movement_id;

  v_movement_ids := COALESCE(v_movement_ids, ARRAY[]::uuid[]);

  -- Snapshot de movimientos
  SELECT jsonb_agg(to_jsonb(im.*))
  INTO v_movements_snapshot
  FROM public.inventory_movements im
  WHERE im.id = ANY(v_movement_ids);

  -- Validación de stock: stock proyectado >= 0 considerando salidas que se revierten
  SELECT * INTO v_entry
  FROM public.inventory_movements
  WHERE id = ANY(v_movement_ids)
    AND movement_type = 'entry'
    AND status = 'active'
  LIMIT 1;

  IF v_entry.id IS NOT NULL THEN
    SELECT COALESCE(SUM(
      CASE
        WHEN movement_type = 'entry' THEN -quantity
        WHEN movement_type = 'exit'  THEN  quantity
        ELSE 0
      END
    ), 0)
    INTO v_net_change
    FROM public.inventory_movements
    WHERE id = ANY(v_movement_ids)
      AND status = 'active'
      AND item_id = v_entry.item_id
      AND location_id = v_entry.location_id;

    SELECT COALESCE(current_quantity, 0) + v_net_change INTO v_stock_after
    FROM public.inventory_stock
    WHERE item_id = v_entry.item_id AND location_id = v_entry.location_id;

    IF v_stock_after IS NULL THEN v_stock_after := v_net_change; END IF;

    IF v_stock_after < 0 THEN
      RAISE EXCEPTION 'No se puede anular: el stock quedaría en % unidades. El producto ya fue consumido por otros movimientos posteriores.', v_stock_after;
    END IF;
  END IF;

  -- Cargar pago/factura
  IF v_cost.supplier_payment_id IS NOT NULL THEN
    SELECT * INTO v_payment FROM public.supplier_payments WHERE id = v_cost.supplier_payment_id;
    IF FOUND THEN v_payment_snapshot := to_jsonb(v_payment); END IF;
  END IF;

  IF v_cost.supplier_invoice_id IS NOT NULL THEN
    SELECT * INTO v_invoice FROM public.supplier_invoices WHERE id = v_cost.supplier_invoice_id;
    IF FOUND THEN v_invoice_snapshot := to_jsonb(v_invoice); END IF;
  END IF;

  -- =====================
  -- LIMPIEZA DE REFERENCIAS
  -- =====================

  -- Limpiar referencias en costs antes de borrar movimientos
  UPDATE public.costs
  SET inventory_movement_id = NULL,
      supplier_payment_id   = NULL,
      supplier_invoice_id   = NULL
  WHERE id = p_cost_id;

  IF array_length(v_movement_ids, 1) > 0 THEN
    -- Eliminar crane_parts ligadas a estos movimientos (FK sin cascada)
    DELETE FROM public.crane_parts WHERE inventory_movement_id = ANY(v_movement_ids);
    -- También por cost_id (registros manuales que apuntan a este costo)
    DELETE FROM public.crane_parts WHERE cost_id = p_cost_id;

    -- Limpiar inventory_consumptions vinculados a estos movimientos
    DELETE FROM public.inventory_consumptions WHERE movement_id = ANY(v_movement_ids);

    -- Desvincular supplier_invoice_items.movement_id (FK ON DELETE SET NULL ya cubre, pero forzamos limpio)
    UPDATE public.supplier_invoice_items SET movement_id = NULL WHERE movement_id = ANY(v_movement_ids);

    -- Eliminar todos los movimientos relacionados
    WITH del AS (
      DELETE FROM public.inventory_movements WHERE id = ANY(v_movement_ids) RETURNING 1
    )
    SELECT COUNT(*) INTO v_movements_count FROM del;
  END IF;

  -- Eliminar pago si corresponde y no tiene otros costos vinculados
  IF p_revert_payment AND v_payment.id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.costs WHERE supplier_payment_id = v_payment.id AND id != p_cost_id
    ) THEN
      DELETE FROM public.supplier_payments WHERE id = v_payment.id;
      v_payment_reverted := true;
    END IF;
  END IF;

  -- Eliminar factura si corresponde y no tiene otros costos vinculados
  IF p_revert_invoice AND v_invoice.id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.costs WHERE supplier_invoice_id = v_invoice.id AND id != p_cost_id
    ) THEN
      DELETE FROM public.supplier_invoice_items WHERE supplier_invoice_id = v_invoice.id;
      DELETE FROM public.supplier_invoices WHERE id = v_invoice.id;
      v_invoice_reverted := true;
    END IF;
  END IF;

  -- Eliminar costo
  DELETE FROM public.costs WHERE id = p_cost_id;

  v_summary := jsonb_build_object(
    'cost_deleted', true,
    'movements_deleted', v_movements_count,
    'payment_reverted', v_payment_reverted,
    'invoice_reverted', v_invoice_reverted
  );

  INSERT INTO public.purchase_voids (
    voided_by, original_cost_id, reason, replacement_supplier_id,
    original_cost_snapshot, original_movements_snapshot,
    original_payment_snapshot, original_invoice_link_snapshot,
    reverted_summary
  ) VALUES (
    v_user_id, p_cost_id, p_reason, p_replacement_supplier_id,
    v_cost_snapshot, v_movements_snapshot,
    v_payment_snapshot, v_invoice_snapshot,
    v_summary
  );

  RETURN v_summary;
END;
$$;

REVOKE ALL ON FUNCTION public.void_inventory_purchase(uuid, text, uuid, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_inventory_purchase(uuid, text, uuid, boolean, boolean) TO authenticated;