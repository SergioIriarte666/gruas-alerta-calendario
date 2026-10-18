BEGIN;

ALTER TABLE public.supplier_invoice_items
  ADD COLUMN consumption_quantity integer,
  ADD COLUMN consumption_crane_id uuid REFERENCES public.cranes(id),
  ADD CONSTRAINT supplier_invoice_items_consumption_check CHECK (
    (consumption_quantity IS NULL AND consumption_crane_id IS NULL)
    OR (consumption_quantity IS NOT NULL AND consumption_quantity >= 0 AND consumption_quantity <= quantity
      AND ((consumption_quantity = 0 AND consumption_crane_id IS NULL)
        OR (consumption_quantity > 0 AND consumption_crane_id IS NOT NULL)))
  );

CREATE INDEX supplier_invoice_items_consumption_crane_idx
  ON public.supplier_invoice_items (consumption_crane_id)
  WHERE consumption_crane_id IS NOT NULL;

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
  v_consumption_quantity numeric;
  v_consumption_crane_id uuid;
  v_cost_crane_id uuid;
  v_all_consumed boolean := true;
  v_has_explicit_consumption boolean;
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

  SELECT bool_or(value ? 'consumption_quantity') INTO v_has_explicit_consumption
  FROM jsonb_array_elements(p_lines);

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    IF (v_line->>'quantity') IS NULL OR (v_line->>'quantity')::numeric <= 0
       OR (v_line->>'quantity')::numeric <> TRUNC((v_line->>'quantity')::numeric) THEN
      RAISE EXCEPTION 'Cantidad comprada inválida en línea %', v_line->>'line_number';
    END IF;

    IF v_has_explicit_consumption AND NOT (v_line ? 'consumption_quantity') THEN
      RAISE EXCEPTION 'Falta el destino de consumo en línea %', v_line->>'line_number';
    END IF;

    v_consumption_quantity := CASE WHEN v_has_explicit_consumption
      THEN (v_line->>'consumption_quantity')::numeric
      ELSE CASE WHEN p_crane_id IS NOT NULL THEN (v_line->>'quantity')::numeric ELSE 0 END END;
    v_consumption_crane_id := CASE WHEN v_has_explicit_consumption
      THEN NULLIF(v_line->>'consumption_crane_id', '')::uuid ELSE p_crane_id END;

    IF v_consumption_quantity IS NULL OR v_consumption_quantity < 0
       OR v_consumption_quantity <> TRUNC(v_consumption_quantity)
       OR v_consumption_quantity > (v_line->>'quantity')::numeric THEN
      RAISE EXCEPTION 'Cantidad a consumir inválida en línea %', v_line->>'line_number';
    END IF;
    IF v_consumption_quantity > 0 AND (v_consumption_crane_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.cranes WHERE id = v_consumption_crane_id
    )) THEN
      RAISE EXCEPTION 'Selecciona una grúa válida para consumir la línea %', v_line->>'line_number';
    END IF;
    IF v_consumption_quantity = 0 AND v_has_explicit_consumption AND v_consumption_crane_id IS NOT NULL THEN
      RAISE EXCEPTION 'Una línea sin consumo no puede tener grúa de destino';
    END IF;

    IF v_consumption_quantity <> (v_line->>'quantity')::numeric OR v_consumption_crane_id IS NULL THEN
      v_all_consumed := false;
    END IF;
    IF v_cost_crane_id IS NULL THEN
      v_cost_crane_id := v_consumption_crane_id;
    ELSIF v_cost_crane_id IS DISTINCT FROM v_consumption_crane_id THEN
      v_all_consumed := false;
    END IF;
  END LOOP;

  IF NOT v_all_consumed THEN v_cost_crane_id := NULL; END IF;

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

  -- 4) Costo (dispara create_supplier_payment_from_cost_trigger, que auto-crea el pago)
  INSERT INTO public.costs (
    amount, category_id, date, description, notes, document_type, document_number,
    crane_id, operator_id, immediate_consumption, payment_date, service_id, supplier_id,
    supplier_invoice_id, cost_center_id, service_folio, subcategory, created_by
  ) VALUES (
    p_total_amount, p_cost_category_id, p_issue_date, p_description, p_notes,
    COALESCE(p_document_type, 'Factura'), p_folio, v_cost_crane_id, p_operator_id,
    (v_cost_crane_id IS NOT NULL), CASE WHEN p_is_paid THEN p_issue_date ELSE NULL END,
    p_service_id, p_supplier_id, v_invoice_id, p_cost_center_id,
    COALESCE(p_service_folio, p_folio), COALESCE(p_cost_subcategory, 'Importación XML Bodega'), v_user_id
  ) RETURNING id INTO v_cost_id;

  -- 5) Completar el pago a proveedor auto-creado por el trigger del paso 4
  SELECT supplier_payment_id INTO v_payment_id FROM public.costs WHERE id = v_cost_id;

  IF v_payment_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo generar el pago a proveedor para la factura %', p_folio;
  END IF;

  UPDATE public.supplier_payments
  SET supplier_invoice_id = v_invoice_id,
      category = COALESCE((SELECT name FROM public.cost_categories WHERE id = p_cost_category_id), category),
      subcategory = COALESCE(p_cost_subcategory, 'Importación XML Bodega'),
      reference_number = p_folio,
      crane_id = v_cost_crane_id,
      add_to_inventory = false,
      part_name = p_description
  WHERE id = v_payment_id;

  -- 6) Líneas de factura + movimientos de entrada
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_quantity := TRUNC((v_line->>'quantity')::numeric)::integer;
    v_line_unit_price := COALESCE((v_line->>'unit_price')::numeric, 0);
    v_line_subtotal := COALESCE((v_line->>'subtotal')::numeric, 0);
    v_line_total := COALESCE((v_line->>'total_amount')::numeric, 0);

    INSERT INTO public.supplier_invoice_items (
      supplier_invoice_id, inventory_item_id, line_number, product_code, product_name, description,
      quantity, unit_price, subtotal, tax_rate, tax_amount, total_amount, created_by,
      consumption_quantity, consumption_crane_id
    ) VALUES (
      v_invoice_id, (v_line->>'inventory_item_id')::uuid, (v_line->>'line_number')::integer,
      NULLIF(v_line->>'product_code', ''), NULLIF(v_line->>'product_name', ''), v_line->>'description',
      v_line_quantity, v_line_unit_price, v_line_subtotal,
      COALESCE((v_line->>'tax_rate')::numeric, 0), COALESCE((v_line->>'tax_amount')::numeric, 0),
      v_line_total, v_user_id,
      CASE WHEN v_has_explicit_consumption THEN (v_line->>'consumption_quantity')::integer ELSE NULL END,
      CASE WHEN v_has_explicit_consumption THEN NULLIF(v_line->>'consumption_crane_id', '')::uuid ELSE NULL END
    ) RETURNING id INTO v_line_id;

    v_line_ids := array_append(v_line_ids, v_line_id);

    INSERT INTO public.inventory_movements (
      item_id, location_id, movement_type, quantity, unit_cost, total_cost, supplier_id,
      reference_document, observations, supplier_invoice_id, supplier_invoice_item_id, cost_id,
      movement_date, status, created_by
    ) VALUES (
      (v_line->>'inventory_item_id')::uuid, p_location_id, 'entry', v_line_quantity,
      CASE WHEN v_line_quantity > 0 THEN v_line_subtotal / v_line_quantity ELSE 0 END, v_line_subtotal,
      p_supplier_id, p_folio, 'Ingreso XML Bodega - ' || COALESCE(v_line->>'description', ''),
      v_invoice_id, v_line_id, v_cost_id,
      p_issue_date::timestamp AT TIME ZONE 'America/Santiago', 'active', v_user_id
    ) RETURNING id INTO v_movement_id;

    IF v_is_first_entry THEN
      v_first_entry_movement_id := v_movement_id;
      v_is_first_entry := false;
    END IF;

    v_movement_ids := array_append(v_movement_ids, v_movement_id);

    UPDATE public.supplier_invoice_items SET movement_id = v_movement_id WHERE id = v_line_id;

    v_consumption_quantity := CASE WHEN v_has_explicit_consumption
      THEN (v_line->>'consumption_quantity')::integer
      ELSE CASE WHEN p_crane_id IS NOT NULL THEN v_line_quantity ELSE 0 END END;
    v_consumption_crane_id := CASE WHEN v_has_explicit_consumption
      THEN NULLIF(v_line->>'consumption_crane_id', '')::uuid ELSE p_crane_id END;

    IF v_consumption_quantity > 0 THEN
      INSERT INTO public.inventory_movements (
        item_id, location_id, movement_type, quantity, unit_cost, total_cost, crane_id,
        movement_date, reference_document, observations, supplier_invoice_id, supplier_invoice_item_id,
        cost_id, status, created_by
      ) VALUES (
        (v_line->>'inventory_item_id')::uuid, p_location_id, 'exit', v_consumption_quantity,
        v_line_subtotal / v_line_quantity, v_line_subtotal * v_consumption_quantity / v_line_quantity,
        v_consumption_crane_id, p_issue_date::timestamp AT TIME ZONE 'America/Santiago', p_folio,
        'Consumo inmediato - ' || COALESCE(v_line->>'description', ''),
        v_invoice_id, v_line_id, v_cost_id, 'active', v_user_id
      ) RETURNING id INTO v_exit_movement_id;

      UPDATE public.crane_parts
      SET part_name = COALESCE(v_line->>'description', part_name),
          quantity = v_consumption_quantity,
          unit_price = v_line_subtotal / v_line_quantity,
          supplier_id = p_supplier_id,
          cost_id = v_cost_id,
          notes = 'Consumo inmediato desde factura XML ' || p_folio
      WHERE inventory_movement_id = v_exit_movement_id;

      INSERT INTO public.crane_parts (
        crane_id, part_name, date, quantity, unit_price, supplier_id, cost_id,
        inventory_movement_id, notes, created_by
      )
      SELECT v_consumption_crane_id, v_line->>'description', p_issue_date,
        v_consumption_quantity, v_line_subtotal / v_line_quantity, p_supplier_id, v_cost_id,
        v_exit_movement_id, 'Consumo inmediato desde factura XML ' || p_folio, v_user_id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.crane_parts WHERE inventory_movement_id = v_exit_movement_id
      );
      v_movement_ids := array_append(v_movement_ids, v_exit_movement_id);
    END IF;
  END LOOP;

  IF v_first_entry_movement_id IS NOT NULL THEN
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

CREATE OR REPLACE FUNCTION public.guard_xml_line_consumption_cost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.crane_id IS DISTINCT FROM OLD.crane_id
      OR NEW.immediate_consumption IS DISTINCT FROM OLD.immediate_consumption
      OR NEW.purchase_quantity IS DISTINCT FROM OLD.purchase_quantity
      OR NEW.purchase_unit_cost IS DISTINCT FROM OLD.purchase_unit_cost)
    AND EXISTS (
      SELECT 1 FROM public.supplier_invoice_items
      WHERE supplier_invoice_id = OLD.supplier_invoice_id AND consumption_quantity IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'Esta compra XML tiene destinos por producto. Gestiona sus movimientos desde Inventario; no se puede aplicar consumo a toda la factura desde Costos.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_xml_line_consumption_cost
BEFORE UPDATE ON public.costs
FOR EACH ROW EXECUTE FUNCTION public.guard_xml_line_consumption_cost();

COMMIT;

