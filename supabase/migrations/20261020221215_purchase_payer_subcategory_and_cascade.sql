-- Compras de Bodega (XML / foto / manual): quién paga, subcategoría y cascada de borrado.
--
-- (1) import_xml_inventory_invoice no recibía entity/paid_by: todo costo de compra
--     caía al default 'gruas_5_norte' aunque la compra fuera de LowBoy. Se agregan
--     p_entity y p_paid_by (mismos dos pagadores que el formulario de servicios y
--     register_manual_cost_purchase) y se escriben en public.costs.
-- (2) register_manual_inventory_purchase pasaba p_cost_subcategory => NULL fijo.
--     Ahora lee p_entity, p_paid_by y p_cost_subcategory_id desde p_data; valida la
--     subcategoría contra cost_subcategories (misma categoría, activa) y la usa como
--     subcategoría por defecto de los productos que no traen una propia: la
--     consolidación por línea de import_xml_inventory_invoice sigue mandando.
--     La idempotencia no cambia: v_payload se arma con el p_data recibido, así que
--     una compra registrada con payload antiguo devuelve su mismo resultado.
-- (3) sync_cost_deletion_cascade borraba pagos, cancelaba movimientos y borraba
--     repuestos, pero dejaba viva la fila de supplier_invoices y el registro de
--     idempotencia en manual_purchase_registrations. Caso real 20-10-2026, factura
--     127435 Tremac: al eliminar el costo quedó la factura huérfana y el RPC bloqueó
--     el reingreso ("ya está registrada" / "el costo asociado fue eliminado").
--     La factura NO puede borrarse en el BEFORE DELETE: la FK costs.supplier_invoice_id
--     es ON DELETE SET NULL y su acción actualizaría la misma fila que se está
--     borrando (ERROR 27000 "tuple to be deleted was already modified", mismo patrón
--     de 20260725100000). Por eso la misma función corre también como AFTER DELETE
--     (TG_WHEN) y ahí borra la factura, si ningún otro costo la referencia, y los
--     registros de compra manual del costo. supplier_invoice_items y
--     scheduled_payments caen por FK ON DELETE CASCADE; supplier_payments e
--     inventory_movements son SET NULL y ya los maneja la fase BEFORE.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) import_xml_inventory_invoice: + p_entity, p_paid_by
-- ---------------------------------------------------------------------------
DROP FUNCTION public.import_xml_inventory_invoice(uuid, text, date, date, numeric, numeric, numeric, text, text, text, text, text, boolean, uuid, uuid, text, uuid, uuid, uuid, uuid, text, text, jsonb, date, text);

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
  p_lines jsonb,
  p_payment_date date DEFAULT NULL,
  p_payment_reference text DEFAULT NULL,
  p_entity text DEFAULT 'gruas_5_norte',
  p_paid_by text DEFAULT 'gruas_5_norte'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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
  v_has_line_classification boolean;
  v_subcategory_id uuid;
  v_subcategory_name text;
  v_consolidated_subcategory text;
  v_classified_lines jsonb := '[]'::jsonb;
