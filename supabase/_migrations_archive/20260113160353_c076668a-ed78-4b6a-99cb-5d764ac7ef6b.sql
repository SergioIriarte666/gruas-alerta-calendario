-- Limpiar comisiones fantasmas en service_resources
-- Poner commission_amount = 0 donde el servicio tiene operator_commission = 0 o NULL
UPDATE service_resources sr
SET 
  commission_amount = 0,
  updated_at = now()
FROM services s
WHERE sr.service_id = s.id
  AND sr.resource_type = 'operator'
  AND sr.commission_amount > 0
  AND (s.operator_commission = 0 OR s.operator_commission IS NULL);