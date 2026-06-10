
-- Reparar comisiones existentes que tienen service_id pero no tienen service_folio
UPDATE costs c
SET service_folio = s.folio
FROM services s
WHERE c.service_id = s.id
  AND c.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
  AND (c.service_folio IS NULL OR c.service_folio = '');
