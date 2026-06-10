-- Diagnóstico: verificar comisiones de servicios completados en tabla costs
-- NO ejecutar como migración — usar en Supabase SQL Editor para diagnóstico manual

-- 1. Servicios completados con comisión > 0 que SÍ tienen costo de comisión
SELECT
  s.folio,
  s.service_date,
  s.status,
  s.operator_commission,
  c.id as cost_id,
  c.amount as cost_amount,
  c.date as cost_date,
  o.name as operator_name
FROM services s
JOIN operators o ON s.operator_id = o.id
JOIN costs c ON c.service_id = s.id
JOIN cost_categories cc ON c.category_id = cc.id
WHERE s.status = 'completed'
  AND s.operator_commission > 0
  AND cc.name = 'Comisión Operador'
ORDER BY s.service_date DESC
LIMIT 50;

-- 2. Servicios completados con comisión > 0 que NO tienen costo de comisión (huérfanos)
SELECT
  s.folio,
  s.service_date,
  s.operator_commission,
  o.name as operator_name,
  'FALTA COSTO DE COMISION' as problema
FROM services s
JOIN operators o ON s.operator_id = o.id
WHERE s.status = 'completed'
  AND s.operator_commission > 0
  AND NOT EXISTS (
    SELECT 1 FROM costs c
    JOIN cost_categories cc ON c.category_id = cc.id
    WHERE c.service_id = s.id
      AND cc.name = 'Comisión Operador'
  )
ORDER BY s.service_date DESC;
