-- Migración: Agregar payment_term_id a create_invoice_transaction
-- Esta migración actualiza la función para incluir el campo payment_term_id al crear facturas

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
  simple_folio TEXT;
  service_id UUID;
  total_billable_amount NUMERIC := 0;
  service_value NUMERIC;
  client_covered_amount NUMERIC;
BEGIN
  -- Generar folio simple automático
  simple_folio := public.generate_simple_invoice_folio();
  
  -- Calcular el total a facturar sumando los valores de los servicios
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
  
  -- Insertar la factura con payment_term_id incluido
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
    payment_term_id,
    created_by
  ) VALUES (
    (p_invoice_data->>'client_id')::UUID,
    simple_folio,
    (p_invoice_data->>'issue_date')::DATE,
    (p_invoice_data->>'due_date')::DATE,
    COALESCE((p_invoice_data->>'subtotal')::NUMERIC, total_billable_amount),
    COALESCE((p_invoice_data->>'vat')::NUMERIC, total_billable_amount * 0.19),
    COALESCE((p_invoice_data->>'total')::NUMERIC, total_billable_amount * 1.19),
    COALESCE((p_invoice_data->>'status')::invoice_status, 'draft'::invoice_status),
    p_invoice_data->>'notes',
    p_invoice_data->>'numero_fiscal',
    (p_invoice_data->>'payment_term_id')::UUID,
    auth.uid()
  )
  RETURNING id INTO new_invoice_id;
  
  -- Vincular servicios a la factura
  FOREACH service_id IN ARRAY p_service_ids
  LOOP
    INSERT INTO invoice_services (invoice_id, service_id)
    VALUES (new_invoice_id, service_id);
    
    -- Actualizar estado de los servicios a 'invoiced'
    UPDATE services 
    SET 
      status = 'invoiced',
      invoice_folio = simple_folio,
      invoice_numero_fiscal = p_invoice_data->>'numero_fiscal',
      updated_at = now()
    WHERE id = service_id;
  END LOOP;
  
  RETURN QUERY SELECT new_invoice_id, simple_folio;
END;
$$;