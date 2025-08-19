-- Fix infinite recursion in invoice creation by updating create_invoice_transaction function
-- Replace generate_unique_invoice_folio() with confirm_invoice_folio_usage() to avoid RLS recursion

CREATE OR REPLACE FUNCTION public.create_invoice_transaction(
  p_client_id UUID,
  p_closure_id UUID,
  p_issue_date DATE,
  p_due_date DATE,
  p_subtotal NUMERIC,
  p_vat NUMERIC,
  p_total NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(invoice_id UUID, invoice_folio TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_invoice_id UUID;
  unique_folio TEXT;
BEGIN
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
    created_by
  ) VALUES (
    p_client_id,
    unique_folio,
    p_issue_date,
    p_due_date,
    p_subtotal,
    p_vat,
    p_total,
    'draft',
    p_notes,
    auth.uid()
  )
  RETURNING id INTO new_invoice_id;
  
  -- Create invoice-closure relationship
  INSERT INTO public.invoice_closures (
    invoice_id,
    closure_id
  ) VALUES (
    new_invoice_id,
    p_closure_id
  );
  
  -- Log successful creation
  RAISE NOTICE 'Invoice created successfully: ID=%, Folio=%', new_invoice_id, unique_folio;
  
  RETURN QUERY SELECT new_invoice_id, unique_folio;
END;
$$;