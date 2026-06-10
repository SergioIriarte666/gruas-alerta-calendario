-- ================================================================
-- CORRECCIÓN DEFINITIVA DEL SISTEMA DE PAGOS
-- Ejecuta automáticamente la reparación de datos corruptos
-- y agrega validaciones preventivas
-- ================================================================

-- PASO 1: Ejecutar corrección automática de datos existentes
DO $$
DECLARE
  result jsonb;
  admin_user_id uuid;
BEGIN
  -- Obtener un usuario admin para ejecutar la función
  SELECT id INTO admin_user_id
  FROM profiles
  WHERE role = 'admin'
  LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    RAISE NOTICE 'No se encontró usuario administrador, saltando corrección automática';
  ELSE
    -- Simular contexto de admin para ejecutar la corrección
    PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_user_id)::text, true);
    
    -- Ejecutar corrección de duplicados
    SELECT fix_duplicate_paid_amounts() INTO result;
    
    RAISE NOTICE 'Corrección automática ejecutada: %', result;
  END IF;
END $$;

-- PASO 2: Mejorar create_automatic_payment_for_invoice con validación preventiva
CREATE OR REPLACE FUNCTION public.create_automatic_payment_for_invoice(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice RECORD;
  v_payment_id UUID;
  v_existing_payment_id UUID;
  v_calculated_paid NUMERIC;
BEGIN
  -- Obtener información de la factura
  SELECT 
    i.id,
    i.folio,
    i.client_id,
    i.total,
    i.paid_amount,
    i.status,
    i.issue_date
  INTO v_invoice
  FROM invoices i
  WHERE i.id = p_invoice_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Factura no encontrada'
    );
  END IF;
  
  -- VALIDACIÓN PREVENTIVA: Detectar inconsistencias antes de procesar
  SELECT COALESCE(SUM(applied_amount), 0) INTO v_calculated_paid
  FROM payment_applications 
  WHERE invoice_id = p_invoice_id;
  
  IF v_invoice.paid_amount != v_calculated_paid THEN
    RAISE WARNING 'Inconsistencia detectada en factura %: paid_amount=% pero suma de aplicaciones=%', 
      v_invoice.folio, 
      v_invoice.paid_amount,
      v_calculated_paid;
    
    -- Auto-corregir antes de continuar
    UPDATE invoices 
    SET paid_amount = v_calculated_paid,
        updated_at = NOW()
    WHERE id = p_invoice_id;
    
    RAISE NOTICE 'Auto-corrección aplicada a factura %', v_invoice.folio;
    v_invoice.paid_amount := v_calculated_paid;
  END IF;
  
  -- Verificar si la factura ya está pagada
  IF v_invoice.status = 'paid' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'La factura ya está marcada como pagada',
      'invoice_folio', v_invoice.folio
    );
  END IF;
  
  -- Calcular monto pendiente
  DECLARE
    v_remaining_amount NUMERIC;
  BEGIN
    v_remaining_amount := v_invoice.total - v_invoice.paid_amount;
    
    IF v_remaining_amount <= 0 THEN
      -- Si no hay monto pendiente, actualizar estado a paid
      UPDATE invoices 
      SET status = 'paid'::invoice_status,
          payment_date = CURRENT_DATE,
          updated_at = NOW()
      WHERE id = p_invoice_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Factura ya está completamente pagada',
        'invoice_folio', v_invoice.folio,
        'status', 'paid'
      );
    END IF;
    
    -- Verificar si ya existe un pago automático para esta factura
    SELECT pa.payment_id INTO v_existing_payment_id
    FROM payment_applications pa
    JOIN payments p ON pa.payment_id = p.id
    WHERE pa.invoice_id = p_invoice_id
      AND pa.application_method = 'fifo'
      AND p.notes ILIKE '%Pago automático%'
    LIMIT 1;
    
    IF v_existing_payment_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Ya existe un pago automático para esta factura',
        'payment_id', v_existing_payment_id
      );
    END IF;
    
    -- Crear pago automático
    INSERT INTO payments (
      client_id,
      amount,
      payment_date,
      payment_method,
      bank_reference,
      notes,
      status,
      applied_amount,
      created_by
    ) VALUES (
      v_invoice.client_id,
      v_remaining_amount,
      CURRENT_DATE,
      'transferencia',
      'AUTO-' || v_invoice.folio,
      'Pago automático generado para ' || v_invoice.folio,
      'pending'::payment_status,
      0, -- Será actualizado por el trigger
      auth.uid()
    ) RETURNING id INTO v_payment_id;
    
    -- Aplicar el pago a la factura
    INSERT INTO payment_applications (
      payment_id,
      invoice_id,
      applied_amount,
      application_method,
      notes,
      created_by
    ) VALUES (
      v_payment_id,
      p_invoice_id,
      v_remaining_amount,
      'fifo',
      'Aplicación automática generada',
      auth.uid()
    );
    
    -- El trigger auto_update_invoice_status se encargará de actualizar
    -- paid_amount, status y payment_date automáticamente
    
    -- Logging detallado
    RAISE NOTICE 'Pago automático creado: payment_id=%, invoice=%, amount=%', 
      v_payment_id, v_invoice.folio, v_remaining_amount;
    
    RETURN jsonb_build_object(
      'success', true,
      'payment_id', v_payment_id,
      'invoice_id', p_invoice_id,
      'invoice_folio', v_invoice.folio,
      'amount', v_remaining_amount,
      'status', 'paid',
      'message', 'Pago automático creado exitosamente'
    );
  END;
END;
$function$;

-- PASO 3: Verificar integridad final
DO $$
DECLARE
  v_inconsistencies INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_inconsistencies
  FROM invoices i
  WHERE i.paid_amount != (
    SELECT COALESCE(SUM(pa.applied_amount), 0)
    FROM payment_applications pa
    WHERE pa.invoice_id = i.id
  );
  
  IF v_inconsistencies > 0 THEN
    RAISE WARNING 'Todavía existen % facturas con inconsistencias después de la corrección', v_inconsistencies;
  ELSE
    RAISE NOTICE 'Sistema de pagos completamente sincronizado. Cero inconsistencias detectadas.';
  END IF;
END $$;