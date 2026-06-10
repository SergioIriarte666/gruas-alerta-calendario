-- =====================================================
-- CORRECCIÓN DEFINITIVA DEL SISTEMA DE COMISIONES
-- =====================================================
-- 
-- PROBLEMAS RESUELTOS:
-- 1. Función sync_missing_commissions() con estado 'scheduled' inválido
-- 2. Triggers duplicados causando conflictos
-- 3. Comisiones no creadas automáticamente
--
-- SOLUCIÓN:
-- 1. Corregir estados válidos en sync_missing_commissions()
-- 2. Eliminar trigger duplicado (mantener solo uno)
-- 3. Reforzar trigger de creación automática
-- 4. Sincronizar todas las comisiones faltantes
-- =====================================================

-- PASO 1: CORREGIR FUNCIÓN sync_missing_commissions()
-- Remover 'scheduled' que no existe en el enum service_status
CREATE OR REPLACE FUNCTION public.sync_missing_commissions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  commission_category_id UUID;
  services_processed INTEGER := 0;
  commissions_created INTEGER := 0;
  service_record RECORD;
  resource_record RECORD;
  operator_name TEXT;
BEGIN
  RAISE NOTICE '🔄 Iniciando sincronización de comisiones faltantes...';
  
  -- Obtener ID de categoría de comisiones
  SELECT id INTO commission_category_id
  FROM public.cost_categories 
  WHERE name = 'Comisión Operador'
  LIMIT 1;
  
  IF commission_category_id IS NULL THEN
    RAISE WARNING '❌ Categoría de comisiones no encontrada';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Categoría de comisiones no encontrada'
    );
  END IF;
  
  RAISE NOTICE '✅ Categoría de comisiones encontrada: %', commission_category_id;
  
  -- Buscar servicios con comisiones en service_resources pero sin costos correspondientes
  -- CORRECCIÓN: Solo estados válidos del enum: completed, with_purchase_order, invoiced, in_progress
  FOR service_record IN 
    SELECT DISTINCT s.id, s.folio, s.service_date, s.created_by, s.status
    FROM public.services s
    INNER JOIN public.service_resources sr ON s.id = sr.service_id
    WHERE sr.commission_amount > 0 
      AND sr.operator_id IS NOT NULL
      AND s.status IN ('completed', 'with_purchase_order', 'invoiced', 'in_progress')
      AND NOT EXISTS (
        SELECT 1 FROM public.costs c 
        WHERE c.service_id = s.id 
          AND c.operator_id = sr.operator_id
          AND c.category_id = commission_category_id
      )
  LOOP
    services_processed := services_processed + 1;
    RAISE NOTICE '📋 Procesando servicio: % (estado: %)', service_record.folio, service_record.status;
    
    -- Procesar cada operador con comisión en este servicio
    FOR resource_record IN 
      SELECT sr.operator_id, sr.commission_amount, o.name as operator_name
      FROM public.service_resources sr
      LEFT JOIN public.operators o ON sr.operator_id = o.id
      WHERE sr.service_id = service_record.id
        AND sr.commission_amount > 0
        AND sr.operator_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.costs c 
          WHERE c.service_id = service_record.id 
            AND c.operator_id = sr.operator_id
            AND c.category_id = commission_category_id
        )
    LOOP
      -- Insertar comisión faltante
      INSERT INTO public.costs (
        amount,
        category_id,
        date,
        description,
        service_id,
        service_folio,
        operator_id,
        subcategory,
        created_by
      ) VALUES (
        resource_record.commission_amount,
        commission_category_id,
        service_record.service_date,
        'Comisión por servicio: ' || COALESCE(resource_record.operator_name, 'Operador') || ' [Sincronización automática]',
        service_record.id,
        service_record.folio,
        resource_record.operator_id,
        'comisiones',
        service_record.created_by
      );
      
      commissions_created := commissions_created + 1;
      
      RAISE NOTICE '✅ Comisión creada: Servicio %, Operador %, Monto $%', 
        service_record.folio, resource_record.operator_name, resource_record.commission_amount;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '🎉 Sincronización completada: % comisiones creadas en % servicios', 
    commissions_created, services_processed;
  
  RETURN jsonb_build_object(
    'success', true,
    'services_processed', services_processed,
    'commissions_created', commissions_created,
    'message', format('Sincronización completada: %s comisiones creadas en %s servicios', commissions_created, services_processed)
  );
END;
$$;

COMMENT ON FUNCTION public.sync_missing_commissions() IS 
  'Sincroniza comisiones faltantes de servicios completados. 
   Estados válidos: completed, with_purchase_order, invoiced, in_progress.
   Versión corregida sin estado "scheduled" inválido.';

-- PASO 2: ELIMINAR TRIGGER DUPLICADO
DROP TRIGGER IF EXISTS generate_commission_on_completion ON public.services;

-- PASO 3: REFORZAR TRIGGER PRINCIPAL
CREATE OR REPLACE FUNCTION public.generate_commission_on_service_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  commission_category_id UUID;
  resource_record RECORD;
  operator_name TEXT;
  commission_count INTEGER := 0;
