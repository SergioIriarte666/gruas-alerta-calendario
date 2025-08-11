-- Función para obtener estructura de tablas (necesaria para el dump SQL)
CREATE OR REPLACE FUNCTION public.get_table_structure(table_name text)
RETURNS TABLE(create_statement text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden obtener estructuras de tablas';
  END IF;

  RETURN QUERY
  SELECT 
    'CREATE TABLE IF NOT EXISTS public."' || table_name || '" (' ||
    string_agg(
      '"' || column_name || '" ' || 
      CASE 
        WHEN data_type = 'USER-DEFINED' THEN udt_name
        WHEN data_type = 'ARRAY' THEN 'text[]'
        ELSE data_type 
      END ||
      CASE WHEN character_maximum_length IS NOT NULL 
           THEN '(' || character_maximum_length || ')' 
           ELSE '' END ||
      CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
      CASE WHEN column_default IS NOT NULL 
           THEN ' DEFAULT ' || column_default 
           ELSE '' END,
      ', '
      ORDER BY ordinal_position
    ) || ');' as create_statement
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name = get_table_structure.table_name
  GROUP BY table_name;
END;
$$;

-- Función para auditoría completa del sistema de comisiones
CREATE OR REPLACE FUNCTION public.audit_commission_system()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  total_services INTEGER;
  completed_services INTEGER;
  services_with_operator INTEGER;
  services_with_resources INTEGER;
  total_commissions INTEGER;
  pending_commissions INTEGER;
  paid_commissions INTEGER;
  missing_commissions INTEGER;
  orphaned_commissions INTEGER;
  result jsonb;
BEGIN
  -- Verificar permisos
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar auditorías';
  END IF;

  -- Contar servicios totales
  SELECT COUNT(*) INTO total_services FROM public.services;
  
  -- Contar servicios completados
  SELECT COUNT(*) INTO completed_services 
  FROM public.services WHERE status = 'completed';
  
  -- Contar servicios con operator_id
  SELECT COUNT(*) INTO services_with_operator 
  FROM public.services WHERE operator_id IS NOT NULL;
  
  -- Contar servicios con service_resources
  SELECT COUNT(DISTINCT service_id) INTO services_with_resources 
  FROM public.service_resources WHERE resource_type = 'operator';
  
  -- Contar comisiones totales
  SELECT COUNT(*) INTO total_commissions 
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name = 'Comisión Operador';
  
  -- Contar comisiones pendientes
  SELECT COUNT(*) INTO pending_commissions 
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name = 'Comisión Operador' 
    AND c.subcategory = 'comisiones';
  
  -- Contar comisiones pagadas
  SELECT COUNT(*) INTO paid_commissions 
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name = 'Comisión Operador' 
    AND c.subcategory = 'comisiones_pagadas';
  
  -- Calcular comisiones faltantes (servicios completados con recursos pero sin comisión)
  SELECT COUNT(*) INTO missing_commissions
  FROM public.services s
  JOIN public.service_resources sr ON s.id = sr.service_id
  WHERE s.status = 'completed' 
    AND sr.resource_type = 'operator'
    AND sr.commission_amount > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.costs c
      JOIN public.cost_categories cc ON c.category_id = cc.id
      WHERE cc.name = 'Comisión Operador'
        AND c.service_id = s.id
        AND c.operator_id = sr.operator_id
    );
  
  -- Comisiones huérfanas (sin servicio o operador válido)
  SELECT COUNT(*) INTO orphaned_commissions
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name = 'Comisión Operador'
    AND (c.service_id IS NULL OR c.operator_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM public.services WHERE id = c.service_id)
         OR NOT EXISTS (SELECT 1 FROM public.operators WHERE id = c.operator_id));

  result := jsonb_build_object(
    'audit_date', now(),
    'services', jsonb_build_object(
      'total', total_services,
      'completed', completed_services,
      'with_operator_id', services_with_operator,
      'with_resources', services_with_resources
    ),
    'commissions', jsonb_build_object(
      'total', total_commissions,
      'pending', pending_commissions,
      'paid', paid_commissions,
      'missing', missing_commissions,
      'orphaned', orphaned_commissions
    ),
    'issues', jsonb_build_object(
      'services_without_operator_id', completed_services - services_with_operator,
      'missing_commissions', missing_commissions,
      'orphaned_commissions', orphaned_commissions
    )
  );

  RETURN result;
