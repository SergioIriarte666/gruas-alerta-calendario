-- Eliminar comisiones generadas automáticamente por migración
-- Estas fueron creadas incorrectamente y necesitan ser removidas

DELETE FROM public.costs 
WHERE description ILIKE '%Comisión generada automáticamente por migración%'
   OR notes ILIKE '%Comisión generada automáticamente por migración%'
   OR subcategory = 'comisiones' 
   AND (
     description ILIKE '%migración%' 
     OR notes ILIKE '%migración%'
     OR description ILIKE '%automáticamente%'
   );

-- Log de confirmación
SELECT 'COMISIONES DE MIGRACIÓN ELIMINADAS - SISTEMA LIMPIO' as status;

-- Verificar que se eliminaron correctamente
SELECT COUNT(*) as remaining_migration_commissions
FROM public.costs 
WHERE description ILIKE '%migración%' 
   OR notes ILIKE '%migración%';