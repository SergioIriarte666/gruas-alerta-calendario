
-- One-time fix: Clean orphaned invoice_folio/invoice_numero_fiscal from services
-- where the referenced invoice no longer exists
UPDATE public.services
SET 
  invoice_folio = NULL,
  invoice_numero_fiscal = NULL,
  status = 'completed',
  updated_at = now()
WHERE status = 'invoiced'
  AND invoice_folio IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.invoices i WHERE i.folio = services.invoice_folio
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.invoice_services isv WHERE isv.service_id = services.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.closure_services cs 
    JOIN public.invoice_closures ic ON ic.closure_id = cs.closure_id
    WHERE cs.service_id = services.id
  );