END;
$$;

-- Función para reparar comisiones masivamente
CREATE OR REPLACE FUNCTION public.repair_commission_system()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  commission_category_id UUID;
  repaired_count INTEGER := 0;
  synced_count INTEGER := 0;
  created_count INTEGER := 0;
  service_record RECORD;
  resource_record RECORD;
  result jsonb;
BEGIN
  -- Verificar permisos
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden reparar el sistema de comisiones';
  END IF;

  -- Obtener categoría de comisiones
  SELECT id INTO commission_category_id
  FROM public.cost_categories
  WHERE name = 'Comisión Operador';
  
  IF commission_category_id IS NULL THEN
    INSERT INTO public.cost_categories (name, description)
    VALUES ('Comisión Operador', 'Comisiones pagadas a operadores por servicios completados')
    RETURNING id INTO commission_category_id;
  END IF;

  -- PASO 1: Sincronizar operator_id desde service_resources a services
  FOR service_record IN 
    SELECT DISTINCT s.id as service_id, sr.operator_id, sr.commission_amount
    FROM public.services s
    JOIN public.service_resources sr ON s.id = sr.service_id
    WHERE sr.resource_type = 'operator' 
      AND sr.is_primary = true
      AND s.operator_id IS NULL
  LOOP
    UPDATE public.services 
    SET 
      operator_id = service_record.operator_id,
      operator_commission = service_record.commission_amount,
      updated_at = now()
    WHERE id = service_record.service_id;
    
    synced_count := synced_count + 1;
  END LOOP;

  -- PASO 2: Generar comisiones faltantes para servicios completados
  FOR resource_record IN 
    SELECT DISTINCT 
      s.id as service_id,
      s.folio,
      s.service_date,
      s.created_by,
      sr.operator_id,
      sr.commission_amount,
      o.name as operator_name
    FROM public.services s
    JOIN public.service_resources sr ON s.id = sr.service_id
    JOIN public.operators o ON sr.operator_id = o.id
    WHERE s.status = 'completed'
      AND sr.resource_type = 'operator'
      AND sr.commission_amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.costs c
        WHERE c.service_id = s.id 
          AND c.operator_id = sr.operator_id
          AND c.category_id = commission_category_id
      )
  LOOP
    INSERT INTO public.costs (
      amount,
      category_id,
      service_id,
      operator_id,
      service_folio,
      date,
      description,
      subcategory,
      notes,
      created_by
    ) VALUES (
      resource_record.commission_amount,
      commission_category_id,
      resource_record.service_id,
      resource_record.operator_id,
      resource_record.folio,
      resource_record.service_date,
      'Comisión por servicio ' || resource_record.folio || ' - Operador: ' || resource_record.operator_name,
      'comisiones',
      'Comisión generada por reparación masiva del sistema',
      resource_record.created_by
    );
    
    created_count := created_count + 1;
  END LOOP;

  -- PASO 3: Actualizar trigger para funcionar con service_resources
  DROP TRIGGER IF EXISTS generate_commission_on_service_completion ON public.services;
  
  CREATE TRIGGER generate_commission_on_service_completion
    AFTER UPDATE ON public.services
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_multiple_commissions_for_service();

  repaired_count := synced_count + created_count;

  result := jsonb_build_object(
    'success', true,
    'repair_date', now(),
    'services_synced', synced_count,
    'commissions_created', created_count,
    'total_repaired', repaired_count,
    'trigger_updated', true
  );

  RETURN result;
END;
$$;