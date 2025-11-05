
-- =========================================================================
-- CORRECCIÓN: Eliminar comisiones incorrectas y corregir sincronización
-- =========================================================================
-- Problema: sync_missing_commissions() creó comisiones para servicios 
-- donde services.operator_commission = 0
-- Solución: Eliminar comisiones incorrectas y agregar validación
-- =========================================================================

-- 1. Eliminar comisiones creadas incorrectamente el 2025-11-05
DELETE FROM costs
WHERE subcategory = 'comisiones'
  AND created_at = '2025-11-05 00:05:22.856874+00'
  AND service_id IN (
    SELECT id FROM services WHERE operator_commission = 0
  );

-- 2. Corregir función sync_missing_commissions() con validación
CREATE OR REPLACE FUNCTION sync_missing_commissions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_commission_category_id uuid;
  v_services_processed integer := 0;
  v_commissions_created integer := 0;
  v_service record;
BEGIN
  -- Obtener ID de categoría "Comisión Operador"
  SELECT id INTO v_commission_category_id
  FROM cost_categories
  WHERE name = 'Comisión Operador'
  LIMIT 1;

  IF v_commission_category_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se encontró la categoría "Comisión Operador"'
    );
  END IF;

  -- Procesar servicios completados que tienen operator_commission > 0
  -- pero no tienen comisión registrada en costs
  FOR v_service IN
    SELECT 
      s.id as service_id,
      s.folio,
      s.service_date,
      s.operator_id,
      s.operator_commission,
      s.value as service_value
    FROM services s
    WHERE s.status = 'completed'
      AND s.operator_id IS NOT NULL
      AND s.operator_commission > 0  -- ✅ VALIDACIÓN CRÍTICA
      AND NOT EXISTS (
        SELECT 1 
        FROM costs c 
        WHERE c.service_id = s.id 
          AND c.category_id = v_commission_category_id
      )
    ORDER BY s.service_date DESC
  LOOP
    v_services_processed := v_services_processed + 1;

    -- Crear comisión en tabla costs
    INSERT INTO costs (
      date,
      description,
      amount,
      category_id,
      subcategory,
      service_id,
      operator_id,
      created_at,
      updated_at
    ) VALUES (
      v_service.service_date,
      'Comisión servicio ' || v_service.folio,
      v_service.operator_commission,
      v_commission_category_id,
      'comisiones',
      v_service.service_id,
      v_service.operator_id,
      now(),
      now()
    );

    v_commissions_created := v_commissions_created + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'services_processed', v_services_processed,
    'commissions_created', v_commissions_created,
    'message', format('Procesados %s servicios, creadas %s comisiones', 
                     v_services_processed, v_commissions_created)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'services_processed', v_services_processed,
      'commissions_created', v_commissions_created
    );
END;
$$;

-- Comentario de documentación
COMMENT ON FUNCTION sync_missing_commissions() IS 
'Sincroniza comisiones faltantes para servicios completados.
SOLO crea comisiones si services.operator_commission > 0.
Uso: Botón manual en sección Comisiones para servicios antiguos sin comisión registrada.';
