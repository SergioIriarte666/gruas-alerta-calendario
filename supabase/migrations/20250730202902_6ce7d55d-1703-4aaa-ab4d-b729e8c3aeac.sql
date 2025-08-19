-- Función para generar folio SIN incrementar contador
CREATE OR REPLACE FUNCTION public.generate_invoice_folio_preview()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number INTEGER;
  new_folio TEXT;
BEGIN
  -- Obtener el siguiente número sin incrementar
  SELECT next_service_folio_number INTO next_number
  FROM public.company_data 
  LIMIT 1;
  
  -- Si no existe configuración, usar número por defecto
  IF next_number IS NULL THEN
    next_number := 1000;
  END IF;
  
  -- Generar el folio
  new_folio := 'FACT-' || LPAD(next_number::text, 3, '0');
  
  RETURN new_folio;
END;
$$;

-- Función para confirmar uso del folio (incrementar contador)
CREATE OR REPLACE FUNCTION public.confirm_invoice_folio_usage()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_number INTEGER;
  confirmed_folio TEXT;
BEGIN
  -- Incrementar el contador y devolver el folio usado
  UPDATE public.company_data 
  SET next_service_folio_number = next_service_folio_number + 1
  WHERE id = (SELECT id FROM public.company_data LIMIT 1)
  RETURNING next_service_folio_number - 1 INTO updated_number;
  
  -- Si no se actualizó nada, crear registro por defecto
  IF updated_number IS NULL THEN
    INSERT INTO public.company_data (business_name, rut, address, phone, email, next_service_folio_number) 
    VALUES ('Empresa', '12345678-9', 'Dirección', '123456789', 'email@empresa.com', 1001)
    ON CONFLICT (id) DO UPDATE SET next_service_folio_number = 1001;
    updated_number := 1000;
  END IF;
  
  -- Generar el folio confirmado
  confirmed_folio := 'FACT-' || LPAD(updated_number::text, 3, '0');
  
  RETURN confirmed_folio;
END;
$$;

-- Función transaccional para crear factura completa
CREATE OR REPLACE FUNCTION public.create_invoice_transaction(
  p_invoice_data jsonb,
  p_service_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invoice_id UUID;
  folio_preview TEXT;
  confirmed_folio TEXT;
  result jsonb;
BEGIN
  -- Generar preview del folio
  SELECT public.generate_invoice_folio_preview() INTO folio_preview;
  
  -- Verificar que el folio esté disponible
  IF EXISTS (SELECT 1 FROM public.invoices WHERE folio = folio_preview) THEN
    RAISE EXCEPTION 'El folio % ya está en uso', folio_preview;
  END IF;
  
  -- Crear la factura con folio preview
  INSERT INTO public.invoices (
    client_id,
    issue_date,
    due_date,
    subtotal,
    vat,
    total,
    folio,
    numero_fiscal,
    status,
    notes,
    created_by
  ) VALUES (
    (p_invoice_data->>'client_id')::uuid,
    (p_invoice_data->>'issue_date')::date,
    (p_invoice_data->>'due_date')::date,
    (p_invoice_data->>'subtotal')::numeric,
    (p_invoice_data->>'vat')::numeric,
    (p_invoice_data->>'total')::numeric,
    folio_preview,
    p_invoice_data->>'numero_fiscal',
    (p_invoice_data->>'status')::invoice_status,
    p_invoice_data->>'notes',
    auth.uid()
  ) RETURNING id INTO invoice_id;
  
  -- Actualizar servicios a estado invoiced
  UPDATE public.services 
  SET 
    status = 'invoiced'::service_status,
    invoice_folio = folio_preview,
    invoice_numero_fiscal = p_invoice_data->>'numero_fiscal',
    updated_at = now()
  WHERE id = ANY(p_service_ids);
  
  -- SOLO AHORA confirmar el uso del folio (incrementar contador)
  SELECT public.confirm_invoice_folio_usage() INTO confirmed_folio;
  
  -- Verificar que el folio confirmado sea el mismo que usamos
  IF confirmed_folio != folio_preview THEN
    RAISE EXCEPTION 'Error de concurrencia en folio: esperado %, obtenido %', folio_preview, confirmed_folio;
  END IF;
  
  RAISE NOTICE 'Factura creada exitosamente: % con % servicios', confirmed_folio, array_length(p_service_ids, 1);
  
  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', invoice_id,
    'folio', confirmed_folio,
    'services_updated', array_length(p_service_ids, 1)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error en transacción de factura: %', SQLERRM;
    RAISE;
END;
$$;