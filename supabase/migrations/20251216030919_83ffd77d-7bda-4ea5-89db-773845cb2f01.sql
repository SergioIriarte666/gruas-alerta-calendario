-- =====================================================
-- CORRECCIÓN DEL SISTEMA DE COMISIONES
-- Excluir permanentemente a los operadores Iriarte
-- =====================================================

-- PASO 1: Eliminar comisiones incorrectas de los Iriarte
DELETE FROM costs
WHERE subcategory IN ('comisiones', 'comisiones_pagadas')
  AND operator_id IN (
    '4e0077b0-1786-4832-9acf-44e5a7702d55', -- Jorge Iriarte
    '63d9636c-4ef7-4e62-90ab-abcff11b00fa', -- Jorge Ignacio Iriarte
    'fd13ec43-7da5-4da9-a06c-c8648e817d1a'  -- Sergio Iriarte
  );

-- PASO 2: Actualizar función sync_missing_commissions con exclusión de Iriarte
CREATE OR REPLACE FUNCTION public.sync_missing_commissions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commission_category_id uuid;
  v_services_processed integer := 0;
  v_commissions_created integer := 0;
  v_service record;
  v_operator record;
  v_existing_commission uuid;
  -- IDs de operadores Iriarte excluidos del sistema de comisiones
  v_excluded_operators uuid[] := ARRAY[
    '4e0077b0-1786-4832-9acf-44e5a7702d55'::uuid, -- Jorge Iriarte
    '63d9636c-4ef7-4e62-90ab-abcff11b00fa'::uuid, -- Jorge Ignacio Iriarte
    'fd13ec43-7da5-4da9-a06c-c8648e817d1a'::uuid  -- Sergio Iriarte
  ];
BEGIN
  -- Obtener el ID de la categoría "Comisión Operador"
  SELECT id INTO v_commission_category_id 
  FROM cost_categories 
  WHERE name = 'Comisión Operador';
  
  IF v_commission_category_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Categoría "Comisión Operador" no encontrada',
      'services_processed', 0,
      'commissions_created', 0
    );
  END IF;

  -- Iterar sobre servicios completados con comisión > 0
  FOR v_service IN 
    SELECT s.id, s.folio, s.service_date, s.operator_commission
    FROM services s
    WHERE s.status = 'completed'
      AND s.operator_commission IS NOT NULL 
      AND s.operator_commission > 0
  LOOP
    v_services_processed := v_services_processed + 1;
    
    -- Para cada operador principal del servicio (excluyendo Iriarte)
    FOR v_operator IN
      SELECT sr.operator_id
      FROM service_resources sr
      WHERE sr.service_id = v_service.id
        AND sr.operator_role = 'Principal'
        AND sr.operator_id IS NOT NULL
        AND sr.operator_id != ALL(v_excluded_operators) -- Excluir Iriarte
    LOOP
      -- Verificar si ya existe comisión para este operador y servicio
      SELECT id INTO v_existing_commission
      FROM costs
      WHERE service_id = v_service.id
        AND operator_id = v_operator.operator_id
        AND category_id = v_commission_category_id;
      
      -- Si no existe, crear la comisión
      IF v_existing_commission IS NULL THEN
        INSERT INTO costs (
          date,
          description,
          amount,
          category_id,
          subcategory,
          operator_id,
          service_id,
          service_folio
        ) VALUES (
          v_service.service_date,
          'Comisión por servicio ' || v_service.folio,
          v_service.operator_commission,
          v_commission_category_id,
          'comisiones',
          v_operator.operator_id,
          v_service.id,
          v_service.folio
        );
        
        v_commissions_created := v_commissions_created + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'services_processed', v_services_processed,
    'commissions_created', v_commissions_created,
    'message', 'Sincronización completada. Operadores Iriarte excluidos automáticamente.'
  );
END;
$$;

-- PASO 3: Actualizar trigger generate_commission_on_service_completion con exclusión de Iriarte
CREATE OR REPLACE FUNCTION public.generate_commission_on_service_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commission_category_id uuid;
  v_operator record;
  v_existing_commission uuid;
  -- IDs de operadores Iriarte excluidos del sistema de comisiones
  v_excluded_operators uuid[] := ARRAY[
    '4e0077b0-1786-4832-9acf-44e5a7702d55'::uuid, -- Jorge Iriarte
    '63d9636c-4ef7-4e62-90ab-abcff11b00fa'::uuid, -- Jorge Ignacio Iriarte
    'fd13ec43-7da5-4da9-a06c-c8648e817d1a'::uuid  -- Sergio Iriarte
  ];
BEGIN
  -- Solo procesar si el servicio cambió a 'completed' y tiene comisión asignada
  IF NEW.status = 'completed' 
     AND (OLD.status IS NULL OR OLD.status != 'completed')
     AND NEW.operator_commission IS NOT NULL 
     AND NEW.operator_commission > 0 THEN
    
    -- Obtener el ID de la categoría "Comisión Operador"
    SELECT id INTO v_commission_category_id 
    FROM cost_categories 
    WHERE name = 'Comisión Operador';
    
    IF v_commission_category_id IS NULL THEN
      RAISE WARNING 'Categoría "Comisión Operador" no encontrada';
      RETURN NEW;
    END IF;

    -- Para cada operador principal del servicio (excluyendo Iriarte)
    FOR v_operator IN
      SELECT sr.operator_id
      FROM service_resources sr
      WHERE sr.service_id = NEW.id
        AND sr.operator_role = 'Principal'
        AND sr.operator_id IS NOT NULL
        AND sr.operator_id != ALL(v_excluded_operators) -- Excluir Iriarte
    LOOP
      -- Verificar si ya existe comisión para este operador y servicio
      SELECT id INTO v_existing_commission
      FROM costs
      WHERE service_id = NEW.id
        AND operator_id = v_operator.operator_id
        AND category_id = v_commission_category_id;
      
      -- Si no existe, crear la comisión
      IF v_existing_commission IS NULL THEN
        INSERT INTO costs (
          date,
          description,
          amount,
          category_id,
          subcategory,
          operator_id,
          service_id,
          service_folio
        ) VALUES (
          NEW.service_date,
          'Comisión por servicio ' || NEW.folio,
          NEW.operator_commission,
          v_commission_category_id,
          'comisiones',
          v_operator.operator_id,
          NEW.id,
          NEW.folio
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Comentario documentando la regla de negocio
COMMENT ON FUNCTION public.sync_missing_commissions() IS 'Sincroniza comisiones faltantes para servicios completados. EXCLUYE automáticamente a Jorge Iriarte, Sergio Iriarte y Jorge Ignacio Iriarte del sistema de comisiones (regla de negocio).';

COMMENT ON FUNCTION public.generate_commission_on_service_completion() IS 'Trigger que genera comisiones automáticamente al completar un servicio. EXCLUYE automáticamente a Jorge Iriarte, Sergio Iriarte y Jorge Ignacio Iriarte del sistema de comisiones (regla de negocio).';