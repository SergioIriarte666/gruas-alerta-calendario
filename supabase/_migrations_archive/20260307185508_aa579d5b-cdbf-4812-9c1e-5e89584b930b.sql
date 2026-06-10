
-- Fix all services that are linked to non-cancelled invoices via closure_services + invoice_closures
-- but whose status is not 'invoiced'
UPDATE services s
SET 
  status = 'invoiced',
  invoice_folio = i.folio,
  invoice_numero_fiscal = i.numero_fiscal,
  updated_at = now()
FROM closure_services cs
JOIN invoice_closures ic ON ic.closure_id = cs.closure_id
JOIN invoices i ON i.id = ic.invoice_id
WHERE cs.service_id = s.id
  AND s.status != 'invoiced'
  AND i.status != 'cancelled';
