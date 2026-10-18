BEGIN;

CREATE OR REPLACE FUNCTION public.register_manual_cost_purchase(
  p_request_id uuid, p_data jsonb, p_receipt_path text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_previous public.manual_purchase_registrations;
  v_payload jsonb := jsonb_build_object('module', 'costs', 'data', p_data, 'receipt', p_receipt_path);
  v_result jsonb;
  v_supplier uuid;
  v_supplier_ids uuid[];
  v_rut text := upper(regexp_replace(p_data->>'supplier_rut', '[^0-9kK]', '', 'g'));
  v_rut_sum integer := 0;
  v_rut_digit integer;
  v_index integer;
  v_folio text := btrim(p_data->>'folio');
  v_category uuid := nullif(p_data->>'category_id', '')::uuid;
  v_category_name text;
  v_subcategory uuid;
  v_subcategory_name text;
  v_consolidated_subcategory text;
  v_classified jsonb := '[]'::jsonb;
  v_line jsonb;
  v_line_net numeric;
  v_net_sum numeric := 0;
  v_vat_sum numeric := 0;
  v_net numeric;
  v_vat numeric;
  v_total numeric;
  v_issue date := (p_data->>'issue_date')::date;
  v_due date := coalesce(nullif(p_data->>'due_date', '')::date, v_issue);
  v_paid boolean := coalesce((p_data->>'is_paid')::boolean, false);
  v_payment_date date;
  v_invoice uuid;
  v_cost uuid;
  v_payment uuid;
  v_notes text;
  v_old_sync text := coalesce(current_setting('app.sync_in_progress', true), 'false');
  v_old_bidirectional text := coalesce(current_setting('app.bidirectional_sync', true), 'false');
BEGIN
  IF v_user IS NULL OR NOT (public.has_role(v_user, 'admin'::public.app_role) OR public.has_role(v_user, 'operator'::public.app_role)) THEN
    RAISE EXCEPTION 'No autorizado para registrar costos';
  END IF;
  IF p_request_id IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Solicitud de costo inválida'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  SELECT * INTO v_previous FROM public.manual_purchase_registrations WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_previous.created_by IS DISTINCT FROM v_user OR v_previous.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'La solicitud ya fue utilizada con otros datos. Revisa el costo registrado'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.costs WHERE id = (v_previous.result->>'cost_id')::uuid) THEN RAISE EXCEPTION 'El costo asociado fue eliminado. Requiere revisión antes de registrar nuevamente'; END IF;
    RETURN v_previous.result;
  END IF;
  IF v_rut IS NULL OR v_rut !~ '^[0-9]{7,8}[0-9K]$' OR coalesce(btrim(p_data->>'supplier_name'), '') = '' OR length(p_data->>'supplier_name') > 200 THEN RAISE EXCEPTION 'Revisa nombre y RUT del proveedor'; END IF;
  FOR v_index IN 1..length(v_rut) - 1 LOOP
    v_rut_sum := v_rut_sum + substring(v_rut, length(v_rut) - v_index, 1)::integer * (2 + (v_index - 1) % 6);
  END LOOP;
  v_rut_digit := 11 - v_rut_sum % 11;
  IF right(v_rut, 1) <> (CASE v_rut_digit WHEN 11 THEN '0' WHEN 10 THEN 'K' ELSE v_rut_digit::text END) THEN RAISE EXCEPTION 'El dígito verificador del RUT no es válido'; END IF;
  IF v_folio IS NULL OR v_folio !~ '^[0-9]{1,20}$' OR ltrim(v_folio, '0') = '' THEN RAISE EXCEPTION 'Indica un folio numérico válido'; END IF;
  IF v_issue IS NULL OR coalesce(p_data->>'issue_date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     OR (nullif(p_data->>'due_date', '') IS NOT NULL AND p_data->>'due_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') OR v_due < v_issue THEN RAISE EXCEPTION 'Revisa emisión y vencimiento'; END IF;
  IF v_paid THEN
    v_payment_date := nullif(p_data->>'payment_date', '')::date;
    IF v_payment_date IS NULL OR p_data->>'payment_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Falta la fecha real de pago válida'; END IF;
  END IF;
  IF coalesce(p_data->>'entity', '') NOT IN ('gruas_5_norte', 'lowboy') OR coalesce(p_data->>'paid_by', '') NOT IN ('gruas_5_norte', 'lowboy') THEN RAISE EXCEPTION 'Selecciona las empresas dueña y financiadora del gasto'; END IF;
  SELECT name INTO v_category_name FROM public.cost_categories WHERE id = v_category;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selecciona una categoría de costo válida'; END IF;
  IF coalesce(btrim(p_data->>'description'), '') = '' OR length(p_data->>'description') > 500 THEN RAISE EXCEPTION 'Indica una glosa de hasta 500 caracteres'; END IF;
  IF jsonb_typeof(p_data->'net_amount') IS DISTINCT FROM 'number' OR jsonb_typeof(p_data->'vat_amount') IS DISTINCT FROM 'number' OR jsonb_typeof(p_data->'total_amount') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Los totales deben ser números válidos'; END IF;
  v_net := (p_data->>'net_amount')::numeric; v_vat := (p_data->>'vat_amount')::numeric; v_total := (p_data->>'total_amount')::numeric;
  IF v_net < 0 OR v_vat < 0 OR v_total <= 0 OR abs(v_net + v_vat - v_total) > 1 THEN RAISE EXCEPTION 'El neto, IVA y total no cuadran'; END IF;
  IF jsonb_typeof(p_data->'lines') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'El detalle debe ser una lista, aunque esté vacía'; END IF;
  IF jsonb_array_length(p_data->'lines') > 100 THEN RAISE EXCEPTION 'Ingresa hasta 100 productos'; END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_data->'lines') LOOP
    IF jsonb_typeof(v_line->'quantity') IS DISTINCT FROM 'number' OR jsonb_typeof(v_line->'unit_price') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_line->'subtotal') IS DISTINCT FROM 'number' OR jsonb_typeof(v_line->'tax_amount') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_line->'total_amount') IS DISTINCT FROM 'number' OR jsonb_typeof(v_line->'tax_rate') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Revisa cantidades, precios y montos de los productos'; END IF;
    IF coalesce(btrim(v_line->>'description'), '') = '' OR (v_line->>'quantity')::numeric NOT BETWEEN 1 AND 2147483647
       OR (v_line->>'quantity')::numeric <> trunc((v_line->>'quantity')::numeric) OR (v_line->>'unit_price')::numeric < 0
       OR (v_line->>'tax_rate')::numeric NOT IN (0, 19) THEN RAISE EXCEPTION 'Producto inválido: revisa descripción, cantidad, precio neto e IVA'; END IF;
    v_line_net := (v_line->>'subtotal')::numeric;
    IF abs(v_line_net - (v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric) > 0.02
       OR abs((v_line->>'tax_amount')::numeric - v_line_net * (v_line->>'tax_rate')::numeric / 100) > 0.02
       OR abs((v_line->>'total_amount')::numeric - v_line_net - (v_line->>'tax_amount')::numeric) > 0.02 THEN RAISE EXCEPTION 'Los importes del producto no cuadran con cantidad, precio e IVA'; END IF;
    v_net_sum := v_net_sum + v_line_net; v_vat_sum := v_vat_sum + (v_line->>'tax_amount')::numeric;
    v_subcategory := nullif(v_line->>'cost_subcategory_id', '')::uuid;
    v_subcategory_name := NULL;
    IF v_subcategory IS NOT NULL THEN
      SELECT name INTO v_subcategory_name FROM public.cost_subcategories WHERE id = v_subcategory AND category_id = v_category AND is_active;
      IF NOT FOUND THEN RAISE EXCEPTION 'La subcategoría no pertenece a la categoría o está inactiva'; END IF;
    END IF;
    v_classified := v_classified || jsonb_build_array(v_line || jsonb_build_object('cost_subcategory_id', v_subcategory, 'cost_subcategory', coalesce(v_subcategory_name, '')));
  END LOOP;
  IF jsonb_array_length(v_classified) > 0 THEN
    IF abs(round(v_net_sum) - v_net) > 1 OR abs(round(v_vat_sum) - v_vat) > 1 THEN RAISE EXCEPTION 'Los productos no cuadran con el neto e IVA del comprobante'; END IF;
    SELECT CASE WHEN count(DISTINCT value->>'cost_subcategory') = 1 THEN nullif(min(value->>'cost_subcategory'), '') ELSE NULL END INTO v_consolidated_subcategory FROM jsonb_array_elements(v_classified);
  ELSE
    v_subcategory := nullif(p_data->>'header_subcategory_id', '')::uuid;
    IF v_subcategory IS NOT NULL THEN
      SELECT name INTO v_consolidated_subcategory FROM public.cost_subcategories WHERE id = v_subcategory AND category_id = v_category AND is_active;
      IF NOT FOUND THEN RAISE EXCEPTION 'La subcategoría no pertenece a la categoría o está inactiva'; END IF;
    END IF;
  END IF;
  IF p_receipt_path IS NOT NULL AND (p_receipt_path <> v_user::text || '/manual-purchases/' || p_request_id::text || '.jpg'
     OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'quick-entry-photos' AND name = p_receipt_path)) THEN RAISE EXCEPTION 'La foto de respaldo debe estar guardada bajo tu usuario antes de registrar'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('manual-cost-supplier:' || v_rut, 0));
  SELECT id INTO v_supplier FROM public.inventory_suppliers WHERE upper(regexp_replace(rut, '[^0-9kK]', '', 'g')) = v_rut ORDER BY id LIMIT 1;
  IF v_supplier IS NULL THEN
    INSERT INTO public.inventory_suppliers(name, rut, is_active, created_by) VALUES (btrim(p_data->>'supplier_name'), left(v_rut, length(v_rut) - 1) || '-' || right(v_rut, 1), true, v_user) RETURNING id INTO v_supplier;
  ELSIF coalesce((p_data->>'confirm_supplier_name')::boolean, false) THEN
    UPDATE public.inventory_suppliers SET name = btrim(p_data->>'supplier_name') WHERE id = v_supplier;
  END IF;
  SELECT array_agg(id) INTO v_supplier_ids FROM public.inventory_suppliers WHERE upper(regexp_replace(rut, '[^0-9kK]', '', 'g')) = v_rut;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_supplier::text || ':' || ltrim(v_folio, '0'), 0));
  IF EXISTS (SELECT 1 FROM public.supplier_invoices WHERE supplier_id = ANY(v_supplier_ids) AND ltrim(invoice_number, '0') = ltrim(v_folio, '0'))
     OR EXISTS (SELECT 1 FROM public.costs WHERE supplier_id = ANY(v_supplier_ids) AND (ltrim(document_number, '0') = ltrim(v_folio, '0') OR ltrim(service_folio, '0') = ltrim(v_folio, '0')))
     OR EXISTS (SELECT 1 FROM public.supplier_payments WHERE supplier_id = ANY(v_supplier_ids) AND ltrim(reference_number, '0') = ltrim(v_folio, '0')) THEN RAISE EXCEPTION 'La factura % ya está registrada para ese proveedor. No se creó otro costo', v_folio; END IF;
  PERFORM set_config('app.bidirectional_sync', 'true', true);
  PERFORM set_config('app.sync_in_progress', 'true', true);
  v_notes := concat_ws(' | ', CASE WHEN jsonb_array_length(v_classified) = 0 THEN 'Comprobante sin detalle de productos' END,
    CASE WHEN v_paid AND nullif(btrim(p_data->>'payment_reference'), '') IS NOT NULL THEN 'Referencia de pago: ' || btrim(p_data->>'payment_reference') END);
  INSERT INTO public.supplier_invoices(supplier_id, invoice_number, issue_date, due_date, amount, net_amount, tax_amount, currency, description, status, paid_amount, source_module)
  VALUES (v_supplier, v_folio, v_issue, v_due, v_total, v_net, v_vat, 'CLP', btrim(p_data->>'description'), CASE WHEN v_paid THEN 'paid' ELSE 'pending' END, CASE WHEN v_paid THEN v_total ELSE 0 END, CASE WHEN p_receipt_path IS NULL THEN 'costs_manual' ELSE 'costs_photo' END) RETURNING id INTO v_invoice;
  INSERT INTO public.costs(amount, category_id, date, description, notes, document_type, document_number, crane_id, immediate_consumption, purchase_quantity, purchase_unit_cost,
    payment_date, supplier_id, supplier_invoice_id, cost_center_id, service_folio, subcategory, created_by, entity, paid_by, receipt_photo_paths)
  VALUES (v_total, v_category, v_issue, btrim(p_data->>'description'), nullif(v_notes, ''), 'Factura', v_folio, nullif(p_data->>'crane_id', '')::uuid, false, NULL, NULL,
    v_payment_date, v_supplier, v_invoice, nullif(p_data->>'cost_center_id', '')::uuid, v_folio, v_consolidated_subcategory, v_user, p_data->>'entity', p_data->>'paid_by', CASE WHEN p_receipt_path IS NULL THEN NULL ELSE ARRAY[p_receipt_path] END) RETURNING id INTO v_cost;
  INSERT INTO public.supplier_payments(supplier_id, cost_id, supplier_invoice_id, reference_number, amount, description, category, subcategory, due_date, status, paid_date, paid_amount, notes, crane_id, add_to_inventory, created_by)
  VALUES (v_supplier, v_cost, v_invoice, v_folio, v_total, btrim(p_data->>'description'), v_category_name, v_consolidated_subcategory, v_due, CASE WHEN v_paid THEN 'paid' ELSE 'pending' END,
    v_payment_date, CASE WHEN v_paid THEN v_total ELSE 0 END, nullif(v_notes, ''), nullif(p_data->>'crane_id', '')::uuid, false, v_user) RETURNING id INTO v_payment;
  UPDATE public.costs SET supplier_payment_id = v_payment WHERE id = v_cost;
  v_index := 0;
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_classified) LOOP
    v_index := v_index + 1;
    INSERT INTO public.supplier_invoice_items(supplier_invoice_id, inventory_item_id, line_number, product_code, product_name, description, quantity, unit_price, subtotal, tax_rate, tax_amount, total_amount,
      created_by, cost_subcategory_id, cost_subcategory)
    VALUES (v_invoice, NULL, v_index, nullif(v_line->>'product_code', ''), v_line->>'description', v_line->>'description', (v_line->>'quantity')::numeric::integer, (v_line->>'unit_price')::numeric,
      (v_line->>'subtotal')::numeric, (v_line->>'tax_rate')::numeric, (v_line->>'tax_amount')::numeric, (v_line->>'total_amount')::numeric, v_user, (v_line->>'cost_subcategory_id')::uuid, v_line->>'cost_subcategory');
  END LOOP;
  v_result := jsonb_build_object('invoice_id', v_invoice, 'cost_id', v_cost, 'payment_id', v_payment);
  INSERT INTO public.manual_purchase_registrations(request_id, created_by, payload, result) VALUES (p_request_id, v_user, v_payload, v_result);
  PERFORM set_config('app.bidirectional_sync', v_old_bidirectional, true);
  PERFORM set_config('app.sync_in_progress', v_old_sync, true);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.register_manual_cost_purchase(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_manual_cost_purchase(uuid, jsonb, text) TO authenticated;

COMMIT;
