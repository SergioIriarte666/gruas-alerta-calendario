-- Fix duplicate commissions issue by simplifying emergency_close_service
-- This migration removes commission creation logic from emergency_close_service
-- The existing trigger generate_commission_on_service_completion_trigger will handle commission creation

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
  existing_commissions_count integer;
  commission_category_id uuid;
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

  -- Obtener ID de categoría de comisiones para información
  SELECT id INTO commission_category_id
  FROM public.cost_categories 
  WHERE name ILIKE '%comisi%' 
  LIMIT 1;

  -- Contar costos existentes solo para información
  SELECT COUNT(*) INTO existing_costs_count
  FROM public.costs
  WHERE service_id = p_service_id;

  -- Contar comisiones existentes solo para información
  SELECT COUNT(*) INTO existing_commissions_count
  FROM public.costs
  WHERE service_id = p_service_id 
    AND category_id = commission_category_id;

  -- SOLUCIÓN SIMPLIFICADA: Solo actualizar el estado del servicio
  -- El trigger generate_commission_on_service_completion_trigger se encargará de crear las comisiones automáticamente
  BEGIN
    UPDATE public.services 
    SET 
      status = 'completed'::service_status,
      updated_at = now()
    WHERE id = p_service_id;
    
    -- Verificar que la actualización fue exitosa
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'No se pudo actualizar el servicio'
      );
    END IF;
    
    RETURN jsonb_build_object(
      'success', true,
      'service_id', p_service_id,
      'service_folio', service_folio,
      'new_status', 'completed',
      'message', 'Servicio cerrado exitosamente - comisiones creadas automáticamente por trigger',
      'existing_costs_before', existing_costs_count,
      'existing_commissions_before', existing_commissions_count,
      'note', 'Las comisiones son manejadas automáticamente por el trigger del sistema'
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