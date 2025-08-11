-- ELIMINAR tablas incorrectas y usar las comisiones reales del sistema

-- Eliminar las tablas que creé erróneamente
DROP TABLE IF EXISTS public.commission_batch_items CASCADE;
DROP TABLE IF EXISTS public.commission_batches CASCADE;
DROP TABLE IF EXISTS public.commissions CASCADE;
DROP TABLE IF EXISTS public.operator_commission_rates CASCADE;

-- Eliminar trigger y función incorrectos
DROP TRIGGER IF EXISTS generate_commission_on_service_completion ON public.services;
DROP FUNCTION IF EXISTS public.generate_commission_for_service();
DROP FUNCTION IF EXISTS public.generate_batch_number();

-- Las comisiones reales están en la tabla costs con subcategory = 'comisiones'
-- Verificar que las comisiones reales existen
DO $$
DECLARE
  commission_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO commission_count 
  FROM public.costs 
  WHERE subcategory = 'comisiones';
  
  RAISE NOTICE 'COMISIONES REALES ENCONTRADAS: %', commission_count;
END $$;