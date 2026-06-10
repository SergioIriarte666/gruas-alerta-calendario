
-- ============================================
-- SOLUCIÓN DEFINITIVA: Restaurar Sistema de Comisiones Automáticas
-- ============================================
-- Problema: El trigger que crea comisiones automáticamente fue eliminado
-- Solución: Recrear trigger + sincronizar comisiones faltantes

-- 1. RECREAR LA FUNCIÓN DEL TRIGGER (versión robusta)
CREATE OR REPLACE FUNCTION public.generate_commission_on_service_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_commission_category_id UUID;
  v_resource RECORD;
BEGIN
  -- Solo procesar cuando el servicio cambia a 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Obtener el ID de la categoría "Comisión Operador"
    SELECT id INTO v_commission_category_id
    FROM public.cost_categories
    WHERE name = 'Comisión Operador'
    LIMIT 1;

    IF v_commission_category_id IS NULL THEN
      RAISE EXCEPTION 'No se encontró la categoría "Comisión Operador"';
    END IF;

    -- Crear comisiones basadas en service_resources
    FOR v_resource IN 
      SELECT 
        sr.operator_id,
        sr.commission_amount,
        o.name as operator_name
      FROM public.service_resources sr
      LEFT JOIN public.operators o ON sr.operator_id = o.id
      WHERE sr.service_id = NEW.id
        AND sr.resource_type = 'operator'
        AND sr.commission_amount > 0
        AND sr.operator_id IS NOT NULL
    LOOP
      -- Verificar que no exista ya una comisión para este operador y servicio
      IF NOT EXISTS (
        SELECT 1 FROM public.costs
        WHERE service_id = NEW.id
          AND operator_id = v_resource.operator_id
          AND category_id = v_commission_category_id
      ) THEN
        -- Crear el registro de comisión en costs
        INSERT INTO public.costs (
          date,
          description,
          amount,
          category_id,
          subcategory,
          service_id,
          service_folio,
          operator_id,
          created_by
        ) VALUES (
          NEW.service_date,
          'Comisión - ' || COALESCE(v_resource.operator_name, 'Operador') || ' - Servicio ' || NEW.folio,
          v_resource.commission_amount,
          v_commission_category_id,
          'comisiones', -- Marca como pendiente de pago
          NEW.id,
          NEW.folio,
          v_resource.operator_id,
          auth.uid()
        );
        
        RAISE NOTICE 'Comisión creada automáticamente: Servicio % - Operador % - Monto %', 
          NEW.folio, v_resource.operator_id, v_resource.commission_amount;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. RECREAR EL TRIGGER (asegurar que existe y está activo)
DROP TRIGGER IF EXISTS generate_commission_on_service_completion_trigger ON public.services;

CREATE TRIGGER generate_commission_on_service_completion_trigger
  AFTER UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_commission_on_service_completion();

-- 3. SINCRONIZAR COMISIONES FALTANTES (ejecutar inmediatamente)
DO $$
DECLARE
  v_commission_category_id UUID;
  v_service RECORD;
  v_resource RECORD;
  v_commissions_created INTEGER := 0;
  v_services_processed INTEGER := 0;
BEGIN
  -- Obtener el ID de la categoría "Comisión Operador"
  SELECT id INTO v_commission_category_id
  FROM public.cost_categories
  WHERE name = 'Comisión Operador'
  LIMIT 1;

  IF v_commission_category_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró la categoría "Comisión Operador"';
  END IF;

  RAISE NOTICE '🔄 Iniciando sincronización de comisiones faltantes...';

  -- Procesar todos los servicios completados que tienen comisiones en service_resources
  FOR v_service IN 
    SELECT DISTINCT s.id, s.folio, s.service_date
    FROM public.services s
    JOIN public.service_resources sr ON s.id = sr.service_id
    WHERE s.status = 'completed'
      AND sr.resource_type = 'operator'
      AND sr.commission_amount > 0
      AND sr.operator_id IS NOT NULL
    ORDER BY s.service_date DESC
  LOOP
    v_services_processed := v_services_processed + 1;
    
    -- Para cada operador del servicio
    FOR v_resource IN 
      SELECT 
        sr.operator_id,
        sr.commission_amount,
        o.name as operator_name
      FROM public.service_resources sr
      LEFT JOIN public.operators o ON sr.operator_id = o.id
      WHERE sr.service_id = v_service.id
        AND sr.resource_type = 'operator'
        AND sr.commission_amount > 0
        AND sr.operator_id IS NOT NULL
    LOOP
      -- Verificar si ya existe la comisión
      IF NOT EXISTS (
        SELECT 1 FROM public.costs
        WHERE service_id = v_service.id
          AND operator_id = v_resource.operator_id
          AND category_id = v_commission_category_id
      ) THEN
        -- Crear la comisión faltante
        INSERT INTO public.costs (
          date,
          description,
          amount,
          category_id,
          subcategory,
          service_id,
          service_folio,
          operator_id
        ) VALUES (
          v_service.service_date,
          'Comisión - ' || COALESCE(v_resource.operator_name, 'Operador') || ' - Servicio ' || v_service.folio,
          v_resource.commission_amount,
          v_commission_category_id,
          'comisiones',
          v_service.id,
          v_service.folio,
          v_resource.operator_id
        );
        
        v_commissions_created := v_commissions_created + 1;
        RAISE NOTICE '✅ Comisión creada: Servicio % - Operador % - Monto %', 
          v_service.folio, v_resource.operator_id, v_resource.commission_amount;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE '🎉 Sincronización completada: % comisiones creadas en % servicios procesados', 
    v_commissions_created, v_services_processed;
END;
$$;

-- 4. COMENTARIOS Y DOCUMENTACIÓN
COMMENT ON FUNCTION public.generate_commission_on_service_completion() IS 
'TRIGGER AUTOMÁTICO: Crea comisiones en tabla costs cuando un servicio cambia a estado completed. 
Lee los datos de service_resources y crea un registro en costs por cada operador con comisión > 0.
Versión: 2025-10-31 - Solución definitiva tras problema de comisiones faltantes.';

COMMENT ON TRIGGER generate_commission_on_service_completion_trigger ON public.services IS
'Trigger que ejecuta generate_commission_on_service_completion() cuando se actualiza un servicio a completed.
CRÍTICO: No eliminar este trigger - es esencial para el sistema de comisiones automáticas.';