BEGIN
  -- Solo ejecutar cuando el servicio cambia a 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    RAISE NOTICE '🔔 Trigger activado para servicio: % (% -> %)', NEW.folio, OLD.status, NEW.status;
    
    -- Obtener ID de categoría de comisiones
    SELECT id INTO commission_category_id 
    FROM public.cost_categories 
    WHERE name = 'Comisión Operador'
    LIMIT 1;
    
    IF commission_category_id IS NULL THEN
      RAISE WARNING '❌ Categoría "Comisión Operador" no encontrada';
      RETURN NEW;
    END IF;
    
    -- Procesar TODOS los operadores del servicio con comisión
    FOR resource_record IN 
      SELECT 
        sr.operator_id,
        sr.commission_amount,
        o.name as operator_name
      FROM public.service_resources sr
      LEFT JOIN public.operators o ON sr.operator_id = o.id
      WHERE sr.service_id = NEW.id
        AND sr.commission_amount > 0
        AND sr.operator_id IS NOT NULL
    LOOP
      -- Verificar que no exista comisión previa para este operador
      IF NOT EXISTS (
        SELECT 1 FROM public.costs 
        WHERE service_id = NEW.id 
          AND operator_id = resource_record.operator_id 
          AND category_id = commission_category_id
      ) THEN
        -- Crear registro de comisión en costs
        INSERT INTO public.costs (
          amount,
          category_id,
          service_id,
          operator_id,
          service_folio,
          date,
          description,
          subcategory,
          created_by
        ) VALUES (
          resource_record.commission_amount,
          commission_category_id,
          NEW.id,
          resource_record.operator_id,
          NEW.folio,
          NEW.service_date,
          'Comisión por servicio ' || NEW.folio || ' - ' || COALESCE(resource_record.operator_name, 'Operador'),
          'comisiones',
          NEW.created_by
        );
        
        commission_count := commission_count + 1;
        RAISE NOTICE '✅ Comisión creada automáticamente: $% para operador % (servicio %)', 
          resource_record.commission_amount, resource_record.operator_name, NEW.folio;
      ELSE
        RAISE NOTICE '⚠️ Comisión ya existe para operador % en servicio %', 
          resource_record.operator_name, NEW.folio;
      END IF;
    END LOOP;
    
    IF commission_count = 0 THEN
      RAISE NOTICE '⚠️ No se crearon comisiones para servicio % (sin operadores con comisión)', NEW.folio;
    ELSE
      RAISE NOTICE '🎉 Total de comisiones creadas para servicio %: %', NEW.folio, commission_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.generate_commission_on_service_completion() IS 
  'Trigger que crea comisiones automáticamente al completar servicios.
   Procesa TODOS los operadores registrados en service_resources con commission_amount > 0.
   Evita duplicados verificando existencia previa de comisiones.
   Versión optimizada con logging detallado.';

-- PASO 4: ASEGURAR QUE EL TRIGGER ESTÁ ACTIVO
DROP TRIGGER IF EXISTS generate_commission_on_service_completion_trigger ON public.services;

CREATE TRIGGER generate_commission_on_service_completion_trigger
  AFTER UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_commission_on_service_completion();

-- PASO 5: EJECUTAR SINCRONIZACIÓN INMEDIATA
DO $$
DECLARE
  sync_result jsonb;
BEGIN
  RAISE NOTICE '🚀 Ejecutando sincronización inmediata de comisiones faltantes...';
  
  SELECT public.sync_missing_commissions() INTO sync_result;
  
  RAISE NOTICE '📊 Resultado de sincronización: %', sync_result;
END;
$$;

-- PASO 6: VERIFICACIÓN FINAL
DO $$
DECLARE
  trigger_count INTEGER;
  pending_count INTEGER;
  paid_count INTEGER;
  total_pending_amount NUMERIC;
BEGIN
  -- Contar triggers activos
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgname LIKE '%commission%'
    AND tgrelid = 'public.services'::regclass
    AND tgenabled = 'O';
  
  -- Contar comisiones
  SELECT 
    COUNT(*) FILTER (WHERE subcategory = 'comisiones'),
    COUNT(*) FILTER (WHERE subcategory = 'comisiones_pagadas'),
    COALESCE(SUM(amount) FILTER (WHERE subcategory = 'comisiones'), 0)
  INTO pending_count, paid_count, total_pending_amount
  FROM public.costs
  WHERE category_id = (SELECT id FROM public.cost_categories WHERE name = 'Comisión Operador' LIMIT 1);
  
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '✅ VERIFICACIÓN FINAL DEL SISTEMA DE COMISIONES';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE 'Triggers activos: %', trigger_count;
  RAISE NOTICE 'Comisiones pendientes: % ($%)', pending_count, total_pending_amount;
  RAISE NOTICE 'Comisiones pagadas: %', paid_count;
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  
  IF trigger_count != 1 THEN
    RAISE WARNING '⚠️ ADVERTENCIA: Debe haber exactamente 1 trigger activo, pero hay %', trigger_count;
  END IF;
END;
$$;