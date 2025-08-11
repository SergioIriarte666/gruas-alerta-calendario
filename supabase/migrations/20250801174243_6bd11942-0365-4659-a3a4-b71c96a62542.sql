-- Eliminar comisiones duplicadas del servicio 2542431
-- Solo mantener la comisión original (la más antigua)
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY service_id, operator_id, category_id 
      ORDER BY created_at ASC
    ) as rn
  FROM public.costs 
  WHERE service_id = (
    SELECT id FROM public.services WHERE folio = 'SRV-4107'
  )
  AND category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
  AND operator_id IS NOT NULL
)
DELETE FROM public.costs 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Verificar resultado
SELECT 
  COUNT(*) as total_commissions,
  SUM(amount) as total_amount
FROM public.costs 
WHERE service_id = (
  SELECT id FROM public.services WHERE folio = 'SRV-4107'
)
AND category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4';