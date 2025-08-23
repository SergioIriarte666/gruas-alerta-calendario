-- SOLUCION: Vincular el costo existente con el mantenimiento

UPDATE public.costs 
SET maintenance_id = '56935de4-be8e-44a3-8303-f0a048f55588'::uuid,
    notes = COALESCE(notes, '') || ' [Vinculado con mantenimiento]'
WHERE crane_id = '6ef1b7af-e383-4108-b658-faa11760b930'
  AND amount = 50000
  AND date = '2025-08-22'
  AND maintenance_id IS NULL;

-- Verificar el resultado
SELECT 
  cm.id as maintenance_id,
  cm.description as maintenance_desc,
  cm.cost as maintenance_cost,
  c.id as cost_id,
  c.amount as cost_amount,
  c.maintenance_id as cost_maintenance_link
FROM public.crane_maintenance cm
LEFT JOIN public.costs c ON cm.id = c.maintenance_id
WHERE cm.id = '56935de4-be8e-44a3-8303-f0a048f55588'::uuid;