-- ================================================================
-- CORRECCIÓN DE SOBREPAGOS Y VALIDACIÓN ESTRICTA
-- Elimina aplicaciones de pago que exceden el total de facturas
-- y agrega validación para prevenir sobrepagos futuros
-- ================================================================

-- PASO 1: Corregir FACT-4004 eliminando aplicación excedente
DO $$
DECLARE
  v_invoice_id UUID;
  v_invoice_total NUMERIC;
  v_application_to_remove UUID;
BEGIN
  -- Obtener ID de FACT-4004
  SELECT id, total INTO v_invoice_id, v_invoice_total
  FROM invoices 
  WHERE folio = 'FACT-4004';
  
  IF v_invoice_id IS NOT NULL THEN
    -- Eliminar la aplicación parcial de $258.388 (la primera)
    -- Mantener solo la aplicación completa de $297.500
    DELETE FROM payment_applications
    WHERE id IN (
      SELECT pa.id
      FROM payment_applications pa
      WHERE pa.invoice_id = v_invoice_id
        AND pa.applied_amount < v_invoice_total
      ORDER BY pa.created_at
      LIMIT 1
    )
    RETURNING id INTO v_application_to_remove;
    
    IF v_application_to_remove IS NOT NULL THEN
      RAISE NOTICE 'Eliminada aplicación excedente % de FACT-4004', v_application_to_remove;
    END IF;
    
    -- El trigger auto_update_invoice_status recalculará automáticamente
    -- paid_amount y remaining_amount
    
    -- Forzar actualización manual para asegurar
    UPDATE invoices
    SET updated_at = NOW()
    WHERE id = v_invoice_id;
  END IF;
END $$;