BEGIN
  IF NOT (public.has_role(v_user_id, 'admin'::app_role) OR public.has_role(v_user_id, 'operator'::app_role)) THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol admin u operator para importar facturas XML de bodega';
  END IF;

  IF COALESCE(p_entity, '') NOT IN ('gruas_5_norte', 'lowboy') OR COALESCE(p_paid_by, '') NOT IN ('gruas_5_norte', 'lowboy') THEN
    RAISE EXCEPTION 'Selecciona las empresas dueña y financiadora del gasto';
  END IF;

  IF p_is_paid AND NULLIF(BTRIM(p_payment_reference), '') IS NOT NULL THEN
    p_notes := CONCAT_WS(' | ', NULLIF(p_notes, ''), 'Referencia de pago: ' || BTRIM(p_payment_reference));
  END IF;

  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'La factura no tiene líneas para importar';
  END IF;

  SELECT bool_or(value ? 'consumption_quantity') INTO v_has_explicit_consumption
  FROM jsonb_array_elements(p_lines);

  SELECT bool_or(value ? 'cost_subcategory_id') INTO v_has_line_classification
  FROM jsonb_array_elements(p_lines);

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_subcategory_id := NULL;
    v_subcategory_name := NULL;
    IF v_has_line_classification THEN
      IF NOT (v_line ? 'cost_subcategory_id') THEN
        RAISE EXCEPTION 'Falta la subcategoría del producto en línea %', v_line->>'line_number';
      END IF;
      v_subcategory_id := NULLIF(v_line->>'cost_subcategory_id', '')::uuid;
      IF v_subcategory_id IS NOT NULL THEN
        SELECT name INTO v_subcategory_name FROM public.cost_subcategories
        WHERE id = v_subcategory_id AND category_id = p_cost_category_id AND is_active = true;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'La subcategoría de la línea % no pertenece a la categoría seleccionada o no está activa', v_line->>'line_number';
        END IF;
      END IF;
    END IF;
    v_classified_lines := v_classified_lines || jsonb_build_array(
      v_line || jsonb_build_object('cost_subcategory_id', v_subcategory_id,
        'cost_subcategory', CASE WHEN v_has_line_classification THEN COALESCE(v_subcategory_name, '') ELSE NULL END)
    );
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

  IF v_has_line_classification THEN
    SELECT CASE WHEN COUNT(DISTINCT COALESCE(value->>'cost_subcategory_id', 'none')) = 1
      THEN NULLIF(MAX(value->>'cost_subcategory'), '') ELSE NULL END
    INTO v_consolidated_subcategory FROM jsonb_array_elements(v_classified_lines);
  ELSE
    v_consolidated_subcategory := COALESCE(p_cost_subcategory, 'Importación XML Bodega');
  END IF;
  p_lines := v_classified_lines;

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
    supplier_invoice_id, cost_center_id, service_folio, subcategory, created_by, entity, paid_by
  ) VALUES (
    p_total_amount, p_cost_category_id, p_issue_date, p_description, p_notes,
    COALESCE(p_document_type, 'Factura'), p_folio, v_cost_crane_id, p_operator_id,
    (v_cost_crane_id IS NOT NULL), CASE WHEN p_is_paid THEN COALESCE(p_payment_date, p_issue_date) ELSE NULL END,
    p_service_id, p_supplier_id, v_invoice_id, p_cost_center_id,
    COALESCE(p_service_folio, p_folio), v_consolidated_subcategory, v_user_id, p_entity, p_paid_by
  ) RETURNING id INTO v_cost_id;

  -- 5) Completar el pago a proveedor auto-creado por el trigger del paso 4
  SELECT supplier_payment_id INTO v_payment_id FROM public.costs WHERE id = v_cost_id;

  IF v_payment_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo generar el pago a proveedor para la factura %', p_folio;
  END IF;

  UPDATE public.supplier_payments
  SET supplier_invoice_id = v_invoice_id,
      due_date = COALESCE(p_due_date, p_issue_date),
      paid_date = CASE WHEN p_is_paid THEN COALESCE(p_payment_date, p_issue_date) ELSE NULL END,
      paid_amount = CASE WHEN p_is_paid THEN p_total_amount ELSE 0 END,
      status = CASE WHEN p_is_paid THEN 'paid' ELSE 'pending' END,
      notes = p_notes,
      category = COALESCE((SELECT name FROM public.cost_categories WHERE id = p_cost_category_id), category),
      subcategory = v_consolidated_subcategory,
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
      consumption_quantity, consumption_crane_id, cost_subcategory_id, cost_subcategory
    ) VALUES (
      v_invoice_id, (v_line->>'inventory_item_id')::uuid, (v_line->>'line_number')::integer,
      NULLIF(v_line->>'product_code', ''), NULLIF(v_line->>'product_name', ''), v_line->>'description',
      v_line_quantity, v_line_unit_price, v_line_subtotal,
      COALESCE((v_line->>'tax_rate')::numeric, 0), COALESCE((v_line->>'tax_amount')::numeric, 0),
      v_line_total, v_user_id,
      CASE WHEN v_has_explicit_consumption THEN (v_line->>'consumption_quantity')::integer ELSE NULL END,
      CASE WHEN v_has_explicit_consumption THEN NULLIF(v_line->>'consumption_crane_id', '')::uuid ELSE NULL END,
      NULLIF(v_line->>'cost_subcategory_id', '')::uuid, v_line->>'cost_subcategory'
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


REVOKE ALL ON FUNCTION public.import_xml_inventory_invoice(uuid, text, date, date, numeric, numeric, numeric, text, text, text, text, text, boolean, uuid, uuid, text, uuid, uuid, uuid, uuid, text, text, jsonb, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_xml_inventory_invoice(uuid, text, date, date, numeric, numeric, numeric, text, text, text, text, text, boolean, uuid, uuid, text, uuid, uuid, uuid, uuid, text, text, jsonb, date, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) register_manual_inventory_purchase: p_entity, p_paid_by, p_cost_subcategory_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_manual_inventory_purchase(
  p_request_id uuid, p_data jsonb, p_receipt_path text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_previous public.manual_purchase_registrations;
  v_payload jsonb := jsonb_build_object('data', p_data, 'receipt', p_receipt_path);
  v_result jsonb;
  v_supplier uuid := (p_data->>'p_supplier_id')::uuid;
  v_folio text := btrim(p_data->>'p_folio');
  v_entity text := coalesce(nullif(p_data->>'p_entity', ''), 'gruas_5_norte');
  v_paid_by text := coalesce(nullif(p_data->>'p_paid_by', ''), 'gruas_5_norte');
  v_category uuid := nullif(p_data->>'p_cost_category_id', '')::uuid;
  v_subcategory uuid;
  v_subcategory_name text;
  v_lines jsonb;
  v_net numeric;
  v_vat numeric;
  v_total numeric;
  v_line jsonb;
  v_line_net numeric;
  v_net_sum numeric := 0;
  v_vat_sum numeric := 0;
BEGIN
  IF v_user IS NULL OR NOT (public.has_role(v_user, 'admin'::public.app_role) OR public.has_role(v_user, 'operator'::public.app_role)) THEN
    RAISE EXCEPTION 'No autorizado para registrar compras';
  END IF;
  IF p_request_id IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Solicitud de compra inválida'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  SELECT * INTO v_previous FROM public.manual_purchase_registrations WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_previous.created_by IS DISTINCT FROM v_user OR v_previous.payload IS DISTINCT FROM v_payload THEN
      RAISE EXCEPTION 'La solicitud ya fue utilizada con otros datos. Revisa la compra registrada';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.costs WHERE id = (v_previous.result->>'cost_id')::uuid) THEN
      RAISE EXCEPTION 'El costo asociado fue eliminado. Requiere revisión antes de registrar nuevamente';
    END IF;
    RETURN v_previous.result;
  END IF;
  IF v_supplier IS NULL OR v_folio IS NULL OR v_folio !~ '^[0-9]{1,20}$' OR ltrim(v_folio, '0') = '' OR NOT EXISTS (SELECT 1 FROM public.inventory_suppliers WHERE id = v_supplier) THEN
    RAISE EXCEPTION 'Proveedor o folio inválido';
  END IF;
  IF v_entity NOT IN ('gruas_5_norte', 'lowboy') OR v_paid_by NOT IN ('gruas_5_norte', 'lowboy') THEN
    RAISE EXCEPTION 'Selecciona las empresas dueña y financiadora del gasto';
  END IF;
  IF v_category IS NULL OR NOT EXISTS (SELECT 1 FROM public.cost_categories WHERE id = v_category) THEN
    RAISE EXCEPTION 'Selecciona una categoría de costo válida';
  END IF;
  v_subcategory := nullif(p_data->>'p_cost_subcategory_id', '')::uuid;
  IF v_subcategory IS NOT NULL THEN
    SELECT name INTO v_subcategory_name FROM public.cost_subcategories
    WHERE id = v_subcategory AND category_id = v_category AND is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'La subcategoría no pertenece a la categoría seleccionada o no está activa'; END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_supplier::text || ':' || ltrim(v_folio, '0'), 0));
  IF EXISTS (SELECT 1 FROM public.supplier_invoices WHERE supplier_id = v_supplier AND ltrim(invoice_number, '0') = ltrim(v_folio, '0'))
     OR EXISTS (SELECT 1 FROM public.costs WHERE supplier_id = v_supplier AND (ltrim(document_number, '0') = ltrim(v_folio, '0') OR ltrim(service_folio, '0') = ltrim(v_folio, '0'))) THEN
    RAISE EXCEPTION 'La factura % ya está registrada para ese proveedor. No se creó otra compra', v_folio;
  END IF;
  IF jsonb_typeof(p_data->'p_lines') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Faltan los productos de la compra'; END IF;
  IF jsonb_array_length(p_data->'p_lines') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Ingresa entre 1 y 100 productos'; END IF;
  IF jsonb_typeof(p_data->'p_net_amount') IS DISTINCT FROM 'number' OR jsonb_typeof(p_data->'p_vat_amount') IS DISTINCT FROM 'number' OR jsonb_typeof(p_data->'p_total_amount') IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION 'Los totales deben ser números válidos';
  END IF;
  v_net := (p_data->>'p_net_amount')::numeric;
  v_vat := (p_data->>'p_vat_amount')::numeric;
  v_total := (p_data->>'p_total_amount')::numeric;
  IF v_net < 0 OR v_vat < 0 OR v_total <= 0 OR abs(v_net + v_vat - v_total) > 1 THEN RAISE EXCEPTION 'El neto, IVA y total no cuadran'; END IF;
  IF nullif(p_data->>'p_issue_date', '') IS NULL OR coalesce(p_data->>'p_currency', 'CLP') <> 'CLP' THEN RAISE EXCEPTION 'Revisa la fecha de emisión y la moneda CLP'; END IF;
  IF (p_data->>'p_due_date')::date < (p_data->>'p_issue_date')::date THEN RAISE EXCEPTION 'El vencimiento no puede ser anterior a la emisión'; END IF;
  IF coalesce((p_data->>'p_is_paid')::boolean, false) AND nullif(p_data->>'p_payment_date', '') IS NULL THEN RAISE EXCEPTION 'Falta la fecha real de pago'; END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_data->'p_lines') LOOP
    IF jsonb_typeof(v_line->'quantity') IS DISTINCT FROM 'number' OR jsonb_typeof(v_line->'unit_price') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_line->'subtotal') IS DISTINCT FROM 'number' OR jsonb_typeof(v_line->'tax_amount') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_line->'total_amount') IS DISTINCT FROM 'number' OR jsonb_typeof(v_line->'tax_rate') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Revisa cantidades, precios y montos de los productos';
    END IF;
    IF coalesce(btrim(v_line->>'description'), '') = '' OR (v_line->>'quantity')::numeric NOT BETWEEN 1 AND 2147483647
       OR (v_line->>'quantity')::numeric <> trunc((v_line->>'quantity')::numeric) OR (v_line->>'unit_price')::numeric < 0
       OR (v_line->>'tax_rate')::numeric NOT IN (0, 19) THEN RAISE EXCEPTION 'Producto inválido: revisa descripción, cantidad, precio neto e IVA'; END IF;
    v_line_net := (v_line->>'subtotal')::numeric;
    IF abs(v_line_net - (v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric) > 0.02
       OR abs((v_line->>'tax_amount')::numeric - v_line_net * (v_line->>'tax_rate')::numeric / 100) > 0.02
       OR abs((v_line->>'total_amount')::numeric - v_line_net - (v_line->>'tax_amount')::numeric) > 0.02 THEN
      RAISE EXCEPTION 'Los importes del producto no cuadran con su cantidad, precio e IVA';
    END IF;
    v_net_sum := v_net_sum + v_line_net;
    v_vat_sum := v_vat_sum + (v_line->>'tax_amount')::numeric;
  END LOOP;
  IF abs(round(v_net_sum) - v_net) > 1 OR abs(round(v_vat_sum) - v_vat) > 1 THEN RAISE EXCEPTION 'Los productos no cuadran con el neto e IVA del comprobante'; END IF;
  IF p_receipt_path IS NOT NULL THEN
    IF p_receipt_path <> v_user::text || '/manual-purchases/' || p_request_id::text || '.jpg'
       OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'quick-entry-photos' AND name = p_receipt_path) THEN
      RAISE EXCEPTION 'La foto de respaldo debe estar guardada bajo tu usuario antes de registrar';
    END IF;
  END IF;
  -- La subcategoría de cabecera es el valor por defecto de los productos sin una propia;
  -- la consolidación por línea de import_xml_inventory_invoice decide la del costo.
  SELECT jsonb_agg(
    CASE WHEN v_subcategory IS NOT NULL AND nullif(value->>'cost_subcategory_id', '') IS NULL
      THEN value || jsonb_build_object('cost_subcategory_id', v_subcategory) ELSE value END
    ORDER BY ordinality)
  INTO v_lines FROM jsonb_array_elements(p_data->'p_lines') WITH ORDINALITY;
  v_result := public.import_xml_inventory_invoice(
    p_supplier_id => v_supplier, p_folio => v_folio, p_issue_date => (p_data->>'p_issue_date')::date,
    p_due_date => (p_data->>'p_due_date')::date, p_total_amount => v_total, p_net_amount => v_net, p_vat_amount => v_vat,
    p_currency => 'CLP', p_document_type => 'Factura', p_description => p_data->>'p_description',
    p_product_service_description => p_data->>'p_product_service_description', p_xml_file_name => NULL,
    p_is_paid => coalesce((p_data->>'p_is_paid')::boolean, false), p_location_id => (p_data->>'p_location_id')::uuid,
    p_cost_category_id => v_category, p_cost_subcategory => v_subcategory_name,
    p_cost_center_id => (p_data->>'p_cost_center_id')::uuid, p_crane_id => NULL,
    p_operator_id => (p_data->>'p_operator_id')::uuid, p_service_id => (p_data->>'p_service_id')::uuid,
    p_service_folio => p_data->>'p_service_folio', p_notes => p_data->>'p_notes', p_lines => v_lines,
    p_payment_date => (p_data->>'p_payment_date')::date, p_payment_reference => p_data->>'p_payment_reference',
    p_entity => v_entity, p_paid_by => v_paid_by
  );
  UPDATE public.supplier_invoices SET source_module = CASE WHEN p_receipt_path IS NULL THEN 'inventory_manual' ELSE 'inventory_photo' END
    WHERE id = (v_result->>'invoice_id')::uuid;
  IF p_receipt_path IS NOT NULL THEN
    PERFORM set_config('app.bidirectional_sync', 'true', true);
    PERFORM set_config('app.sync_in_progress', 'true', true);
    UPDATE public.costs SET receipt_photo_paths = ARRAY[p_receipt_path] WHERE id = (v_result->>'cost_id')::uuid;
    UPDATE public.inventory_movements SET receipt_photo_paths = ARRAY[p_receipt_path] WHERE cost_id = (v_result->>'cost_id')::uuid;
  END IF;
  INSERT INTO public.manual_purchase_registrations(request_id, created_by, payload, result) VALUES (p_request_id, v_user, v_payload, v_result);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.register_manual_inventory_purchase(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_manual_inventory_purchase(uuid, jsonb, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) sync_cost_deletion_cascade: BEFORE (pagos, movimientos, repuestos) + AFTER
--    (factura de proveedor huérfana y registros de compra manual)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_cost_deletion_cascade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  -- La factura se va con el costo sólo si ningún otro costo la referencia.
  v_drop_invoice boolean := OLD.supplier_invoice_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.costs WHERE supplier_invoice_id = OLD.supplier_invoice_id AND id <> OLD.id
  );
