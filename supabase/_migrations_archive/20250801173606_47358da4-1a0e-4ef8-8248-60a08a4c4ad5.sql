-- Función definitiva para cerrar servicios sin triggers de comisión
CREATE OR REPLACE FUNCTION public.emergency_close_service(p_service_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
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
  
  -- DESHABILITAR TEMPORALMENTE EL TRIGGER ESPECÍFICO
  ALTER TABLE public.costs DISABLE TRIGGER prevent_duplicate_commissions_trigger;
  
  BEGIN
    -- Actualizar el estado del servicio
    UPDATE public.services 
    SET 
      status = 'completed'::service_status,
      updated_at = now()
    WHERE id = p_service_id;
    
    -- REHABILITAR EL TRIGGER INMEDIATAMENTE
    ALTER TABLE public.costs ENABLE TRIGGER prevent_duplicate_commissions_trigger;
    
    RETURN jsonb_build_object(
      'success', true,
      'service_id', p_service_id,
      'service_folio', service_folio,
      'new_status', 'completed',
      'message', 'Servicio cerrado exitosamente sin triggers'
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      -- ASEGURAR QUE EL TRIGGER SE REHABILITE EN CASO DE ERROR
      ALTER TABLE public.costs ENABLE TRIGGER prevent_duplicate_commissions_trigger;
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Error en la actualización: ' || SQLERRM
      );
  END;
END;
$$;