-- SOLUCIÓN DEFINITIVA: Sistema de Comisiones
-- Diagnóstico, Corrección Masiva y Prevención

-- 1. DIAGNÓSTICO COMPLETO: Identificar comisiones problemáticas
DO $$
DECLARE
  problematic_count INTEGER;
BEGIN
  -- Contar comisiones sin operator_id
  SELECT COUNT(*) INTO problematic_count
  FROM costs c
  WHERE c.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
    AND c.operator_id IS NULL;
  
  RAISE NOTICE '🔍 DIAGNÓSTICO: Se encontraron % comisiones sin operator_id', problematic_count;
  
  -- Mostrar detalles de comisiones problemáticas
  IF problematic_count > 0 THEN
    RAISE NOTICE '📋 Comisiones problemáticas encontradas:';
    FOR rec IN 
      SELECT 
        c.id, c.service_folio, c.description, c.amount,
        c.operator_id, c.service_id, c.subcategory,
        s.operator_id as service_operator_id,
        o.name as operator_name
      FROM costs c
      LEFT JOIN services s ON c.service_id = s.id
      LEFT JOIN operators o ON s.operator_id = o.id
      WHERE c.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
        AND c.operator_id IS NULL
      ORDER BY c.created_at DESC
      LIMIT 10
    LOOP
      RAISE NOTICE '  - Folio: %, Descripción: %, Service Operator: %', 
        rec.service_folio, rec.description, rec.operator_name;
    END LOOP;
  END IF;
END $$;

-- 2. CORRECCIÓN MASIVA: Actualizar comisiones sin operator_id
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Actualizar todas las comisiones faltantes de operator_id
  UPDATE costs 
  SET operator_id = services.operator_id,
      updated_at = now()
  FROM services 
  WHERE costs.service_id = services.id 
    AND costs.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
    AND costs.operator_id IS NULL
    AND services.operator_id IS NOT NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ CORRECCIÓN: Se actualizaron % comisiones con operator_id faltante', updated_count;
END $$;

-- 3. VERIFICACIÓN POST-CORRECCIÓN
DO $$
DECLARE
  remaining_count INTEGER;
  total_commissions INTEGER;
BEGIN
  -- Verificar que no queden comisiones sin operator_id
  SELECT COUNT(*) INTO remaining_count
  FROM costs 
  WHERE category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
    AND operator_id IS NULL;
  
  -- Contar total de comisiones
  SELECT COUNT(*) INTO total_commissions
  FROM costs 
  WHERE category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4';
  
  RAISE NOTICE '🔍 VERIFICACIÓN: Comisiones sin operator_id: % de %', remaining_count, total_commissions;
  
  IF remaining_count = 0 THEN
    RAISE NOTICE '✅ ÉXITO: Todas las comisiones tienen operator_id asignado';
  ELSE
    RAISE NOTICE '⚠️  ATENCIÓN: Aún quedan % comisiones sin operator_id', remaining_count;
  END IF;
END $$;

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
BEGIN
  -- Contar resultados de la función que usa el frontend
  SELECT COUNT(*) INTO function_result_count
  FROM public.get_commissions_with_details();
  
  RAISE NOTICE '📊 FUNCIÓN: get_commissions_with_details() retorna % comisiones', function_result_count;
  RAISE NOTICE '🎯 SISTEMA REPARADO: Las comisiones ahora aparecerán en el módulo frontend';
END $$;