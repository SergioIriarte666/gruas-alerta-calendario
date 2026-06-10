-- Función específica para cerrar servicios sin disparar triggers de comisión
CREATE OR REPLACE FUNCTION public.close_service_status_only(p_service_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  service_folio text;
BEGIN
  -- Obtener folio del servicio para logging
  SELECT folio INTO service_folio
  FROM public.services
  WHERE id = p_service_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Servicio no encontrado'
    );
  END IF;
  
  -- Actualizar solo el estado sin disparar lógica de comisiones
  UPDATE public.services 
  SET 
    status = 'completed',
    updated_at = now()
  WHERE id = p_service_id;
  
  -- Verificar que se actualizó
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
    'message', 'Servicio cerrado exitosamente'
  );
END;
$$;