-- CORRECCIÓN COMPLETA DE FOLIOS ÚNICOS DE FACTURAS
-- Eliminar funciones conflictivas de creación de facturas
DROP FUNCTION IF EXISTS public.create_invoice_transaction(uuid, uuid, date, date, numeric, numeric, numeric, text);
DROP FUNCTION IF EXISTS public.create_invoice_transaction(jsonb, uuid[]);

-- Eliminar generador de folios de facturas problemático
DROP FUNCTION IF EXISTS public.generate_invoice_folio_preview();
DROP FUNCTION IF EXISTS public.confirm_invoice_folio_usage();

-- Crear generador de folios únicos para facturas (similar al de servicios)
CREATE OR REPLACE FUNCTION public.generate_unique_invoice_folio()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  timestamp_part TEXT;
  random_part TEXT;
  candidate_folio TEXT;
  attempts INTEGER := 0;
  max_attempts INTEGER := 10;
BEGIN
  WHILE attempts < max_attempts LOOP
    -- Generar parte timestamp (últimos 6 dígitos de timestamp)
    timestamp_part := (EXTRACT(EPOCH FROM now()) * 1000)::bigint::text;
    timestamp_part := right(timestamp_part, 6);
    
    -- Generar parte aleatoria (3 dígitos)
    random_part := LPAD((random() * 999)::int::text, 3, '0');
    
    -- Combinar en formato FACT-XXXXXXYYY
    candidate_folio := 'FACT-' || timestamp_part || random_part;
    
    -- Verificar uniqueness
    IF NOT EXISTS (SELECT 1 FROM invoices WHERE folio = candidate_folio) THEN
      RETURN candidate_folio;
    END IF;
    
    attempts := attempts + 1;
    -- Pequeña pausa para evitar colisiones en generación masiva
    PERFORM pg_sleep(0.001);
  END LOOP;
  
  -- Fallback con UUID si fallan todos los intentos
  RETURN 'FACT-FALLBACK-' || replace(gen_random_uuid()::text, '-', '')::text;
END;
$$;

-- Crear función validadora de folios únicos para facturas
CREATE OR REPLACE FUNCTION public.validate_invoice_folio_uniqueness(folio_to_check TEXT, exclude_invoice_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM invoices 
    WHERE folio = folio_to_check 
    AND (exclude_invoice_id IS NULL OR id != exclude_invoice_id)
  );
END;
$$;

-- Recrear función principal de creación de facturas con folios únicos
CREATE OR REPLACE FUNCTION public.create_invoice_transaction(
  p_invoice_data JSONB,
  p_service_ids UUID[]
)
RETURNS TABLE(invoice_id UUID, invoice_folio TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_invoice_id UUID;
  unique_folio TEXT;
  service_id UUID;
  total_billable_amount NUMERIC := 0;
  service_value NUMERIC;
  client_covered_amount NUMERIC;
BEGIN
  -- Generar folio único
  unique_folio := public.generate_unique_invoice_folio();
  
  -- Verificar que el folio sea único (doble verificación)
  IF NOT public.validate_invoice_folio_uniqueness(unique_folio) THEN
    RAISE EXCEPTION 'Generated folio % already exists. Please retry.', unique_folio;
  END IF;
  
  -- Calcular total facturable de servicios
  FOREACH service_id IN ARRAY p_service_ids
  LOOP
    SELECT 
      s.value,
      CASE WHEN s.has_excess THEN s.client_covered_amount ELSE s.value END
    INTO service_value, client_covered_amount
    FROM services s
    WHERE s.id = service_id;
    
    IF FOUND THEN
      total_billable_amount := total_billable_amount + COALESCE(client_covered_amount, service_value);
    END IF;
  END LOOP;
  
  -- Crear registro de factura
  INSERT INTO invoices (
    client_id,
    folio,
    issue_date,
    due_date,
    subtotal,
    vat,
    total,
    status,
    notes,
    numero_fiscal,
    created_by
  ) VALUES (
    (p_invoice_data->>'client_id')::UUID,
    unique_folio,
    (p_invoice_data->>'issue_date')::DATE,
    (p_invoice_data->>'due_date')::DATE,
    COALESCE((p_invoice_data->>'subtotal')::NUMERIC, total_billable_amount),
    COALESCE((p_invoice_data->>'vat')::NUMERIC, total_billable_amount * 0.19),
    COALESCE((p_invoice_data->>'total')::NUMERIC, total_billable_amount * 1.19),
    COALESCE(p_invoice_data->>'status', 'draft'),
    p_invoice_data->>'notes',
    p_invoice_data->>'numero_fiscal',
    auth.uid()
  )
  RETURNING id INTO new_invoice_id;
  
  -- Crear relaciones con servicios
  FOREACH service_id IN ARRAY p_service_ids
  LOOP
    INSERT INTO invoice_services (invoice_id, service_id)
    VALUES (new_invoice_id, service_id);
    
    -- Actualizar servicios a estado facturado
    UPDATE services 
    SET 
      status = 'invoiced',
      invoice_folio = unique_folio,
      invoice_numero_fiscal = p_invoice_data->>'numero_fiscal',
      updated_at = now()
    WHERE id = service_id;
  END LOOP;
  
  -- Log exitoso
  RAISE NOTICE 'Invoice created successfully: ID=%, Folio=%', new_invoice_id, unique_folio;
  
  RETURN QUERY SELECT new_invoice_id, unique_folio;
END;
$$;

-- Crear función para preview de folios (solo para UI)
CREATE OR REPLACE FUNCTION public.preview_next_invoice_folio()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Solo genera un preview, no reserva el folio
  RETURN 'FACT-' || (EXTRACT(EPOCH FROM now()) * 1000)::bigint::text || '000';
END;
$$;