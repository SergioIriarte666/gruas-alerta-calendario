BEGIN;

-- Bug B: hace atómica la importación de "Ingreso XML Bodega". Antes el cliente
-- ejecutaba ~10 inserts/updates secuenciales (cada uno su propia transacción
-- autocommit); si algo fallaba a mitad de camino, quedaban huérfanos
-- costo + pago + movimiento. Esta función hace todo el trabajo dentro de una
-- sola transacción real de Postgres: si cualquier paso falla, todo se revierte.
CREATE OR REPLACE FUNCTION public.import_xml_inventory_invoice(
  p_supplier_id uuid,
  p_folio text,
  p_issue_date date,
  p_due_date date,
  p_total_amount numeric,
  p_net_amount numeric,
  p_vat_amount numeric,
  p_currency text,
  p_document_type text,
  p_description text,
  p_product_service_description text,
  p_xml_file_name text,
  p_is_paid boolean,
  p_location_id uuid,
  p_cost_category_id uuid,
  p_cost_subcategory text,
  p_cost_center_id uuid,
  p_crane_id uuid,
  p_operator_id uuid,
  p_service_id uuid,
  p_service_folio text,
  p_notes text,
  p_lines jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invoice_id uuid;
  v_cost_id uuid;
  v_payment_id uuid;
  v_line jsonb;
  v_line_id uuid;
  v_movement_id uuid;
  v_exit_movement_id uuid;
  v_first_entry_movement_id uuid;
  v_is_first_entry boolean := true;
  v_movement_ids uuid[] := ARRAY[]::uuid[];
  v_line_ids uuid[] := ARRAY[]::uuid[];
  v_existing_invoice record;
  v_existing_linked_costs integer;
  v_stale_movement_ids uuid[];
  v_stale_cost record;
  v_line_quantity integer;
  v_line_unit_price numeric;
  v_line_subtotal numeric;
  v_line_total numeric;
BEGIN
  IF NOT (public.has_role(v_user_id, 'admin'::app_role) OR public.has_role(v_user_id, 'operator'::app_role)) THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol admin u operator para importar facturas XML de bodega';
  END IF;

  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'La factura no tiene líneas para importar';
  END IF;

  -- 1) Limpiar factura XML huérfana previa para el mismo folio/proveedor (reintentos)
  SELECT id, source_module INTO v_existing_invoice
  FROM public.supplier_invoices
  WHERE supplier_id = p_supplier_id AND invoice_number = p_folio;

  IF v_existing_invoice.id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_existing_linked_costs FROM public.costs WHERE supplier_invoice_id = v_existing_invoice.id;

    IF v_existing_invoice.source_module = 'inventory_xml' AND v_existing_linked_costs = 0 THEN
      SELECT ARRAY_AGG(id) INTO v_stale_movement_ids FROM public.inventory_movements WHERE supplier_invoice_id = v_existing_invoice.id;
      v_stale_movement_ids := COALESCE(v_stale_movement_ids, ARRAY[]::uuid[]);
      IF array_length(v_stale_movement_ids, 1) > 0 THEN
        DELETE FROM public.crane_parts WHERE inventory_movement_id = ANY(v_stale_movement_ids);
        DELETE FROM public.inventory_movements WHERE id = ANY(v_stale_movement_ids);
      END IF;
      DELETE FROM public.supplier_payments WHERE supplier_invoice_id = v_existing_invoice.id;
      DELETE FROM public.supplier_invoices WHERE id = v_existing_invoice.id;
    ELSE
      RAISE EXCEPTION 'La factura % ya existe para ese proveedor', p_folio;
    END IF;
  END IF;

  -- 2) Limpiar intento incompleto previo (mismo proveedor + folio) que haya quedado huérfano
  FOR v_stale_cost IN
    SELECT c.id, c.supplier_payment_id, c.supplier_invoice_id, c.inventory_movement_id
    FROM public.costs c
    WHERE c.supplier_id = p_supplier_id AND c.document_number = p_folio
  LOOP
    IF v_stale_cost.supplier_invoice_id IS NULL AND v_stale_cost.inventory_movement_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.inventory_movements WHERE cost_id = v_stale_cost.id)
       AND NOT EXISTS (SELECT 1 FROM public.crane_parts WHERE cost_id = v_stale_cost.id) THEN
      IF v_stale_cost.supplier_payment_id IS NOT NULL THEN
        DELETE FROM public.supplier_payments
        WHERE id = v_stale_cost.supplier_payment_id
          AND (reference_number IS NULL OR trim(reference_number) = '')
          AND supplier_invoice_id IS NULL;
      END IF;
      DELETE FROM public.costs WHERE id = v_stale_cost.id;
    END IF;
  END LOOP;

  -- 3) Factura de proveedor
  INSERT INTO public.supplier_invoices (
    supplier_id, invoice_number, issue_date, due_date, amount, net_amount, tax_amount, currency,
    description, product_service_description, status, paid_amount, source_module, xml_file_name
  ) VALUES (
    p_supplier_id, p_folio, p_issue_date, COALESCE(p_due_date, p_issue_date), p_total_amount,
    p_net_amount, COALESCE(p_vat_amount, 0), COALESCE(p_currency, 'CLP'),
    p_description, p_product_service_description,
    CASE WHEN p_is_paid THEN 'paid' ELSE 'pending' END,
    CASE WHEN p_is_paid THEN p_total_amount ELSE 0 END,
    'inventory_xml', p_xml_file_name
  ) RETURNING id INTO v_invoice_id;

  -- 4) Costo
  INSERT INTO public.costs (
    amount, category_id, date, description, notes, document_type, document_number,
    crane_id, operator_id, immediate_consumption, payment_date, service_id, supplier_id,
    supplier_invoice_id, cost_center_id, service_folio, subcategory, created_by
  ) VALUES (
    p_total_amount, p_cost_category_id, p_issue_date, p_description, p_notes,
    COALESCE(p_document_type, 'Factura'), p_folio, p_crane_id, p_operator_id,
    (p_crane_id IS NOT NULL), CASE WHEN p_is_paid THEN p_issue_date ELSE NULL END,
    p_service_id, p_supplier_id, v_invoice_id, p_cost_center_id,
    COALESCE(p_service_folio, p_folio), COALESCE(p_cost_subcategory, 'Importación XML Bodega'), v_user_id
  ) RETURNING id INTO v_cost_id;

  -- 5) Pago a proveedor vinculado al costo
  INSERT INTO public.supplier_payments (
    supplier_id, supplier_invoice_id, cost_id, amount, due_date, description, category, subcategory,
    reference_number, notes, status, paid_amount, paid_date, crane_id, add_to_inventory, part_name, created_by
  ) VALUES (
    p_supplier_id, v_invoice_id, v_cost_id, p_total_amount, COALESCE(p_due_date, p_issue_date),
    p_description, COALESCE((SELECT name FROM public.cost_categories WHERE id = p_cost_category_id), 'Costos'),
    COALESCE(p_cost_subcategory, 'Importación XML Bodega'), p_folio, p_notes,
    CASE WHEN p_is_paid THEN 'paid' ELSE 'pending' END,
    CASE WHEN p_is_paid THEN p_total_amount ELSE 0 END,
    CASE WHEN p_is_paid THEN p_issue_date ELSE NULL END,
    p_crane_id, false, p_description, v_user_id
  ) RETURNING id INTO v_payment_id;

  UPDATE public.costs SET supplier_payment_id = v_payment_id WHERE id = v_cost_id;

  -- 6) Líneas de factura + movimientos de entrada
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_quantity := TRUNC((v_line->>'quantity')::numeric)::integer;
    v_line_unit_price := COALESCE((v_line->>'unit_price')::numeric, 0);
    v_line_subtotal := COALESCE((v_line->>'subtotal')::numeric, 0);
    v_line_total := COALESCE((v_line->>'total_amount')::numeric, 0);

    INSERT INTO public.supplier_invoice_items (
      supplier_invoice_id, inventory_item_id, line_number, product_code, product_name, description,
      quantity, unit_price, subtotal, tax_rate, tax_amount, total_amount, created_by
    ) VALUES (
      v_invoice_id, (v_line->>'inventory_item_id')::uuid, (v_line->>'line_number')::integer,
      NULLIF(v_line->>'product_code', ''), NULLIF(v_line->>'product_name', ''), v_line->>'description',
      v_line_quantity, v_line_unit_price, v_line_subtotal,
      COALESCE((v_line->>'tax_rate')::numeric, 0), COALESCE((v_line->>'tax_amount')::numeric, 0),
      v_line_total, v_user_id
    ) RETURNING id INTO v_line_id;

    v_line_ids := array_append(v_line_ids, v_line_id);

    INSERT INTO public.inventory_movements (
      item_id, location_id, movement_type, quantity, unit_cost, total_cost, supplier_id,
      reference_document, observations, supplier_invoice_id, supplier_invoice_item_id, cost_id,
      status, created_by
    ) VALUES (
      (v_line->>'inventory_item_id')::uuid, p_location_id, 'entry', v_line_quantity,
      CASE WHEN v_line_quantity > 0 THEN v_line_subtotal / v_line_quantity ELSE 0 END, v_line_subtotal,
      p_supplier_id, p_folio, 'Ingreso XML Bodega - ' || COALESCE(v_line->>'description', ''),
      v_invoice_id, v_line_id, CASE WHEN v_is_first_entry THEN v_cost_id ELSE NULL END,
      'active', v_user_id
    ) RETURNING id INTO v_movement_id;

    IF v_is_first_entry THEN
      v_first_entry_movement_id := v_movement_id;
      v_is_first_entry := false;
    END IF;

    v_movement_ids := array_append(v_movement_ids, v_movement_id);

    UPDATE public.supplier_invoice_items SET movement_id = v_movement_id WHERE id = v_line_id;
  END LOOP;

  -- 7) Consumo inmediato a grúa, o enlace del costo al primer movimiento de bodega
  IF p_crane_id IS NOT NULL THEN
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
      v_line_quantity := TRUNC((v_line->>'quantity')::numeric)::integer;
      v_line_unit_price := COALESCE((v_line->>'unit_price')::numeric, 0);
      v_line_total := COALESCE((v_line->>'total_amount')::numeric, 0);

      SELECT id INTO v_line_id FROM public.supplier_invoice_items
      WHERE supplier_invoice_id = v_invoice_id AND line_number = (v_line->>'line_number')::integer;

      INSERT INTO public.inventory_movements (
        item_id, location_id, movement_type, quantity, unit_cost, total_cost, crane_id,
        reference_document, observations, supplier_invoice_id, supplier_invoice_item_id, cost_id,
        status, created_by
      ) VALUES (
        (v_line->>'inventory_item_id')::uuid, p_location_id, 'exit', v_line_quantity,
        v_line_unit_price, v_line_total, p_crane_id, p_folio,
        'Consumo inmediato - ' || COALESCE(v_line->>'description', ''),
        v_invoice_id, v_line_id, v_cost_id, 'active', v_user_id
      ) RETURNING id INTO v_exit_movement_id;

      -- sync_inventory_exit_to_crane_parts_trigger ya creó la fila en crane_parts
      -- (con el costo de catálogo); la actualizamos con los valores reales de la factura.
      UPDATE public.crane_parts
      SET part_name = COALESCE(v_line->>'description', part_name),
          quantity = v_line_quantity,
          unit_price = v_line_unit_price,
          supplier_id = p_supplier_id,
          cost_id = v_cost_id,
          notes = 'Consumo inmediato desde factura XML ' || p_folio
      WHERE inventory_movement_id = v_exit_movement_id;

      v_movement_ids := array_append(v_movement_ids, v_exit_movement_id);
    END LOOP;

    UPDATE public.costs SET inventory_movement_id = v_first_entry_movement_id WHERE id = v_cost_id;
  ELSIF v_first_entry_movement_id IS NOT NULL THEN
    UPDATE public.costs SET inventory_movement_id = v_first_entry_movement_id WHERE id = v_cost_id;
  END IF;

  RETURN jsonb_build_object(
    'invoice_id', v_invoice_id,
    'cost_id', v_cost_id,
    'payment_id', v_payment_id,
    'movement_ids', to_jsonb(v_movement_ids),
    'line_ids', to_jsonb(v_line_ids)
  );
END;
$$;

ALTER FUNCTION public.import_xml_inventory_invoice(
  uuid, text, date, date, numeric, numeric, numeric, text, text, text, text, text, boolean,
  uuid, uuid, text, uuid, uuid, uuid, uuid, text, text, jsonb
) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.import_xml_inventory_invoice(
  uuid, text, date, date, numeric, numeric, numeric, text, text, text, text, text, boolean,
  uuid, uuid, text, uuid, uuid, uuid, uuid, text, text, jsonb
) TO authenticated;

COMMIT;
