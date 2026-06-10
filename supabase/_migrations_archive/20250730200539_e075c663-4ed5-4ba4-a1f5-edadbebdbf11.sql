-- Función global para actualizar servicios a estado invoiced
CREATE OR REPLACE FUNCTION public.update_services_to_invoiced(
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
  service_id uuid;
  result jsonb;
BEGIN
  -- Actualizar todos los servicios proporcionados
  UPDATE public.services 
  SET 
    status = 'invoiced',
    invoice_folio = p_invoice_folio,
    invoice_numero_fiscal = p_numero_fiscal,
    updated_at = now()
  WHERE id = ANY(p_service_ids);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_count', updated_count,
    'service_ids', array_to_json(p_service_ids),
    'invoice_folio', p_invoice_folio,
    'numero_fiscal', p_numero_fiscal
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'service_ids', array_to_json(p_service_ids)
    );
END;
$$;