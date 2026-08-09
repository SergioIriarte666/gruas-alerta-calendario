BEGIN;

-- La transacción de creación no debe declarar paid antes de que exista una
-- payment_application. Esto protege también a callers distintos del frontend.
CREATE OR REPLACE FUNCTION public.create_invoice_transaction(
  p_invoice_data jsonb,
  p_service_ids uuid[]
)
RETURNS TABLE(invoice_id uuid, invoice_folio text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_invoice_id uuid;
  simple_folio text;
  service_id uuid;
  total_billable_amount numeric := 0;
  service_value numeric;
  client_covered_amount numeric;
  v_payment_term_id uuid;
  v_requested_status public.invoice_status;
  v_initial_status public.invoice_status;
BEGIN
  simple_folio := public.generate_simple_invoice_folio();
  v_payment_term_id := NULLIF(p_invoice_data->>'payment_term_id', '')::uuid;
  v_requested_status := COALESCE(
    NULLIF(p_invoice_data->>'status', '')::public.invoice_status,
    'draft'::public.invoice_status
  );
  v_initial_status := CASE
    WHEN v_requested_status = 'paid'::public.invoice_status
      THEN 'sent'::public.invoice_status
    ELSE v_requested_status
  END;

  FOREACH service_id IN ARRAY p_service_ids
  LOOP
    SELECT
      s.value,
      CASE WHEN s.has_excess THEN s.client_covered_amount ELSE s.value END
    INTO service_value, client_covered_amount
    FROM public.services s
    WHERE s.id = service_id;

    IF FOUND THEN
      total_billable_amount := total_billable_amount
        + COALESCE(client_covered_amount, service_value);
    END IF;
  END LOOP;

  INSERT INTO public.invoices (
    client_id,
    folio,
    issue_date,
    due_date,
    subtotal,
    vat,
    total,
    status,
    notes,
    numero_fiscal,
    payment_term_id,
    product_service_description,
    created_by
  ) VALUES (
    (p_invoice_data->>'client_id')::uuid,
    simple_folio,
    (p_invoice_data->>'issue_date')::date,
    (p_invoice_data->>'due_date')::date,
    COALESCE((p_invoice_data->>'subtotal')::numeric, total_billable_amount),
    COALESCE((p_invoice_data->>'vat')::numeric, total_billable_amount * 0.19),
    COALESCE((p_invoice_data->>'total')::numeric, total_billable_amount * 1.19),
    v_initial_status,
    p_invoice_data->>'notes',
    p_invoice_data->>'numero_fiscal',
    v_payment_term_id,
    public.validate_product_service_description(
      p_invoice_data->>'product_service_description'
    ),
    auth.uid()
  )
  RETURNING id INTO new_invoice_id;

  FOREACH service_id IN ARRAY p_service_ids
  LOOP
    INSERT INTO public.invoice_services (invoice_id, service_id)
    VALUES (new_invoice_id, service_id);

    UPDATE public.services
    SET status = 'invoiced',
        invoice_folio = simple_folio,
        invoice_numero_fiscal = p_invoice_data->>'numero_fiscal',
        updated_at = now()
    WHERE id = service_id;
  END LOOP;

  RETURN QUERY SELECT new_invoice_id, simple_folio;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_invoice_transaction(jsonb, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_invoice_transaction(jsonb, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_invoice_transaction(jsonb, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_transaction(jsonb, uuid[]) TO service_role;

-- El overload histórico de un solo parámetro conserva una validación que
-- considera pagada una factura solo por su status, aunque paid_amount sea 0.
-- Se elimina para que todas las llamadas usen la implementación consistente.
DROP FUNCTION IF EXISTS public.create_automatic_payment_for_invoice(uuid);

CREATE OR REPLACE FUNCTION public.create_automatic_payment_for_invoice(
  p_invoice_id uuid,
  p_payment_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_payment_id uuid;
  v_existing_payment_id uuid;
  v_calculated_paid numeric;
  v_remaining_amount numeric;
  v_effective_payment_date date := COALESCE(p_payment_date, CURRENT_DATE);
BEGIN
  -- Serializa el pago automático por factura. Así dos clics concurrentes no
  -- pueden superar juntos la comprobación de duplicado.
  SELECT *
  INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Factura no encontrada');
  END IF;

  IF v_invoice.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se puede pagar una factura anulada');
  END IF;

  SELECT COALESCE(SUM(pa.applied_amount), 0)
  INTO v_calculated_paid
  FROM public.payment_applications pa
  WHERE pa.invoice_id = p_invoice_id;

  -- payment_applications es la fuente de verdad. Esto repara también facturas
  -- antiguas grabadas como paid con paid_amount = 0.
  IF v_invoice.paid_amount IS DISTINCT FROM v_calculated_paid THEN
    UPDATE public.invoices
    SET paid_amount = v_calculated_paid,
        updated_at = now()
    WHERE id = p_invoice_id;

    v_invoice.paid_amount := v_calculated_paid;
  END IF;

  v_remaining_amount := v_invoice.total - v_calculated_paid;

  IF v_remaining_amount <= 0 THEN
    UPDATE public.invoices
    SET status = 'paid'::public.invoice_status,
        payment_date = COALESCE(payment_date, v_effective_payment_date),
        updated_at = now()
    WHERE id = p_invoice_id;

    RETURN jsonb_build_object(
      'success', true,
      'invoice_id', p_invoice_id,
      'invoice_folio', v_invoice.folio,
      'status', 'paid',
      'message', 'Factura ya estaba completamente pagada'
    );
  END IF;

  SELECT pa.payment_id
  INTO v_existing_payment_id
  FROM public.payment_applications pa
  JOIN public.payments p ON p.id = pa.payment_id
  WHERE pa.invoice_id = p_invoice_id
    AND pa.application_method = 'fifo'
    AND p.notes ILIKE '%Pago automático%'
  LIMIT 1;

  IF v_existing_payment_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ya existe un pago automático incompleto para esta factura',
      'payment_id', v_existing_payment_id
    );
  END IF;

  INSERT INTO public.payments (
    client_id,
    amount,
    payment_date,
    payment_method,
    bank_reference,
    notes,
    status,
    applied_amount,
    created_by
  ) VALUES (
    v_invoice.client_id,
    v_remaining_amount,
    v_effective_payment_date,
    'transferencia',
    'AUTO-' || v_invoice.folio,
    'Pago automático generado para ' || v_invoice.folio,
    'pending'::public.payment_status,
    0,
    auth.uid()
  )
  RETURNING id INTO v_payment_id;

  INSERT INTO public.payment_applications (
    payment_id,
    invoice_id,
    applied_amount,
    application_method,
    notes,
    created_by
  ) VALUES (
    v_payment_id,
    p_invoice_id,
    v_remaining_amount,
    'fifo',
    'Aplicación automática generada',
    auth.uid()
  );

  -- Los triggers sincronizan paid_amount. Se fija además la fecha elegida por
  -- el usuario, porque los triggers históricos usan CURRENT_DATE.
  UPDATE public.invoices
  SET status = 'paid'::public.invoice_status,
      paid_amount = total,
      payment_date = v_effective_payment_date,
      updated_at = now()
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'invoice_id', p_invoice_id,
    'invoice_folio', v_invoice.folio,
    'amount', v_remaining_amount,
    'status', 'paid',
    'message', 'Pago automático creado exitosamente'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_automatic_payment_for_invoice(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_automatic_payment_for_invoice(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_automatic_payment_for_invoice(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_automatic_payment_for_invoice(uuid, date) TO service_role;

COMMIT;
