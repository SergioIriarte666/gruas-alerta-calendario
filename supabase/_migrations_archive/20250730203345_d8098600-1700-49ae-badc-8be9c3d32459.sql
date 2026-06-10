-- Verificar y arreglar servicios que tienen invoice_folio pero estado incorrecto
UPDATE public.services 
SET status = 'invoiced'::service_status
WHERE invoice_folio IS NOT NULL 
  AND invoice_folio != '' 
  AND status != 'invoiced';

-- Función para debug y verificación de estados
CREATE OR REPLACE FUNCTION public.debug_service_states()
RETURNS TABLE(
  service_folio text,
  current_status service_status,
  invoice_folio text,
  should_be_invoiced boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.folio as service_folio,
    s.status as current_status,
    s.invoice_folio,
    (s.invoice_folio IS NOT NULL AND s.invoice_folio != '') as should_be_invoiced
  FROM public.services s
  WHERE s.invoice_folio IS NOT NULL
  ORDER BY s.folio;
END;
$$;