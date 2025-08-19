-- Función mejorada para actualizar servicios a estado invoiced
DROP FUNCTION IF EXISTS public.update_services_to_invoiced(uuid[], text, text);

CREATE OR REPLACE FUNCTION public.update_services_to_invoiced_batch(
  p_service_ids uuid[],
  p_invoice_folio text,
  p_numero_fiscal text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_count integer := 0;
  service_record RECORD;
  result jsonb;
BEGIN
  -- Log para debugging
  RAISE NOTICE 'Iniciando actualización de servicios: %', array_length(p_service_ids, 1);
  
  -- Verificar que los servicios existen
  FOR service_record IN 
    SELECT id, folio, status 
    FROM public.services 
    WHERE id = ANY(p_service_ids)
  LOOP
    RAISE NOTICE 'Servicio encontrado: % - estado actual: %', service_record.folio, service_record.status;
  END LOOP;
  
  -- Actualizar todos los servicios proporcionados
  UPDATE public.services 
  SET 
    status = 'invoiced'::service_status,
    invoice_folio = p_invoice_folio,
    invoice_numero_fiscal = p_numero_fiscal,
    updated_at = now()
  WHERE id = ANY(p_service_ids);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RAISE NOTICE 'Servicios actualizados: %', updated_count;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_count', updated_count,
    'service_ids', array_to_json(p_service_ids),
    'invoice_folio', p_invoice_folio,
    'numero_fiscal', p_numero_fiscal
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error en actualización: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'service_ids', array_to_json(p_service_ids)
    );
END;
$$;