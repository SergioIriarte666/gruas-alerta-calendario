-- Match OC across all client records for the recipient RUT, then retain the
-- payer of the selected services for both closure and invoice.
CREATE OR REPLACE FUNCTION public.issued_invoice_candidates(p_client_rut text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_user_safe() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'key', s.id::text || ':' || t.kind, 'serviceId', s.id, 'folio', s.folio,
    'clientId', payer.id, 'date', s.service_date, 'purchaseOrder', coalesce(s.purchase_order, ''), 'valueType', t.kind,
    'amount', CASE WHEN t.kind = 'excess' THEN round(coalesce(s.excess_amount, 0))
      WHEN s.has_excess AND coalesce(s.client_covered_amount, 0) > 0 THEN round(s.client_covered_amount)
      WHEN coalesce(s.custody_total_amount,0) > 0 AND s.value = s.custody_total_amount THEN round(s.custody_total_amount)
      ELSE round(coalesce(s.value,0) + coalesce(s.custody_total_amount,0)) END,
    'closureId', c.id, 'closureFolio', c.folio,
    'blocked', CASE
      WHEN EXISTS (SELECT 1 FROM public.service_disputes d WHERE d.service_id = s.id AND d.status = 'open') THEN 'Disputa abierta'
      WHEN c.status = 'invoiced' OR EXISTS (SELECT 1 FROM public.invoice_closures ic WHERE ic.closure_id = c.id) THEN 'Ya facturado'
      WHEN c.id IS NOT NULL AND c.client_id IS DISTINCT FROM payer.id THEN 'Cierre de otro pagador'
      WHEN s.status::text IN ('invoiced','partially_invoiced') AND NOT (
        s.has_excess AND s.third_party_client_id IS NOT NULL AND s.excess_amount > 0
        AND EXISTS (SELECT 1 FROM public.closure_services other WHERE other.service_id = s.id)) THEN 'Facturación previa sin desglose disponible'
      ELSE NULL END
  ) ORDER BY s.service_date DESC, s.folio, t.kind), '[]'::jsonb) INTO v_result
  FROM public.services s
  CROSS JOIN (VALUES ('covered'), ('excess')) t(kind)
  JOIN public.clients payer ON payer.id = CASE WHEN t.kind = 'excess' THEN s.third_party_client_id ELSE s.client_id END
    AND public.normalize_import_rut(payer.rut) = public.normalize_import_rut(p_client_rut)
  LEFT JOIN public.closure_services cs ON cs.service_id = s.id AND cs.value_type = t.kind
  LEFT JOIN public.service_closures c ON c.id = cs.closure_id
  WHERE s.status::text IN ('completed','with_purchase_order','failed','invoiced','partially_invoiced')
    AND (t.kind = 'covered' OR (t.kind = 'excess' AND s.has_excess AND s.excess_amount > 0));
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.register_issued_invoice(p_document_id uuid, p_expected_draft jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  doc public.issued_invoice_imports; f jsonb; candidates jsonb; entry jsonb;
  selected text[]; service_ids uuid[]; client_id_value uuid; client_count integer;
  net_value numeric; vat_value numeric; total_value numeric; sum_value numeric;
  closure_id_value uuid; closure_ids uuid[] := '{}'; closure_folios text[] := '{}';
  inv_id uuid; inv_folio text; kind text; existing_id uuid; existing public.service_closures;
  fiscal text; issuer text; oc text; result_value jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_user_safe() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  SELECT * INTO doc FROM public.issued_invoice_imports WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento no encontrado'; END IF;
  IF doc.result IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE id = (doc.result->>'invoiceId')::uuid) THEN
      RAISE EXCEPTION 'La factura asociada fue eliminada. Requiere revisión administrativa';
    END IF;
    RETURN doc.result;
  END IF;
  IF doc.draft IS DISTINCT FROM p_expected_draft THEN RAISE EXCEPTION 'El borrador cambió en otra sesión. Recarga y revisa antes de registrar'; END IF;
  f := doc.draft->'fields';
  IF coalesce((doc.draft->>'reviewed')::boolean, false) IS NOT TRUE THEN RAISE EXCEPTION 'Revisa el documento y los servicios'; END IF;
  IF coalesce(f->>'documentType','') NOT IN ('33','34') THEN RAISE EXCEPTION 'Tipo de documento no admitido'; END IF;
  fiscal := f->>'fiscalNumber'; issuer := public.normalize_import_rut(f->>'issuerRut');
  IF fiscal IS NULL OR fiscal !~ '^[0-9]+$' OR fiscal::numeric <= 0 THEN RAISE EXCEPTION 'Folio fiscal inválido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.company_data WHERE public.normalize_import_rut(rut) = issuer) THEN
    RAISE EXCEPTION 'El RUT emisor no coincide con la empresa de TMS';
  END IF;
  -- Same fiscal number cannot be registered through concurrent requests.
  PERFORM pg_advisory_xact_lock(hashtextextended('issued-invoice:' || fiscal::numeric::text, 0));
  IF EXISTS (SELECT 1 FROM public.invoices WHERE numero_fiscal ~ '^[0-9]+$' AND numero_fiscal::numeric = fiscal::numeric) THEN
    RAISE EXCEPTION 'La factura fiscal % ya está registrada en TMS', fiscal;
  END IF;
  IF coalesce(f->>'issueDate','') !~ '^\d{4}-\d{2}-\d{2}$' OR coalesce(f->>'dueDate','') !~ '^\d{4}-\d{2}-\d{2}$'
    OR (f->>'dueDate')::date < (f->>'issueDate')::date THEN RAISE EXCEPTION 'Revisa emisión y vencimiento'; END IF;
  net_value := (f->>'net')::numeric; vat_value := (f->>'vat')::numeric; total_value := (f->>'total')::numeric;
  IF net_value IS NULL OR vat_value IS NULL OR total_value IS NULL OR net_value <= 0 OR vat_value < 0
    OR net_value + vat_value <> total_value OR net_value <> round(net_value) OR vat_value <> round(vat_value)
    OR total_value > 9007199254740991 OR (f->>'documentType' = '34' AND vat_value <> 0) THEN
    RAISE EXCEPTION 'Neto/base, IVA y total no cuadran';
  END IF;
  IF length(trim(coalesce(f->>'description',''))) < 10 OR length(f->>'description') > 500 THEN RAISE EXCEPTION 'Descripción inválida'; END IF;
  SELECT array_agg(value) INTO selected FROM jsonb_array_elements_text(doc.draft->'selectedKeys');
  IF coalesce(cardinality(selected),0) = 0 OR cardinality(selected) <> (SELECT count(DISTINCT x) FROM unnest(selected) x) THEN
    RAISE EXCEPTION 'Selecciona servicios sin duplicados';
  END IF;
  SELECT array_agg(DISTINCT split_part(x, ':', 1)::uuid) INTO service_ids FROM unnest(selected) x;
  -- Stable lock order; amounts, disputes and availability are re-read afterward.
  PERFORM id FROM public.services WHERE id = ANY(service_ids) ORDER BY id FOR UPDATE;
  candidates := public.issued_invoice_candidates(f->>'clientRut');
  IF (SELECT count(*) FROM jsonb_array_elements(candidates) c WHERE c->>'key' = ANY(selected)) <> cardinality(selected) THEN
    RAISE EXCEPTION 'La disponibilidad de los servicios cambió. Vuelve a conciliar';
  END IF;
  -- A RUT may have several branches/client records. Resolve the actual payer
  -- from the selected services, never from an arbitrary matching client row.
  SELECT count(DISTINCT c->>'clientId'), (array_agg(DISTINCT (c->>'clientId')::uuid))[1]
    INTO client_count, client_id_value
    FROM jsonb_array_elements(candidates) c WHERE c->>'key' = ANY(selected);
  IF client_count <> 1 OR client_id_value IS NULL THEN
    RAISE EXCEPTION 'Los servicios seleccionados pertenecen a distintas fichas de cliente. Selecciona los de una misma ficha';
  END IF;
  oc := public.normalize_import_oc(coalesce(f->>'purchaseOrder',''));
  sum_value := 0;
  FOR entry IN SELECT value FROM jsonb_array_elements(candidates) WHERE value->>'key' = ANY(selected) LOOP
    IF entry->>'blocked' IS NOT NULL THEN RAISE EXCEPTION 'Servicio %: %', entry->>'folio', entry->>'blocked'; END IF;
    IF (entry->>'amount')::numeric <= 0 THEN RAISE EXCEPTION 'Servicio sin monto facturable positivo'; END IF;
    IF (oc = '' OR public.normalize_import_oc(entry->>'purchaseOrder') IS DISTINCT FROM oc)
      AND length(trim(coalesce(doc.draft->>'manualReason',''))) < 10 THEN
      RAISE EXCEPTION 'OC distinta o ausente: documenta y confirma la asignación manual';
    END IF;
    sum_value := sum_value + (entry->>'amount')::numeric;
  END LOOP;
  IF sum_value <> net_value THEN RAISE EXCEPTION 'Neto/base servicios % no coincide con factura %', sum_value, net_value; END IF;

  -- Reuse a previous closure only when every one of its entries is selected,
  -- belongs to this payer and remains unbilled. Never take a subset silently.
  FOR existing_id IN SELECT DISTINCT (c->>'closureId')::uuid FROM jsonb_array_elements(candidates) c
    WHERE c->>'key' = ANY(selected) AND c->>'closureId' IS NOT NULL LOOP
    SELECT * INTO existing FROM public.service_closures WHERE id = existing_id FOR UPDATE;
    IF existing.client_id IS DISTINCT FROM client_id_value OR coalesce(existing.status::text,'') NOT IN ('open','closed')
      OR EXISTS (SELECT 1 FROM public.invoice_closures WHERE closure_id = existing_id)
      OR EXISTS (SELECT 1 FROM public.closure_services cs WHERE cs.closure_id = existing_id AND cs.value_type IS DISTINCT FROM existing.closure_type)
      OR EXISTS (SELECT 1 FROM public.closure_services cs WHERE cs.closure_id = existing_id
        AND NOT (cs.service_id::text || ':' || cs.value_type = ANY(selected))) THEN
      RAISE EXCEPTION 'El cierre % debe estar completo, sin facturar y pertenecer al receptor', existing.folio;
    END IF;
    IF existing.total IS DISTINCT FROM (SELECT sum((c->>'amount')::numeric) FROM jsonb_array_elements(candidates) c WHERE c->>'closureId' = existing_id::text)
      OR EXISTS (SELECT 1 FROM public.closure_services cs JOIN jsonb_array_elements(candidates) c
        ON c->>'key' = cs.service_id::text || ':' || cs.value_type
        WHERE cs.closure_id = existing_id AND cs.amount IS DISTINCT FROM (c->>'amount')::numeric) THEN
      RAISE EXCEPTION 'Los montos del cierre % cambiaron. Revísalo antes de importar', existing.folio;
    END IF;
    closure_ids := array_append(closure_ids, existing_id); closure_folios := array_append(closure_folios, existing.folio);
  END LOOP;
  FOREACH kind IN ARRAY ARRAY['covered','excess'] LOOP
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(candidates) c WHERE c->>'key' = ANY(selected)
      AND c->>'valueType' = kind AND c->>'closureId' IS NULL) THEN
      INSERT INTO public.service_closures(folio, client_id, date_from, date_to, total, status, closure_type, purchase_order, created_by)
      SELECT '', client_id_value, min((c->>'date')::date), max((c->>'date')::date), sum((c->>'amount')::numeric),
        'closed', kind, nullif(f->>'purchaseOrder',''), auth.uid()
      FROM jsonb_array_elements(candidates) c WHERE c->>'key' = ANY(selected) AND c->>'valueType' = kind AND c->>'closureId' IS NULL
      RETURNING id, folio INTO closure_id_value, existing.folio;
      INSERT INTO public.closure_services(closure_id, service_id, value_type, amount)
      SELECT closure_id_value, (c->>'serviceId')::uuid, kind, (c->>'amount')::numeric FROM jsonb_array_elements(candidates) c
      WHERE c->>'key' = ANY(selected) AND c->>'valueType' = kind AND c->>'closureId' IS NULL;
      closure_ids := array_append(closure_ids, closure_id_value); closure_folios := array_append(closure_folios, existing.folio);
    END IF;
  END LOOP;
  -- Direct insert inside this transaction avoids the old helper's unconditional
  -- service invoicing before all covered/excess links have been accounted for.
  inv_folio := public.generate_simple_invoice_folio();
  INSERT INTO public.invoices(client_id, folio, issue_date, due_date, subtotal, vat, total, status,
    numero_fiscal, product_service_description, notes, created_by)
  VALUES (client_id_value, inv_folio, (f->>'issueDate')::date, (f->>'dueDate')::date, net_value, vat_value, total_value,
    'sent', fiscal, f->>'description', 'Importación PDF ' || doc.file_name || ' · OC ' || coalesce(f->>'purchaseOrder','')
      || ' · ' || coalesce(doc.draft->>'manualReason',''), auth.uid()) RETURNING id INTO inv_id;
  INSERT INTO public.invoice_services(invoice_id, service_id) SELECT inv_id, x FROM unnest(service_ids) x;
  INSERT INTO public.invoice_closures(invoice_id, closure_id) SELECT inv_id, x FROM unnest(closure_ids) x;
  UPDATE public.service_closures SET status = 'invoiced', updated_at = now() WHERE id = ANY(closure_ids);
  UPDATE public.services s SET status = CASE
    WHEN s.has_excess AND s.third_party_client_id IS NOT NULL AND s.excess_amount > 0 AND
      (SELECT count(DISTINCT cs.value_type) FROM public.closure_services cs
        JOIN public.invoice_closures ic ON ic.closure_id = cs.closure_id WHERE cs.service_id = s.id) < 2
      THEN 'partially_invoiced'::public.service_status ELSE 'invoiced'::public.service_status END,
    invoice_folio = inv_folio, invoice_numero_fiscal = fiscal, updated_at = now() WHERE s.id = ANY(service_ids);
  result_value := jsonb_build_object('invoiceId',inv_id,'invoiceFolio',inv_folio,'closureFolios',to_jsonb(closure_folios));
  UPDATE public.issued_invoice_imports SET result = result_value, updated_at = now() WHERE id = doc.id;
  RETURN result_value;
END $$;

