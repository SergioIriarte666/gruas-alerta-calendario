-- Actualizar función create_invoice_transaction para manejar el estado del cierre
-- Esta migración corrige el problema donde los cierres no cambian a estado 'invoiced' después de facturar

-- Primero, crear función auxiliar para actualizar estado del cierre
CREATE OR REPLACE FUNCTION public.update_closure_status_on_invoice(p_closure_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Actualizar el estado del cierre a 'invoiced'
  UPDATE public.service_closures 
  SET 
    status = 'invoiced',
    updated_at = now()
  WHERE id = p_closure_id;
  
  -- Log para debugging
  RAISE NOTICE 'Closure % status updated to invoiced', p_closure_id;
END;
$function$;

-- Actualizar la función create_invoice_transaction para incluir actualización del cierre
CREATE OR REPLACE FUNCTION public.create_invoice_transaction(
  p_invoice_data jsonb,
  p_service_ids uuid[]
)
RETURNS TABLE(invoice_id uuid, invoice_folio text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice_id UUID;
  v_invoice_folio TEXT;
  v_closure_id UUID;
  service_id UUID;
BEGIN
  -- Generar folio único
  SELECT public.preview_next_invoice_folio() INTO v_invoice_folio;
  
  -- Insertar factura
  INSERT INTO public.invoices (
    client_id,
    folio,
    issue_date,
    due_date,
    subtotal,
    vat,
    total,
    numero_fiscal,
    status,
    notes
  ) VALUES (
    (p_invoice_data->>'client_id')::uuid,
    v_invoice_folio,
    (p_invoice_data->>'issue_date')::date,
    (p_invoice_data->>'due_date')::date,
    (p_invoice_data->>'subtotal')::numeric,
    (p_invoice_data->>'vat')::numeric,
    (p_invoice_data->>'total')::numeric,
    p_invoice_data->>'numero_fiscal',
    COALESCE((p_invoice_data->>'status')::invoice_status, 'draft'::invoice_status),
    p_invoice_data->>'notes'
  )
  RETURNING id INTO v_invoice_id;
  
  -- Actualizar servicios con información de factura
  FOREACH service_id IN ARRAY p_service_ids
  LOOP
    UPDATE public.services
    SET 
      status = 'invoiced',
      invoice_folio = v_invoice_folio,
      invoice_numero_fiscal = p_invoice_data->>'numero_fiscal',
      updated_at = now()
    WHERE id = service_id;
  END LOOP;
  
  -- Obtener closure_id del primer servicio para actualizar su estado
  SELECT DISTINCT cs.closure_id INTO v_closure_id
  FROM public.closure_services cs
  WHERE cs.service_id = ANY(p_service_ids)
  LIMIT 1;
  
  -- Actualizar estado del cierre si se encontró uno
  IF v_closure_id IS NOT NULL THEN
    UPDATE public.service_closures 
    SET 
      status = 'invoiced',
      updated_at = now()
    WHERE id = v_closure_id;
    
    RAISE NOTICE 'Closure % status updated to invoiced automatically', v_closure_id;
  END IF;
  
  -- Retornar información de la factura creada
  RETURN QUERY SELECT v_invoice_id, v_invoice_folio;
END;
$function$;

-- Función para sincronizar estados de cierres existentes que deberían estar en 'invoiced'
CREATE OR REPLACE FUNCTION public.sync_closure_invoice_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated_count INTEGER := 0;
  closure_record RECORD;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar esta función de sincronización';
  END IF;

  -- Buscar cierres que tienen facturas pero están en estado 'closed'
  FOR closure_record IN
    SELECT DISTINCT sc.id, sc.folio
    FROM public.service_closures sc
    INNER JOIN public.closure_services cs ON sc.id = cs.closure_id
    INNER JOIN public.services s ON cs.service_id = s.id
    WHERE sc.status = 'closed'
    AND s.status = 'invoiced'
    AND s.invoice_folio IS NOT NULL
  LOOP
    -- Actualizar el cierre a estado 'invoiced'
    UPDATE public.service_closures
    SET 
      status = 'invoiced',
      updated_at = now()
    WHERE id = closure_record.id;
    
    updated_count := updated_count + 1;
    RAISE NOTICE 'Synchronized closure % (folio: %) to invoiced status', closure_record.id, closure_record.folio;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_closures', updated_count,
    'message', format('Sincronizados %s cierres a estado "invoiced"', updated_count)
  );
END;
$function$;