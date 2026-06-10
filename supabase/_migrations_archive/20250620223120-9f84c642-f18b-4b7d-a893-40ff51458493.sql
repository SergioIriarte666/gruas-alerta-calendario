
-- Verificar el estado actual del servicio 2681069
SELECT s.folio, s.status, 'Current status' as note
FROM services s 
WHERE s.folio = '2681069';

-- Verificar si está en invoice_services
SELECT s.folio, i.folio as invoice_folio, 'Is in invoice' as note
FROM services s
INNER JOIN invoice_services is_rel ON s.id = is_rel.service_id
INNER JOIN invoices i ON is_rel.invoice_id = i.id
WHERE s.folio = '2681069';

-- Corregir específicamente el servicio 2681069 si no está marcado como facturado
UPDATE services 
SET status = 'invoiced', updated_at = now()
WHERE folio = '2681069' AND status != 'invoiced';

-- Verificar la corrección
SELECT s.folio, s.status, 'After correction' as note
FROM services s 
WHERE s.folio = '2681069';
