-- Mejorar función de pago automático para prevenir conflictos
CREATE OR REPLACE FUNCTION public.create_automatic_payment_for_invoice(p_invoice_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_invoice RECORD;
    v_payment_id UUID;
    v_application_amount DECIMAL;
    v_existing_payment_count INTEGER;
    v_existing_applications_count INTEGER;
    result JSON;
BEGIN
    -- Obtener información de la factura
    SELECT id, client_id, total, paid_amount, folio, status
    INTO v_invoice
    FROM invoices 
    WHERE id = p_invoice_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Factura no encontrada: %', p_invoice_id;
    END IF;
    
    -- NUEVA VALIDACIÓN: Verificar si ya tiene aplicaciones de pago manuales
    SELECT COUNT(*) INTO v_existing_applications_count
    FROM payment_applications pa
    WHERE pa.invoice_id = p_invoice_id;
    
    IF v_existing_applications_count > 0 THEN
        RAISE EXCEPTION 'Esta factura ya tiene % pagos manuales aplicados. Use la reconciliación de pagos para ajustar los pagos existentes.', v_existing_applications_count;
    END IF;
    
    -- Verificar si ya tiene pagos automáticos
    SELECT COUNT(*) INTO v_existing_payment_count
    FROM payments p
    WHERE p.client_id = v_invoice.client_id
    AND p.bank_reference = 'PAGO-AUTO-' || v_invoice.folio;
    
    IF v_existing_payment_count > 0 THEN
        RAISE EXCEPTION 'Ya existe un pago automático para la factura %', v_invoice.folio;
    END IF;
    
    -- Calcular monto pendiente
    v_application_amount := v_invoice.total - COALESCE(v_invoice.paid_amount, 0);
    
    IF v_application_amount <= 0 THEN
        RAISE EXCEPTION 'La factura % ya está completamente pagada', v_invoice.folio;
    END IF;
    
    -- Crear el pago automático
    INSERT INTO payments (
        client_id, amount, payment_date, payment_method, bank_reference,
        notes, status, applied_amount, created_by
    ) VALUES (
        v_invoice.client_id, 
        v_application_amount, 
        CURRENT_DATE, 
        'automatico',
        'PAGO-AUTO-' || v_invoice.folio,
        'Pago automático generado al marcar factura como pagada: ' || v_invoice.folio,
        'applied', 
        v_application_amount, 
        auth.uid()
    ) RETURNING id INTO v_payment_id;
    
    -- Crear la aplicación del pago
    INSERT INTO payment_applications (
        payment_id, invoice_id, applied_amount, application_method,
        notes, created_by
    ) VALUES (
        v_payment_id, 
        p_invoice_id, 
        v_application_amount, 
        'manual',
        'Aplicación automática para factura: ' || v_invoice.folio, 
        auth.uid()
    );
    
    -- Actualizar la factura
    UPDATE invoices 
    SET 
        paid_amount = COALESCE(paid_amount, 0) + v_application_amount,
        status = CASE 
            WHEN COALESCE(paid_amount, 0) + v_application_amount >= total 
            THEN 'paid'::invoice_status
            ELSE 'partial'::invoice_status
        END,
        payment_date = CURRENT_DATE, 
        updated_at = NOW()
    WHERE id = p_invoice_id;
    
    RETURN json_build_object(
        'success', true, 
        'payment_id', v_payment_id,
        'invoice_id', p_invoice_id, 
        'amount_paid', v_application_amount,
        'message', 'Pago automático creado y aplicado exitosamente'
    );
END;
$function$;

-- Nueva función para diagnosticar facturas con pagos mixtos
CREATE OR REPLACE FUNCTION public.diagnose_mixed_payment_invoices()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  mixed_invoices jsonb;
  mixed_count INTEGER := 0;
BEGIN
  -- Buscar facturas con pagos tanto automáticos como manuales
  SELECT 
    COUNT(*),
    jsonb_agg(
      jsonb_build_object(
        'invoice_id', i.id,
        'folio', i.folio,
        'client_name', c.name,
        'total', i.total,
        'paid_amount', i.paid_amount,
        'status', i.status,
        'automatic_payments', automatic_payments,
        'manual_payments', manual_payments,
        'total_applications', total_applications
      )
    )
  INTO mixed_count, mixed_invoices
  FROM invoices i
  JOIN clients c ON i.client_id = c.id
  CROSS JOIN LATERAL (
    -- Contar pagos automáticos aplicados a esta factura
    SELECT COUNT(*) as automatic_payments
    FROM payment_applications pa
    JOIN payments p ON pa.payment_id = p.id
    WHERE pa.invoice_id = i.id 
    AND p.bank_reference LIKE 'PAGO-AUTO-%'
  ) auto_payments
  CROSS JOIN LATERAL (
    -- Contar pagos manuales aplicados a esta factura
    SELECT COUNT(*) as manual_payments  
    FROM payment_applications pa
    JOIN payments p ON pa.payment_id = p.id
    WHERE pa.invoice_id = i.id 
    AND (p.bank_reference IS NULL OR p.bank_reference NOT LIKE 'PAGO-AUTO-%')
  ) man_payments
  CROSS JOIN LATERAL (
    -- Total de aplicaciones
    SELECT COUNT(*) as total_applications
    FROM payment_applications pa
    WHERE pa.invoice_id = i.id
  ) total_apps
  WHERE automatic_payments > 0 AND manual_payments > 0;

  RETURN jsonb_build_object(
    'timestamp', NOW(),
    'mixed_invoices_count', mixed_count,
    'invoices_with_conflicts', COALESCE(mixed_invoices, '[]'::jsonb),
    'system_health', CASE 
      WHEN mixed_count = 0 THEN 'HEALTHY'
      ELSE 'NEEDS_ATTENTION'
    END,
    'message', CASE 
      WHEN mixed_count = 0 THEN 'No se encontraron facturas con pagos mixtos'
      ELSE format('Se encontraron %s facturas con pagos tanto automáticos como manuales', mixed_count)
    END
  );
END;
$function$;

-- Función para verificar el estado de pago de una factura específica
CREATE OR REPLACE FUNCTION public.get_invoice_payment_status(p_invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  invoice_info RECORD;
  payment_details jsonb;
BEGIN
  -- Obtener información de la factura
  SELECT i.id, i.folio, i.total, i.paid_amount, i.status, c.name as client_name
  INTO invoice_info
  FROM invoices i
  JOIN clients c ON i.client_id = c.id
  WHERE i.id = p_invoice_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Factura no encontrada');
  END IF;
  
  -- Obtener detalles de los pagos aplicados
  SELECT jsonb_agg(
    jsonb_build_object(
      'payment_id', p.id,
      'applied_amount', pa.applied_amount,
      'payment_date', p.payment_date,
      'payment_method', p.payment_method,
      'bank_reference', p.bank_reference,
      'is_automatic', CASE 
        WHEN p.bank_reference LIKE 'PAGO-AUTO-%' THEN true 
        ELSE false 
      END,
      'application_method', pa.application_method,
      'created_at', pa.created_at
    ) ORDER BY pa.created_at
  ) INTO payment_details
  FROM payment_applications pa
  JOIN payments p ON pa.payment_id = p.id
  WHERE pa.invoice_id = p_invoice_id;
  
  RETURN jsonb_build_object(
    'invoice_id', invoice_info.id,
    'folio', invoice_info.folio,
    'client_name', invoice_info.client_name,
    'total', invoice_info.total,
    'paid_amount', invoice_info.paid_amount,
    'status', invoice_info.status,
    'payment_applications', COALESCE(payment_details, '[]'::jsonb),
    'has_automatic_payments', EXISTS(
      SELECT 1 FROM payment_applications pa
      JOIN payments p ON pa.payment_id = p.id
      WHERE pa.invoice_id = p_invoice_id AND p.bank_reference LIKE 'PAGO-AUTO-%'
    ),
    'has_manual_payments', EXISTS(
      SELECT 1 FROM payment_applications pa  
      JOIN payments p ON pa.payment_id = p.id
      WHERE pa.invoice_id = p_invoice_id AND (p.bank_reference IS NULL OR p.bank_reference NOT LIKE 'PAGO-AUTO-%')
    )
  );
END;
$function$;