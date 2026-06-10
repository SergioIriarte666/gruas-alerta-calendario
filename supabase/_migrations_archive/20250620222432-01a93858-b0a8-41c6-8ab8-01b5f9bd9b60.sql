
-- Corregir estados de servicios facturados que están inconsistentes
-- Servicios que aparecen en invoice_services pero tienen status incorrecto
UPDATE services 
SET status = 'invoiced', updated_at = now()
WHERE id IN (
  SELECT DISTINCT s.id 
  FROM services s
  INNER JOIN invoice_services is_rel ON s.id = is_rel.service_id
  WHERE s.status != 'invoiced'
);

-- Verificar que todos los servicios en facturas tengan el status correcto
SELECT 
  s.folio,
  s.status,
  i.folio as invoice_folio,
  'Should be invoiced' as note
FROM services s
INNER JOIN invoice_services is_rel ON s.id = is_rel.service_id
INNER JOIN invoices i ON is_rel.invoice_id = i.id
WHERE s.status != 'invoiced'
ORDER BY s.folio;