BEGIN
  PERFORM set_config('app.cascade_delete', 'true', true);

  IF TG_WHEN = 'BEFORE' THEN
    DELETE FROM public.supplier_payments
    WHERE id = OLD.supplier_payment_id
       OR cost_id = OLD.id;

    -- Si la factura se borrará en la fase AFTER, los movimientos quedan desvinculados
    -- aquí, en el mismo UPDATE que los cancela: no se depende del orden en que
    -- Postgres ejecute las acciones SET NULL de las FKs a la factura y a sus líneas.
    UPDATE public.inventory_movements
    SET status = 'cancelled',
        observations = COALESCE(observations, '') || ' [Costo eliminado]',
        supplier_invoice_id = CASE WHEN v_drop_invoice THEN NULL ELSE supplier_invoice_id END,
        supplier_invoice_item_id = CASE WHEN v_drop_invoice THEN NULL ELSE supplier_invoice_item_id END
    WHERE cost_id = OLD.id;

    DELETE FROM public.crane_parts
    WHERE cost_id = OLD.id;

    RETURN OLD;
  END IF;

  -- Fase AFTER: la fila de costs ya no existe, así que la acción SET NULL de la FK
  -- costs.supplier_invoice_id no toca la fila en borrado.
  DELETE FROM public.manual_purchase_registrations
  WHERE result->>'cost_id' = OLD.id::text;

  IF v_drop_invoice THEN
    DELETE FROM public.supplier_invoices WHERE id = OLD.supplier_invoice_id;
  END IF;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.sync_cost_deletion_cascade() IS
  'Cascada al borrar un costo. BEFORE: pagos a proveedor, movimientos (cancelados) y repuestos. AFTER: factura de proveedor sin otros costos y registros de compra manual (idempotencia). La factura se borra en AFTER porque la FK SET NULL de costs.supplier_invoice_id tocaría la fila en borrado (ERROR 27000).';

-- Función de trigger SECURITY DEFINER: sin EXECUTE a roles de cliente
-- (misma política que 20260725100000_fix_cascade_delete_guard_supplier_payment).
REVOKE ALL ON FUNCTION public.sync_cost_deletion_cascade() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_cost_deletion_cascade_after_trigger ON public.costs;
CREATE TRIGGER sync_cost_deletion_cascade_after_trigger
  AFTER DELETE ON public.costs
  FOR EACH ROW EXECUTE FUNCTION public.sync_cost_deletion_cascade();

COMMIT;
