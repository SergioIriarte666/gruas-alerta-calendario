-- ====================================================================
-- SISTEMA DE COMISIONES MÚLTIPLES - Soporte para Varios Operadores
-- ====================================================================
-- Actualiza el trigger para crear comisiones para TODOS los operadores
-- en service_resources, no solo el operador principal

-- 1. ACTUALIZAR TRIGGER: Procesar múltiples operadores
-- ====================================================================
CREATE OR REPLACE FUNCTION public.generate_commission_on_service_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  commission_category_id UUID;
  operator_name TEXT;
  existing_commission_count INTEGER;
  resource_record RECORD;
  commissions_created INTEGER := 0;
BEGIN
  -- Solo ejecutar cuando el servicio cambia a 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Obtener ID de categoría de comisiones
    SELECT id INTO commission_category_id 
    FROM public.cost_categories 
    WHERE name = 'Comisión Operador'
    LIMIT 1;
    
    -- Si no existe la categoría, crearla
    IF commission_category_id IS NULL THEN
      INSERT INTO public.cost_categories (name, description)
      VALUES ('Comisión Operador', 'Comisiones pagadas a operadores por servicios')
      RETURNING id INTO commission_category_id;
    END IF;
    
    -- PASO 1: Procesar operador principal (sistema legacy)
    -- Solo si tiene comisión > 0 y existe operator_id
    IF NEW.operator_commission > 0 AND NEW.operator_id IS NOT NULL THEN
      
      -- Verificar si ya existe comisión para el operador principal
      SELECT COUNT(*) INTO existing_commission_count
      FROM public.costs 
      WHERE service_id = NEW.id 
        AND operator_id = NEW.operator_id 
        AND category_id = commission_category_id;
      
      -- Solo crear si no existe
      IF existing_commission_count = 0 THEN
        -- Obtener nombre del operador
        SELECT name INTO operator_name
        FROM public.operators 
        WHERE id = NEW.operator_id;
        
        -- Insertar comisión del operador principal
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
          NEW.operator_commission,
          commission_category_id,
          NEW.service_date,
          'Comisión por servicio: ' || COALESCE(operator_name, 'Operador Principal'),
          NEW.id,
          NEW.folio,
          NEW.operator_id,
          'comisiones',
          NEW.created_by
        );
        
        commissions_created := commissions_created + 1;
        RAISE NOTICE 'Comisión creada para operador principal %: $%', operator_name, NEW.operator_commission;
      END IF;
    END IF;
    
    -- PASO 2: Procesar TODOS los operadores de service_resources
    -- Crear comisiones para cada operador con commission_amount > 0
    FOR resource_record IN 
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
      -- Verificar si ya existe comisión para este operador
      SELECT COUNT(*) INTO existing_commission_count
      FROM public.costs 
      WHERE service_id = NEW.id 
        AND operator_id = resource_record.operator_id 
        AND category_id = commission_category_id;
      
      -- Solo crear si no existe comisión previa
      IF existing_commission_count = 0 THEN
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
          NEW.service_date,
          'Comisión por servicio: ' || COALESCE(resource_record.operator_name, 'Operador'),
          NEW.id,
          NEW.folio,
          resource_record.operator_id,
          'comisiones',
          NEW.created_by
        );
        
        commissions_created := commissions_created + 1;
        RAISE NOTICE 'Comisión creada para operador adicional %: $%', 
          resource_record.operator_name, resource_record.commission_amount;
      ELSE
        RAISE NOTICE 'Comisión ya existe para operador %', resource_record.operator_name;
      END IF;
    END LOOP;
    
    IF commissions_created > 0 THEN
      RAISE NOTICE 'Total de comisiones creadas para servicio %: %', NEW.folio, commissions_created;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2. FUNCIÓN DE SINCRONIZACIÓN: Corregir servicios existentes
-- ====================================================================
CREATE OR REPLACE FUNCTION public.sync_missing_commissions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  service_record RECORD;
  resource_record RECORD;
  commission_category_id UUID;
  operator_name TEXT;
  existing_commission_count INTEGER;
  services_processed INTEGER := 0;
  commissions_created INTEGER := 0;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar la sincronización de comisiones';
  END IF;

  -- Obtener ID de categoría de comisiones
  SELECT id INTO commission_category_id
  FROM public.cost_categories
  WHERE name = 'Comisión Operador'
  LIMIT 1;
  
  IF commission_category_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Categoría "Comisión Operador" no encontrada'
    );
  END IF;

  -- Procesar servicios completados con operadores múltiples
  FOR service_record IN 
    SELECT DISTINCT
      s.id,
      s.folio,
      s.service_date,
      s.created_by
    FROM public.services s
    INNER JOIN public.service_resources sr ON s.id = sr.service_id
    WHERE s.status = 'completed'
      AND sr.resource_type = 'operator'
      AND sr.commission_amount > 0
      AND sr.operator_id IS NOT NULL
  LOOP
    services_processed := services_processed + 1;
    
    -- Procesar cada operador del servicio
    FOR resource_record IN
      SELECT 
        sr.operator_id,
        sr.commission_amount,
        o.name as operator_name
      FROM public.service_resources sr
      LEFT JOIN public.operators o ON sr.operator_id = o.id
      WHERE sr.service_id = service_record.id
        AND sr.resource_type = 'operator'
        AND sr.commission_amount > 0
        AND sr.operator_id IS NOT NULL
    LOOP
      -- Verificar si ya existe comisión para este operador
      SELECT COUNT(*) INTO existing_commission_count
      FROM public.costs
      WHERE service_id = service_record.id
        AND operator_id = resource_record.operator_id
        AND category_id = commission_category_id;
      
      -- Crear comisión si no existe
      IF existing_commission_count = 0 THEN
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
          'Comisión por servicio: ' || COALESCE(resource_record.operator_name, 'Operador') || ' [Sincronizado]',
          service_record.id,
          service_record.folio,
          resource_record.operator_id,
          'comisiones',
          service_record.created_by
        );
        
        commissions_created := commissions_created + 1;
        RAISE NOTICE 'Comisión sincronizada: Servicio %, Operador %, Monto $%',
          service_record.folio, resource_record.operator_name, resource_record.commission_amount;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'services_processed', services_processed,
    'commissions_created', commissions_created,
    'message', format('Sincronización completada: %s servicios procesados, %s comisiones creadas', 
      services_processed, commissions_created)
  );
END;
$function$;

-- 3. COMENTARIOS Y DOCUMENTACIÓN
-- ====================================================================
COMMENT ON FUNCTION public.generate_commission_on_service_completion() IS 
  'Trigger que crea comisiones automáticamente al completar servicios. 
   Procesa tanto el operador principal (legacy) como todos los operadores 
   adicionales registrados en service_resources con commission_amount > 0.
   Evita duplicados verificando existencia previa de comisiones.';

COMMENT ON FUNCTION public.sync_missing_commissions() IS
  'Función administrativa para sincronizar comisiones faltantes en servicios 
   ya completados. Procesa todos los operadores de service_resources y crea 
   las comisiones que no existen. Solo ejecutable por administradores.';