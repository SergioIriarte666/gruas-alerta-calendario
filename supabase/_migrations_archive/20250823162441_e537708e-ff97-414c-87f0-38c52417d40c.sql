-- SOLUCION GLOBAL: Ejecutar la función que vincula automáticamente todos los costos de mantenimiento desvinculados
SELECT public.fix_unlinked_maintenance_costs();

-- Verificar el estado después de la corrección
SELECT public.diagnose_maintenance_cost_integration();

-- Ver un resumen de los resultados
SELECT 
  'Mantenimientos Completados' as categoria,
  COUNT(*) as cantidad
FROM public.crane_maintenance 
WHERE status = 'completed' AND cost > 0

UNION ALL

SELECT 
  'Costos Vinculados Correctamente' as categoria,
  COUNT(*) as cantidad
FROM public.costs c
JOIN public.cost_categories cc ON c.category_id = cc.id
WHERE cc.name = 'Mantenimiento' AND c.maintenance_id IS NOT NULL

UNION ALL

SELECT 
  'Costos Sin Vincular' as categoria,
  COUNT(*) as cantidad
FROM public.costs c
JOIN public.cost_categories cc ON c.category_id = cc.id
WHERE cc.name = 'Mantenimiento' AND c.maintenance_id IS NULL;