-- PASO 2: Función helper para validar sobrepagos
CREATE OR REPLACE FUNCTION public.validate_payment_application_amount(
  p_invoice_id UUID,
  p_new_amount NUMERIC,
  p_excluding_application_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice_total NUMERIC;
  v_current_paid NUMERIC;
  v_available_amount NUMERIC;
BEGIN
  -- Obtener total de la factura
  SELECT total INTO v_invoice_total
  FROM invoices
  WHERE id = p_invoice_id;
  
  IF v_invoice_total IS NULL THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;
  
  -- Calcular monto ya pagado (excluyendo aplicación específica si se indica)
  SELECT COALESCE(SUM(applied_amount), 0) INTO v_current_paid
  FROM payment_applications
  WHERE invoice_id = p_invoice_id
    AND (p_excluding_application_id IS NULL OR id != p_excluding_application_id);
  
  -- Calcular monto disponible
  v_available_amount := v_invoice_total - v_current_paid;
  
  -- Validar que el nuevo monto no exceda lo disponible
  IF p_new_amount > v_available_amount THEN
    RAISE EXCEPTION 'Monto de aplicación ($%) excede el monto disponible ($%) de la factura', 
      p_new_amount, v_available_amount
    USING HINT = format('Total factura: $%, Ya pagado: $%, Disponible: $%', 
      v_invoice_total, v_current_paid, v_available_amount);
  END IF;
  
  RETURN TRUE;
END;
$function$;

-- PASO 3: Agregar trigger de validación en payment_applications
CREATE OR REPLACE FUNCTION public.prevent_overpayment_on_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validar en INSERT
  IF TG_OP = 'INSERT' THEN
    PERFORM validate_payment_application_amount(NEW.invoice_id, NEW.applied_amount);
  END IF;
  
  -- Validar en UPDATE si cambia el monto o la factura
  IF TG_OP = 'UPDATE' AND (
    NEW.applied_amount != OLD.applied_amount OR 
    NEW.invoice_id != OLD.invoice_id
  ) THEN
    PERFORM validate_payment_application_amount(
      NEW.invoice_id, 
      NEW.applied_amount,
      OLD.id  -- Excluir el monto anterior de esta aplicación
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Crear trigger
DROP TRIGGER IF EXISTS prevent_overpayment_trigger ON payment_applications;
CREATE TRIGGER prevent_overpayment_trigger
  BEFORE INSERT OR UPDATE ON payment_applications
  FOR EACH ROW
  EXECUTE FUNCTION prevent_overpayment_on_application();

-- PASO 4: Mejorar apply_payment_fifo con validación preventiva
CREATE OR REPLACE FUNCTION public.apply_payment_fifo(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_payment RECORD;
  v_invoice RECORD;
  v_remaining NUMERIC;
  v_to_apply NUMERIC;
  applications_count INTEGER := 0;
BEGIN
  -- Obtener información del pago
  SELECT * INTO v_payment
  FROM payments
  WHERE id = p_payment_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pago no encontrado'
    );
  END IF;
  
  v_remaining := v_payment.amount - COALESCE(v_payment.applied_amount, 0);
  
  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'El pago ya está completamente aplicado'
    );
  END IF;
  
  -- Aplicar a facturas pendientes del mismo cliente (FIFO: más antiguas primero)
  FOR v_invoice IN 
    SELECT 
      i.id,
      i.folio,
      i.total,
      i.paid_amount,
      (i.total - COALESCE(i.paid_amount, 0)) as remaining_amount
    FROM invoices i
    WHERE i.client_id = v_payment.client_id
      AND i.status IN ('sent', 'overdue', 'partial')
      AND (i.total - COALESCE(i.paid_amount, 0)) > 0
    ORDER BY i.issue_date ASC, i.created_at ASC
  LOOP
    EXIT WHEN v_remaining <= 0;
    
    -- Calcular cuánto aplicar (el menor entre lo que queda del pago y lo que falta de la factura)
    v_to_apply := LEAST(v_remaining, v_invoice.remaining_amount);
    
    -- VALIDACIÓN PREVENTIVA: Verificar que no cause sobrepago
    BEGIN
      PERFORM validate_payment_application_amount(v_invoice.id, v_to_apply);
      
      -- Aplicar el pago
      INSERT INTO payment_applications (
        payment_id,
        invoice_id,
        applied_amount,
        application_method,
        notes,
        created_by
      ) VALUES (
        p_payment_id,
        v_invoice.id,
        v_to_apply,
        'fifo',
        format('Aplicación automática FIFO: $%s a %s', v_to_apply, v_invoice.folio),
        auth.uid()
      );
      
      v_remaining := v_remaining - v_to_apply;
      applications_count := applications_count + 1;
      
      RAISE NOTICE 'Aplicados $% a factura %', v_to_apply, v_invoice.folio;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Si falla la validación, registrar y continuar con la siguiente factura
        RAISE WARNING 'No se pudo aplicar a factura %: %', v_invoice.folio, SQLERRM;
        CONTINUE;
    END;
  END LOOP;
  
  -- El trigger auto_update_invoice_status actualizará automáticamente
  -- los montos de las facturas afectadas
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'applications_count', applications_count,
    'remaining_amount', v_remaining,
    'message', format('Aplicadas %s facturas, monto restante: $%s', applications_count, v_remaining)
  );
END;
$function$;

-- PASO 5: Verificar integridad final
DO $$
DECLARE
  v_overpayments INTEGER;
  v_overpayment_details JSONB;
BEGIN
  -- Buscar facturas con sobrepago
  SELECT 
    COUNT(*),
    jsonb_agg(
      jsonb_build_object(
        'folio', folio,
        'total', total,
        'paid_amount', paid_amount,
        'overpaid_by', paid_amount - total
      )
    )
  INTO v_overpayments, v_overpayment_details
  FROM invoices
  WHERE paid_amount > total;
  
  IF v_overpayments > 0 THEN
    RAISE WARNING 'Se encontraron % facturas con sobrepago después de la corrección: %', 
      v_overpayments, v_overpayment_details;
  ELSE
    RAISE NOTICE 'Sistema de pagos completamente sincronizado. Sin sobrepagos detectados.';
  END IF;
END $$;