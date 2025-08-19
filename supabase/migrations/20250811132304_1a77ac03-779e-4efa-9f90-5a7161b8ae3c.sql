-- SIMPLIFICAR FOLIOS DE FACTURAS - USAR NÚMEROS BAJOS Y MANEJABLES
ALTER TABLE public.company_data 
ADD COLUMN IF NOT EXISTS next_invoice_folio_number INTEGER;



UPDATE public.company_data 
SET next_invoice_folio_number = 4000
WHERE next_invoice_folio_number IS NULL;



INSERT INTO public.company_data (
  business_name, rut, address, phone, email, 
  next_service_folio_number, next_invoice_folio_number
) 
SELECT 
  'Empresa por Defecto', '12345678-9', 'Dirección', 
  '123456789', 'email@empresa.com', 1001, 4000
WHERE NOT EXISTS (SELECT 1 FROM public.company_data);



CREATE OR REPLACE FUNCTION public.generate_simple_invoice_folio()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number INTEGER;
  new_folio TEXT;
BEGIN
  UPDATE public.company_data 
  SET next_invoice_folio_number = COALESCE(next_invoice_folio_number, 4000) + 1
  WHERE id = (SELECT id FROM public.company_data LIMIT 1)
  RETURNING next_invoice_folio_number - 1 INTO next_number;
  
  IF next_number IS NULL THEN
    INSERT INTO public.company_data (
      business_name, rut, address, phone, email, 
      next_service_folio_number, next_invoice_folio_number
    ) 
    VALUES (
      'Empresa por Defecto', '12345678-9', 'Dirección', 
      '123456789', 'email@empresa.com', 1001, 4001
    )
    ON CONFLICT (id) DO UPDATE SET next_invoice_folio_number = 4001;
    next_number := 4000;
  END IF;
  
  new_folio := 'FACT-' || next_number;
  
  IF NOT EXISTS (SELECT 1 FROM invoices WHERE folio = new_folio) THEN
    RETURN new_folio;
  END IF;
  
  RAISE EXCEPTION 'Folio % ya existe', new_folio;
END;
$$;



CREATE OR REPLACE FUNCTION public.preview_next_invoice_folio()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(next_invoice_folio_number, 4000) 
  INTO next_number
  FROM public.company_data 
  LIMIT 1;
  
  IF next_number IS NULL THEN
    next_number := 4000;
  END IF;
  
  RETURN 'FACT-' || next_number;
END;
$$;



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
BEGIN
  simple_folio := public.generate_simple_invoice_folio();
  
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
    client_id, folio, issue_date, due_date, subtotal, vat, total,
    status, notes, numero_fiscal, created_by
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



DROP FUNCTION IF EXISTS public.generate_unique_invoice_folio();
DROP FUNCTION IF EXISTS public.validate_invoice_folio_uniqueness(TEXT, UUID);
