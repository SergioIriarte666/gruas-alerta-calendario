BEGIN;

-- Backfill: 106 cierres quedaron en 'closed' pese a tener factura asociada,
-- por el bug de UPDATE directo (sujeto a RLS) en useInvoiceOperations.ts,
-- creados entre 2025-12-29 y 2026-02-27. Todas sus facturas están en estado
-- 'paid' u 'overdue' (ninguna cancelada/borrador) → es seguro marcarlas
-- como 'invoiced'.
UPDATE public.service_closures sc
SET status = 'invoiced',
    updated_at = now()
WHERE sc.status = 'closed'
  AND EXISTS (
    SELECT 1 FROM public.invoice_closures ic WHERE ic.closure_id = sc.id
  );

COMMIT;
