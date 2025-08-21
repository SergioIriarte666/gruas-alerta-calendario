-- Mejorar la función emergency_close_service para manejar conflictos de índices únicos
CREATE OR REPLACE FUNCTION public.emergency_close_service(p_service_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  service_folio text;
  current_status service_status;
  existing_costs_count integer;
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

  -- Verificar si ya existen costos para este servicio
  SELECT COUNT(*) INTO existing_costs_count
  FROM public.costs
  WHERE service_id = p_service_id;

  -- Si ya existen costos, solo actualizar el estado sin crear nuevos costos
  IF existing_costs_count > 0 THEN
    UPDATE public.services 
    SET 
      status = 'completed'::service_status,
      updated_at = now()
    WHERE id = p_service_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'service_id', p_service_id,
      'service_folio', service_folio,
      'new_status', 'completed',
      'message', 'Servicio cerrado exitosamente (costos existentes preservados)',
      'existing_costs', existing_costs_count
    );
  END IF;
  
  -- DESHABILITAR TEMPORALMENTE TODOS LOS TRIGGERS RELACIONADOS
  ALTER TABLE public.costs DISABLE TRIGGER ALL;
  ALTER TABLE public.services DISABLE TRIGGER ALL;
  
  BEGIN
    -- Actualizar el estado del servicio
    UPDATE public.services 
    SET 
      status = 'completed'::service_status,
      updated_at = now()
    WHERE id = p_service_id;
    
    -- REHABILITAR TODOS LOS TRIGGERS INMEDIATAMENTE
    ALTER TABLE public.costs ENABLE TRIGGER ALL;
    ALTER TABLE public.services ENABLE TRIGGER ALL;
    
    RETURN jsonb_build_object(
      'success', true,
      'service_id', p_service_id,
      'service_folio', service_folio,
      'new_status', 'completed',
      'message', 'Servicio cerrado exitosamente sin triggers'
    );
    
  EXCEPTION
    WHEN unique_violation THEN
      -- REHABILITAR TRIGGERS EN CASO DE ERROR DE CLAVE ÚNICA
      ALTER TABLE public.costs ENABLE TRIGGER ALL;
      ALTER TABLE public.services ENABLE TRIGGER ALL;
      
      -- Solo actualizar el estado del servicio sin crear costos duplicados
      UPDATE public.services 
      SET 
        status = 'completed'::service_status,
        updated_at = now()
      WHERE id = p_service_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'service_id', p_service_id,
        'service_folio', service_folio,
        'new_status', 'completed',
        'message', 'Servicio cerrado exitosamente (evitando duplicados)'
      );
      
    WHEN OTHERS THEN
      -- ASEGURAR QUE TODOS LOS TRIGGERS SE REHABILITEN EN CASO DE CUALQUIER ERROR
      ALTER TABLE public.costs ENABLE TRIGGER ALL;
      ALTER TABLE public.services ENABLE TRIGGER ALL;
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Error en la actualización: ' || SQLERRM,
        'error_code', SQLSTATE
      );
  END;
END;
$$;