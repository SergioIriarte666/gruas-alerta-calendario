-- Fix the second create_invoice_transaction function that handles services
-- This function was still using generate_unique_invoice_folio() causing recursion

CREATE OR REPLACE FUNCTION public.create_invoice_transaction(
  p_invoice_data JSON,
  p_service_ids UUID[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_invoice_id UUID;
  unique_folio TEXT;
  service_record RECORD;
  total_amount NUMERIC := 0;
  invoice_data RECORD;
BEGIN
  -- Extract invoice data from JSON
  SELECT 
    (p_invoice_data->>'client_id')::UUID as client_id,
    (p_invoice_data->>'issue_date')::DATE as issue_date,
    (p_invoice_data->>'due_date')::DATE as due_date,
    (p_invoice_data->>'subtotal')::NUMERIC as subtotal,
    (p_invoice_data->>'vat')::NUMERIC as vat,
    (p_invoice_data->>'total')::NUMERIC as total,
    p_invoice_data->>'notes' as notes,
    p_invoice_data->>'numero_fiscal' as numero_fiscal
  INTO invoice_data;

  -- Generate unique folio using company_data (avoiding invoices table recursion)
  SELECT public.confirm_invoice_folio_usage() INTO unique_folio;
  
  -- Create the invoice record
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
    created_by
  ) VALUES (
    invoice_data.client_id,
    unique_folio,
    invoice_data.issue_date,
    invoice_data.due_date,
    invoice_data.subtotal,
    invoice_data.vat,
    invoice_data.total,
    'draft',
    invoice_data.notes,
    invoice_data.numero_fiscal,
    auth.uid()
  )
  RETURNING id INTO new_invoice_id;
  
  -- Link services to invoice and update their status
  FOR i IN 1..array_length(p_service_ids, 1) LOOP
    -- Create invoice-service relationship
    INSERT INTO public.invoice_services (invoice_id, service_id)
    VALUES (new_invoice_id, p_service_ids[i]);
    
    -- Update service status to invoiced and set invoice folio
    UPDATE public.services 
    SET 
      status = 'invoiced',
      invoice_folio = unique_folio,
      invoice_numero_fiscal = invoice_data.numero_fiscal,
      updated_at = now()
    WHERE id = p_service_ids[i];
  END LOOP;
  
  -- Log successful creation
  RAISE NOTICE 'Invoice created successfully for services: ID=%, Folio=%', new_invoice_id, unique_folio;
  
  RETURN json_build_object(
    'success', true,
    'invoice_id', new_invoice_id,
    'invoice_folio', unique_folio,
    'services_count', array_length(p_service_ids, 1)
  );
END;
$$;