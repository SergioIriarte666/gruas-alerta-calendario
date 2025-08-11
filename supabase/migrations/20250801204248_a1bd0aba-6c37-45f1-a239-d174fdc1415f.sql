-- Update create_invoice_transaction to use the new unique folio function
CREATE OR REPLACE FUNCTION public.create_invoice_transaction(p_invoice_data jsonb, p_service_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  invoice_id UUID;
  unique_folio TEXT;
  result jsonb;
BEGIN
  -- Generate unique folio using the new function
  SELECT public.generate_unique_invoice_folio() INTO unique_folio;
  
  -- Create the invoice with unique folio
  INSERT INTO public.invoices (
    client_id,
    issue_date,
    due_date,
    subtotal,
    vat,
    total,
    folio,
    numero_fiscal,
    status,
    notes,
    created_by
  ) VALUES (
    (p_invoice_data->>'client_id')::uuid,
    (p_invoice_data->>'issue_date')::date,
    (p_invoice_data->>'due_date')::date,
    (p_invoice_data->>'subtotal')::numeric,
    (p_invoice_data->>'vat')::numeric,
    (p_invoice_data->>'total')::numeric,
    unique_folio,
    p_invoice_data->>'numero_fiscal',
    (p_invoice_data->>'status')::invoice_status,
    p_invoice_data->>'notes',
    auth.uid()
  ) RETURNING id INTO invoice_id;
  
  -- Update services to invoiced status
  UPDATE public.services 
  SET 
    status = 'invoiced'::service_status,
    invoice_folio = unique_folio,
    invoice_numero_fiscal = p_invoice_data->>'numero_fiscal',
    updated_at = now()
  WHERE id = ANY(p_service_ids);
  
  RAISE NOTICE 'Factura creada exitosamente: % con % servicios', unique_folio, array_length(p_service_ids, 1);
  
  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', invoice_id,
    'folio', unique_folio,
    'services_updated', array_length(p_service_ids, 1)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error en transacción de factura: %', SQLERRM;
    RAISE;
END;
$function$;