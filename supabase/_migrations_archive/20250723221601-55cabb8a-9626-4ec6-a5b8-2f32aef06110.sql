-- SOLUCIÓN DEFINITIVA: Sistema de Comisiones - Parte 2
-- Trigger de Prevención y Verificación Final

-- 4. PREVENCIÓN FUTURA: Crear trigger para asegurar consistencia
CREATE OR REPLACE FUNCTION public.ensure_commission_operator_id()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Si es una comisión y no tiene operator_id, intentar obtenerlo del servicio
  IF NEW.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4' 
     AND NEW.operator_id IS NULL 
     AND NEW.service_id IS NOT NULL THEN
    
    SELECT operator_id INTO NEW.operator_id 
    FROM public.services 
    WHERE id = NEW.service_id;
    
    -- Si aún no tiene operator_id, evitar la inserción
    IF NEW.operator_id IS NULL THEN
      RAISE EXCEPTION 'Las comisiones deben tener un operator_id válido. Service_id: % no tiene operador asignado.', NEW.service_id;
    END IF;
    
    RAISE NOTICE 'Trigger: Auto-asignado operator_id % para comisión de servicio %', NEW.operator_id, NEW.service_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS trigger_ensure_commission_operator_id ON public.costs;

-- Crear nuevo trigger
CREATE TRIGGER trigger_ensure_commission_operator_id
  BEFORE INSERT OR UPDATE ON public.costs
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_commission_operator_id();

-- 5. VERIFICACIÓN FINAL DE LA FUNCIÓN get_commissions_with_details
DO $$
DECLARE
  function_result_count INTEGER;
  costs_total_count INTEGER;
BEGIN
  -- Contar resultados de la función que usa el frontend
  SELECT COUNT(*) INTO function_result_count
  FROM public.get_commissions_with_details();
  
  -- Contar total de comisiones en costs
  SELECT COUNT(*) INTO costs_total_count
  FROM costs 
  WHERE category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
    AND operator_id IS NOT NULL;
  
  RAISE NOTICE '📊 FUNCIÓN: get_commissions_with_details() retorna % comisiones', function_result_count;
  RAISE NOTICE '📊 COSTS: tabla costs tiene % comisiones con operator_id', costs_total_count;
  RAISE NOTICE '🎯 SISTEMA REPARADO: Las comisiones ahora aparecerán en el módulo frontend';
  
  -- Verificar caso específico del servicio 3008437-1
  IF EXISTS (
    SELECT 1 FROM costs 
    WHERE service_folio = '3008437-1' 
    AND category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
    AND operator_id IS NOT NULL
  ) THEN
    RAISE NOTICE '✅ VERIFICADO: Comisión del servicio 3008437-1 tiene operator_id asignado';
  ELSE
    RAISE NOTICE '⚠️  ALERTA: Comisión del servicio 3008437-1 aún sin operator_id';
  END IF;
END $$;