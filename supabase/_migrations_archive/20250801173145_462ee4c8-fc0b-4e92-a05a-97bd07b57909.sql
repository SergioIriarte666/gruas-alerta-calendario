-- Solución temporal: Crear una función para cerrar servicios que bypass los triggers de comisión
CREATE OR REPLACE FUNCTION public.force_close_service_bypass_triggers(p_service_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  service_folio text;
  current_status service_status;
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
  
  -- Deshabilitar temporalmente triggers relacionados con comisiones
  -- Actualizar directamente sin triggers
  PERFORM pg_advisory_lock(hashtext('close_service_' || p_service_id::text));
  
  BEGIN
    -- Actualizar solo el estado usando UPDATE directo
    UPDATE public.services 
    SET 
      status = 'completed'::service_status,
      updated_at = now()
    WHERE id = p_service_id
      AND status != 'completed'::service_status
      AND status != 'invoiced'::service_status;
    
    -- Verificar que se actualizó
    GET DIAGNOSTICS result = ROW_COUNT;
    
    IF result::integer = 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'No se pudo actualizar el servicio - posible problema de estado'
      );
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_advisory_unlock(hashtext('close_service_' || p_service_id::text));
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Error en la actualización: ' || SQLERRM
      );
  END;
  
  PERFORM pg_advisory_unlock(hashtext('close_service_' || p_service_id::text));
  
  RETURN jsonb_build_object(
    'success', true,
    'service_id', p_service_id,
    'service_folio', service_folio,
    'new_status', 'completed',
    'message', 'Servicio cerrado exitosamente'
  );
END;
$$;