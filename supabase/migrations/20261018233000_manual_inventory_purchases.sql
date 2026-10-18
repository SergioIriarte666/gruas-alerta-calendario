BEGIN;

CREATE TABLE public.manual_purchase_registrations (
  request_id uuid PRIMARY KEY,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  payload jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.manual_purchase_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.manual_purchase_registrations FROM anon, authenticated;
GRANT SELECT ON public.manual_purchase_registrations TO authenticated;
CREATE POLICY manual_purchase_registrations_read ON public.manual_purchase_registrations
  FOR SELECT TO authenticated USING (created_by = (SELECT auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

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
  v_result := public.import_xml_inventory_invoice(
    p_supplier_id => v_supplier, p_folio => v_folio, p_issue_date => (p_data->>'p_issue_date')::date,
    p_due_date => (p_data->>'p_due_date')::date, p_total_amount => v_total, p_net_amount => v_net, p_vat_amount => v_vat,
    p_currency => 'CLP', p_document_type => 'Factura', p_description => p_data->>'p_description',
    p_product_service_description => p_data->>'p_product_service_description', p_xml_file_name => NULL,
    p_is_paid => coalesce((p_data->>'p_is_paid')::boolean, false), p_location_id => (p_data->>'p_location_id')::uuid,
    p_cost_category_id => (p_data->>'p_cost_category_id')::uuid, p_cost_subcategory => NULL,
    p_cost_center_id => (p_data->>'p_cost_center_id')::uuid, p_crane_id => NULL,
    p_operator_id => (p_data->>'p_operator_id')::uuid, p_service_id => (p_data->>'p_service_id')::uuid,
    p_service_folio => p_data->>'p_service_folio', p_notes => p_data->>'p_notes', p_lines => p_data->'p_lines',
    p_payment_date => (p_data->>'p_payment_date')::date, p_payment_reference => p_data->>'p_payment_reference'
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

COMMIT;
