-- Función para actualizar estado de servicios facturados
CREATE OR REPLACE FUNCTION public.force_update_service_to_invoiced(p_service_id uuid, p_invoice_folio text, p_numero_fiscal text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  service_before record;
  service_after record;
BEGIN
  -- Obtener estado actual del servicio
  SELECT id, folio, status, invoice_folio, invoice_numero_fiscal, updated_at
  INTO service_before
  FROM public.services
  WHERE id = p_service_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Servicio no encontrado'
    );
  END IF;
  
  -- Registrar estado antes
  RAISE NOTICE 'Estado ANTES: folio=%, status=%, invoice_folio=%, invoice_numero_fiscal=%', 
    service_before.folio, service_before.status, service_before.invoice_folio, service_before.invoice_numero_fiscal;
  
  -- Realizar la actualización
  UPDATE public.services 
  SET 
    status = 'invoiced',
    invoice_folio = p_invoice_folio,
    invoice_numero_fiscal = p_numero_fiscal,
    updated_at = now()
  WHERE id = p_service_id;
  
  -- Verificar si se actualizó
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se pudo actualizar el servicio - posible problema de permisos'
    );
  END IF;
  
  -- Obtener estado después
  SELECT id, folio, status, invoice_folio, invoice_numero_fiscal, updated_at
  INTO service_after
  FROM public.services
  WHERE id = p_service_id;
  
  -- Registrar estado después
  RAISE NOTICE 'Estado DESPUÉS: folio=%, status=%, invoice_folio=%, invoice_numero_fiscal=%', 
    service_after.folio, service_after.status, service_after.invoice_folio, service_after.invoice_numero_fiscal;
  
  RETURN jsonb_build_object(
    'success', true,
    'service_id', p_service_id,
    'before', jsonb_build_object(
      'status', service_before.status,
      'invoice_folio', service_before.invoice_folio,
      'invoice_numero_fiscal', service_before.invoice_numero_fiscal,
      'updated_at', service_before.updated_at
    ),
    'after', jsonb_build_object(
      'status', service_after.status,
      'invoice_folio', service_after.invoice_folio,
      'invoice_numero_fiscal', service_after.invoice_numero_fiscal,
      'updated_at', service_after.updated_at
    ),
    'updated_successfully', (service_after.status = 'invoiced')
  );
END;
$$;