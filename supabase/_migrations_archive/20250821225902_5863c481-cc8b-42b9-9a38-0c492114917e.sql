-- Corregir la función emergency_close_service para evitar errores de permisos
CREATE OR REPLACE FUNCTION public.emergency_close_service(p_service_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  service_folio text;
  current_status service_status;
  existing_costs_count integer;
  commission_category_id uuid;
  existing_commissions_count integer;
BEGIN
  -- Obtener información del servicio
  SELECT folio, status INTO service_folio, current_status
  FROM public.services
  WHERE id = p_service_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Servicio no encontrado'
    );
  END IF;
  
  -- Verificar que no esté ya completado
  IF current_status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'service_id', p_service_id,
      'service_folio', service_folio,
      'message', 'El servicio ya está completado'
    );
  END IF;
  
  -- Verificar que no esté facturado
  IF current_status = 'invoiced' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se puede cerrar un servicio facturado'
    );
  END IF;

  -- Obtener ID de categoría de comisiones
  SELECT id INTO commission_category_id
  FROM public.cost_categories 
  WHERE name ILIKE '%comisi%' 
  LIMIT 1;

  -- Verificar si ya existen costos para este servicio
  SELECT COUNT(*) INTO existing_costs_count
  FROM public.costs
  WHERE service_id = p_service_id;

  -- Verificar si ya existen comisiones específicamente
  SELECT COUNT(*) INTO existing_commissions_count
  FROM public.costs
  WHERE service_id = p_service_id 
    AND category_id = commission_category_id;

  -- ESTRATEGIA MEJORADA: Usar UPSERT en lugar de DELETE/INSERT
  BEGIN
    -- Solo actualizar el estado del servicio
    UPDATE public.services 
    SET 
      status = 'completed'::service_status,
      updated_at = now()
    WHERE id = p_service_id;
    
    -- Si no existen comisiones y hay operadores, crearlas usando ON CONFLICT DO NOTHING
    IF existing_commissions_count = 0 AND commission_category_id IS NOT NULL THEN
      
      -- Insertar comisiones para operadores adicionales (si existen) usando UPSERT
      INSERT INTO public.costs (
        service_id,
        operator_id,
        category_id,
        amount,
        date,
        description,
        subcategory,
        notes
      )
      SELECT 
        sr.service_id,
        sr.operator_id,
        commission_category_id,
        COALESCE(sr.commission_amount, 0),
        s.service_date,
        'Comisión operador - Servicio ' || s.folio,
        'Comisiones',
        'Comisión automática al cerrar servicio'
      FROM public.service_resources sr
      JOIN public.services s ON sr.service_id = s.id
      WHERE sr.service_id = p_service_id 
        AND sr.resource_type = 'operator'
        AND sr.is_primary = false
        AND sr.operator_id IS NOT NULL
        AND sr.commission_amount > 0
      ON CONFLICT (service_id, operator_id, category_id) DO NOTHING;
      
    END IF;
    
    RETURN jsonb_build_object(
      'success', true,
      'service_id', p_service_id,
      'service_folio', service_folio,
      'new_status', 'completed',
      'message', 'Servicio cerrado exitosamente',
      'existing_costs', existing_costs_count,
      'existing_commissions', existing_commissions_count
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Error al cerrar servicio: ' || SQLERRM,
        'error_code', SQLSTATE,
        'service_id', p_service_id,
        'service_folio', service_folio
      );
  END;
END;
$function$;

-- Crear una función auxiliar para detectar y resolver conflictos de comisiones
CREATE OR REPLACE FUNCTION public.resolve_commission_conflicts(p_service_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  commission_category_id uuid;
  conflicts_found integer := 0;
  conflicts_resolved integer := 0;
BEGIN
  -- Obtener ID de categoría de comisiones
  SELECT id INTO commission_category_id
  FROM public.cost_categories 
  WHERE name ILIKE '%comisi%' 
  LIMIT 1;
  
  IF commission_category_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Categoría de comisiones no encontrada'
    );
  END IF;
  
  -- Contar conflictos duplicados
  SELECT COUNT(*) INTO conflicts_found
  FROM (
    SELECT service_id, operator_id, category_id, COUNT(*) as duplicates
    FROM public.costs 
    WHERE service_id = p_service_id 
      AND category_id = commission_category_id
      AND operator_id IS NOT NULL
    GROUP BY service_id, operator_id, category_id
    HAVING COUNT(*) > 1
  ) duplicates;
  
  -- Resolver conflictos manteniendo solo el más reciente
  IF conflicts_found > 0 THEN
    DELETE FROM public.costs 
    WHERE id IN (
      SELECT id FROM (
        SELECT id, 
               ROW_NUMBER() OVER (
                 PARTITION BY service_id, operator_id, category_id 
                 ORDER BY created_at DESC
               ) as rn
        FROM public.costs 
        WHERE service_id = p_service_id 
          AND category_id = commission_category_id
          AND operator_id IS NOT NULL
      ) ranked 
      WHERE rn > 1
    );
    
    GET DIAGNOSTICS conflicts_resolved = ROW_COUNT;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'service_id', p_service_id,
    'conflicts_found', conflicts_found,
    'conflicts_resolved', conflicts_resolved,
    'message', format('Resueltos %s conflictos de comisiones', conflicts_resolved)
  );
END;
$function$;