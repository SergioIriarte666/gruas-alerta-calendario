DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'product_service_description'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN product_service_description text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'supplier_invoices'
      AND column_name = 'product_service_description'
  ) THEN
    ALTER TABLE public.supplier_invoices ADD COLUMN product_service_description text;
  END IF;
END $$;

UPDATE public.invoices
SET product_service_description = CASE
  WHEN notes IS NOT NULL AND char_length(btrim(notes)) >= 10 THEN left(btrim(notes), 500)
  ELSE 'Descripción no registrada'
END
WHERE product_service_description IS NULL;

UPDATE public.supplier_invoices
SET product_service_description = CASE
  WHEN description IS NOT NULL AND char_length(btrim(description)) >= 10 THEN left(btrim(description), 500)
  ELSE 'Descripción no registrada'
END
WHERE product_service_description IS NULL;

UPDATE public.invoices
SET product_service_description = 'Descripción no registrada'
WHERE product_service_description IS NULL
   OR char_length(btrim(product_service_description)) < 10;

UPDATE public.supplier_invoices
SET product_service_description = 'Descripción no registrada'
WHERE product_service_description IS NULL
   OR char_length(btrim(product_service_description)) < 10;

UPDATE public.invoices
SET product_service_description = left(btrim(product_service_description), 500)
WHERE char_length(btrim(product_service_description)) > 500;

UPDATE public.supplier_invoices
SET product_service_description = left(btrim(product_service_description), 500)
WHERE char_length(btrim(product_service_description)) > 500;

ALTER TABLE public.invoices
  ALTER COLUMN product_service_description SET NOT NULL;

ALTER TABLE public.supplier_invoices
  ALTER COLUMN product_service_description SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoices_product_service_description_len_chk'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_product_service_description_len_chk
      CHECK (char_length(btrim(product_service_description)) BETWEEN 10 AND 500);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'supplier_invoices_product_service_description_len_chk'
  ) THEN
    ALTER TABLE public.supplier_invoices
      ADD CONSTRAINT supplier_invoices_product_service_description_len_chk
      CHECK (char_length(btrim(product_service_description)) BETWEEN 10 AND 500);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.validate_product_service_description(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
  v_len int;
BEGIN
  v := btrim(coalesce(p_text, ''));
  v_len := char_length(v);

  IF v_len < 10 OR v_len > 500 THEN
    RAISE EXCEPTION 'product_service_description debe tener entre 10 y 500 caracteres';
  END IF;

  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_product_service_description()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.product_service_description := public.validate_product_service_description(NEW.product_service_description);
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'invoices_enforce_product_service_description_trg'
  ) THEN
    CREATE TRIGGER invoices_enforce_product_service_description_trg
      BEFORE INSERT OR UPDATE ON public.invoices
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_product_service_description();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'supplier_invoices_enforce_product_service_description_trg'
  ) THEN
    CREATE TRIGGER supplier_invoices_enforce_product_service_description_trg
      BEFORE INSERT OR UPDATE ON public.supplier_invoices
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_product_service_description();
  END IF;
END $$;

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
    product_service_description,
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
    public.validate_product_service_description(p_invoice_data->>'product_service_description'),
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

