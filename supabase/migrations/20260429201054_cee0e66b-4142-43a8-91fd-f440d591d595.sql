-- ============================================
-- Tabla de auditoría: purchase_voids
-- ============================================
CREATE TABLE IF NOT EXISTS public.purchase_voids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voided_at timestamptz NOT NULL DEFAULT now(),
  voided_by uuid REFERENCES auth.users(id),
  original_cost_id uuid NOT NULL,
  reason text NOT NULL,
  replacement_supplier_id uuid REFERENCES public.suppliers(id),
  original_cost_snapshot jsonb NOT NULL,
  original_movements_snapshot jsonb,
  original_payment_snapshot jsonb,
  original_invoice_link_snapshot jsonb,
  reverted_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_voids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read purchase voids" ON public.purchase_voids;
CREATE POLICY "Admins can read purchase voids"
  ON public.purchase_voids
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert purchase voids" ON public.purchase_voids;
CREATE POLICY "Admins can insert purchase voids"
  ON public.purchase_voids
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_purchase_voids_voided_at ON public.purchase_voids (voided_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_voids_original_cost ON public.purchase_voids (original_cost_id);

-- ============================================
-- RPC: void_inventory_purchase
-- Revierte en cascada una compra de bodega
-- ============================================
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
  v_entry_movement record;
  v_exit_movements jsonb;
  v_payment record;
  v_invoice record;
  v_stock_after numeric;
  v_other_consumption integer;
  v_summary jsonb := jsonb_build_object();
  v_cost_snapshot jsonb;
  v_movements_snapshot jsonb;
  v_payment_snapshot jsonb;
  v_invoice_snapshot jsonb;
  v_movements_count integer := 0;
  v_payment_reverted boolean := false;
  v_invoice_reverted boolean := false;
BEGIN
  -- Validación de permisos
  IF NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'No autorizado: solo administradores pueden anular compras';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Debe proporcionar un motivo de al menos 5 caracteres';
  END IF;

  -- Cargar el costo
  SELECT * INTO v_cost FROM public.costs WHERE id = p_cost_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Costo no encontrado: %', p_cost_id;
  END IF;

  -- Snapshot del costo
  v_cost_snapshot := to_jsonb(v_cost);

  -- Cargar el movimiento de entrada vinculado al costo
  SELECT * INTO v_entry_movement
  FROM public.inventory_movements
  WHERE id = v_cost.inventory_movement_id;

  -- Validación: stock no debe quedar negativo si se revierte la entrada
  IF v_entry_movement.id IS NOT NULL AND v_entry_movement.movement_type = 'entry' THEN
    SELECT COALESCE(current_quantity, 0) - v_entry_movement.quantity
      INTO v_stock_after
    FROM public.inventory_stock
    WHERE item_id = v_entry_movement.item_id
      AND location_id = v_entry_movement.location_id;

    IF v_stock_after < 0 THEN
      -- Buscar si existe un movimiento de salida del mismo costo (consumo inmediato)
      SELECT COUNT(*) INTO v_other_consumption
      FROM public.inventory_movements
      WHERE cost_id = p_cost_id
        AND movement_type = 'exit'
        AND id != v_entry_movement.id;

      -- Si no hay salida del mismo costo que compense, abortar
      IF v_other_consumption = 0 THEN
        RAISE EXCEPTION 'No se puede anular: el stock quedaría negativo (% unidades). El producto ya fue consumido por otros movimientos.', v_stock_after;
      END IF;
    END IF;
  END IF;

  -- Recolectar movimientos vinculados (entrada + salidas del mismo cost_id)
  SELECT jsonb_agg(to_jsonb(im.*))
    INTO v_movements_snapshot
  FROM public.inventory_movements im
  WHERE im.cost_id = p_cost_id
     OR im.id = v_cost.inventory_movement_id;

  -- Cargar pago vinculado
  IF v_cost.supplier_payment_id IS NOT NULL THEN
    SELECT * INTO v_payment FROM public.supplier_payments WHERE id = v_cost.supplier_payment_id;
    IF FOUND THEN
      v_payment_snapshot := to_jsonb(v_payment);
    END IF;
  END IF;

  -- Cargar factura vinculada
  IF v_cost.supplier_invoice_id IS NOT NULL THEN
    SELECT * INTO v_invoice FROM public.supplier_invoices WHERE id = v_cost.supplier_invoice_id;
    IF FOUND THEN
      v_invoice_snapshot := to_jsonb(v_invoice);
    END IF;
  END IF;

  -- ============================================
  -- EJECUCIÓN: orden de borrado para evitar FKs
  -- ============================================

  -- 1. Eliminar movimientos vinculados al cost_id (salidas y entradas relacionadas)
  WITH deleted AS (
    DELETE FROM public.inventory_movements
    WHERE cost_id = p_cost_id
       OR id = v_cost.inventory_movement_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_movements_count FROM deleted;

  -- 2. Limpiar referencia en costs antes de eliminar pago/factura
  UPDATE public.costs
  SET inventory_movement_id = NULL,
      supplier_payment_id = NULL,
      supplier_invoice_id = NULL
  WHERE id = p_cost_id;

  -- 3. Eliminar el pago al proveedor (si corresponde y no está conciliado)
  IF p_revert_payment AND v_payment.id IS NOT NULL THEN
    -- Verificar que el pago no tenga otros costos vinculados
    IF NOT EXISTS (
      SELECT 1 FROM public.costs WHERE supplier_payment_id = v_payment.id AND id != p_cost_id
    ) THEN
      DELETE FROM public.supplier_payments WHERE id = v_payment.id;
      v_payment_reverted := true;
    END IF;
  END IF;

  -- 4. Eliminar la factura del proveedor (si corresponde y no tiene otros costos)
  IF p_revert_invoice AND v_invoice.id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.costs WHERE supplier_invoice_id = v_invoice.id AND id != p_cost_id
    ) THEN
      DELETE FROM public.supplier_invoice_items WHERE supplier_invoice_id = v_invoice.id;
      DELETE FROM public.supplier_invoices WHERE id = v_invoice.id;
      v_invoice_reverted := true;
    END IF;
  END IF;

  -- 5. Eliminar el costo
  DELETE FROM public.costs WHERE id = p_cost_id;

  -- ============================================
  -- Auditoría
  -- ============================================
  v_summary := jsonb_build_object(
    'cost_deleted', true,
    'movements_deleted', v_movements_count,
    'payment_reverted', v_payment_reverted,
    'invoice_reverted', v_invoice_reverted
  );

  INSERT INTO public.purchase_voids (
    voided_by,
    original_cost_id,
    reason,
    replacement_supplier_id,
    original_cost_snapshot,
    original_movements_snapshot,
    original_payment_snapshot,
    original_invoice_link_snapshot,
    reverted_summary
  ) VALUES (
    v_user_id,
    p_cost_id,
    p_reason,
    p_replacement_supplier_id,
    v_cost_snapshot,
    v_movements_snapshot,
    v_payment_snapshot,
    v_invoice_snapshot,
    v_summary
  );

  RETURN v_summary;
END;
$$;

REVOKE ALL ON FUNCTION public.void_inventory_purchase(uuid, text, uuid, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_inventory_purchase(uuid, text, uuid, boolean, boolean) TO authenticated;