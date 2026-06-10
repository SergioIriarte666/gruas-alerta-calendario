-- SOLUCIÓN DEFINITIVA: Sistema de Comisiones - Parte 1
-- Diagnóstico y Corrección Masiva

-- 1. DIAGNÓSTICO COMPLETO: Identificar comisiones problemáticas
DO $$
DECLARE
  problematic_count INTEGER;
  total_count INTEGER;
BEGIN
  -- Contar comisiones sin operator_id
  SELECT COUNT(*) INTO problematic_count
  FROM costs c
  WHERE c.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
    AND c.operator_id IS NULL;
  
  -- Contar total de comisiones
  SELECT COUNT(*) INTO total_count
  FROM costs c
  WHERE c.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4';
  
  RAISE NOTICE '🔍 DIAGNÓSTICO: Se encontraron % comisiones sin operator_id de % totales', problematic_count, total_count;
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