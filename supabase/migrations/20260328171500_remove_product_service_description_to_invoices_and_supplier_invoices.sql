DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'invoices_enforce_product_service_description_trg'
  ) THEN
    DROP TRIGGER invoices_enforce_product_service_description_trg ON public.invoices;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'supplier_invoices_enforce_product_service_description_trg'
  ) THEN
    DROP TRIGGER supplier_invoices_enforce_product_service_description_trg ON public.supplier_invoices;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoices_product_service_description_len_chk'
  ) THEN
    ALTER TABLE public.invoices DROP CONSTRAINT invoices_product_service_description_len_chk;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'supplier_invoices_product_service_description_len_chk'
  ) THEN
    ALTER TABLE public.supplier_invoices DROP CONSTRAINT supplier_invoices_product_service_description_len_chk;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'product_service_description'
  ) THEN
    ALTER TABLE public.invoices DROP COLUMN product_service_description;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'supplier_invoices'
      AND column_name = 'product_service_description'
  ) THEN
    ALTER TABLE public.supplier_invoices DROP COLUMN product_service_description;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.enforce_product_service_description();
DROP FUNCTION IF EXISTS public.validate_product_service_description(text);

CREATE OR REPLACE FUNCTION public.create_invoice_transaction(
  p_invoice_data JSONB,
  p_service_ids UUID[]
)
RETURNS TABLE(invoice_id UUID, invoice_folio TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_invoice_id UUID;
  simple_folio TEXT;
  service_id UUID;
  total_billable_amount NUMERIC := 0;
  service_value NUMERIC;
  client_covered_amount NUMERIC;
  v_payment_term_id UUID;
BEGIN
  simple_folio := public.generate_simple_invoice_folio();
  
  v_payment_term_id := NULLIF((p_invoice_data->>'payment_term_id'), '')::UUID;
  
  FOREACH service_id IN ARRAY p_service_ids
  LOOP
    SELECT 
      s.value,
      CASE WHEN s.has_excess THEN s.client_covered_amount ELSE s.value END
    INTO service_value, client_covered_amount
    FROM services s
    WHERE s.id = service_id;
    
    IF FOUND THEN
      total_billable_amount := total_billable_amount + COALESCE(client_covered_amount, service_value);
    END IF;
  END LOOP;
  
  INSERT INTO invoices (
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
    created_by
  ) VALUES (
    (p_invoice_data->>'client_id')::UUID,
    simple_folio,
    (p_invoice_data->>'issue_date')::DATE,
    (p_invoice_data->>'due_date')::DATE,
    COALESCE((p_invoice_data->>'subtotal')::NUMERIC, total_billable_amount),
    COALESCE((p_invoice_data->>'vat')::NUMERIC, total_billable_amount * 0.19),
    COALESCE((p_invoice_data->>'total')::NUMERIC, total_billable_amount * 1.19),
    COALESCE((p_invoice_data->>'status')::invoice_status, 'draft'::invoice_status),
    p_invoice_data->>'notes',
    p_invoice_data->>'numero_fiscal',
    v_payment_term_id,
    auth.uid()
  )
  RETURNING id INTO new_invoice_id;
  
  FOREACH service_id IN ARRAY p_service_ids
  LOOP
    INSERT INTO invoice_services (invoice_id, service_id)
    VALUES (new_invoice_id, service_id);
    
    UPDATE services 
    SET 
      status = 'invoiced',
      invoice_folio = simple_folio,
      invoice_numero_fiscal = p_invoice_data->>'numero_fiscal',
      updated_at = now()
    WHERE id = service_id;
  END LOOP;
  
  RETURN QUERY SELECT new_invoice_id, simple_folio;
END;
$$;
