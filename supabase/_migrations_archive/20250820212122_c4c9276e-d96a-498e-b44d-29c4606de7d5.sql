-- Corrección de Sistema de Conciliación de Pagos
-- Soluciona inconsistencias identificadas y mejora validaciones

-- 1. Función mejorada para corregir facturas con inconsistencias
CREATE OR REPLACE FUNCTION public.fix_invoice_payment_inconsistencies()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inconsistent_invoice RECORD;
  fixed_count INTEGER := 0;
  total_applied DECIMAL;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden corregir inconsistencias';
  END IF;

  -- Corregir facturas marcadas como pagadas con remaining_amount > 0
  FOR inconsistent_invoice IN 
    SELECT 
      i.id,
      i.folio,
      i.total,
      i.paid_amount,
      i.remaining_amount,
      COALESCE(SUM(pa.applied_amount), 0) as calculated_paid_amount
    FROM invoices i
    LEFT JOIN payment_applications pa ON i.id = pa.invoice_id
    WHERE i.status = 'paid' AND i.remaining_amount > 0
    GROUP BY i.id, i.folio, i.total, i.paid_amount, i.remaining_amount
  LOOP
    -- Recalcular paid_amount basado en payment_applications
    total_applied := inconsistent_invoice.calculated_paid_amount;
    
    -- Actualizar la factura con el monto correcto
    UPDATE invoices 
    SET 
      paid_amount = total_applied,
      status = CASE 
        WHEN total_applied >= total THEN 'paid'::invoice_status
        WHEN total_applied > 0 THEN 'partial'::invoice_status
        ELSE 'sent'::invoice_status
      END,
      updated_at = NOW()
    WHERE id = inconsistent_invoice.id;
    
    fixed_count := fixed_count + 1;
    
    RAISE NOTICE 'Corregida factura %: paid_amount % -> %, status recalculado', 
      inconsistent_invoice.folio, inconsistent_invoice.paid_amount, total_applied;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'fixed_invoices', fixed_count,
    'message', format('Corregidas %s facturas con inconsistencias de pago', fixed_count)
  );
END;
$function$;

-- 2. Función mejorada para crear pago automático con validaciones adicionales
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
    
    -- Verificar si ya tiene pagos aplicados
    SELECT COUNT(*) INTO v_existing_payment_count
    FROM payment_applications pa
    WHERE pa.invoice_id = p_invoice_id;
    
    IF v_existing_payment_count > 0 THEN
        RAISE EXCEPTION 'La factura % ya tiene pagos aplicados. Use la reconciliación manual.', v_invoice.folio;
    END IF;
    
    -- Calcular monto pendiente
    v_application_amount := v_invoice.total - COALESCE(v_invoice.paid_amount, 0);
    
    IF v_application_amount <= 0 THEN
        RAISE EXCEPTION 'La factura % ya está completamente pagada', v_invoice.folio;
    END IF;
    
    -- Verificar si ya existe un pago automático para esta factura
    IF EXISTS (
        SELECT 1 FROM payments p
        WHERE p.client_id = v_invoice.client_id
        AND p.bank_reference = 'PAGO-AUTO-' || v_invoice.folio
    ) THEN
        RAISE EXCEPTION 'Ya existe un pago automático para la factura %', v_invoice.folio;
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

-- 3. Función para validar integridad del sistema de conciliación
CREATE OR REPLACE FUNCTION public.validate_payment_system_integrity()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  inconsistent_invoices INTEGER;
  inconsistent_payments INTEGER;
  orphaned_applications INTEGER;
  paid_without_payments INTEGER;
BEGIN
  -- Contar facturas con inconsistencias
  SELECT COUNT(*) INTO inconsistent_invoices
  FROM invoices i
  WHERE (i.status = 'paid' AND i.remaining_amount > 0)
     OR (i.paid_amount < 0)
     OR (i.paid_amount > i.total);

  -- Contar pagos con inconsistencias
  SELECT COUNT(*) INTO inconsistent_payments
  FROM payments p
  WHERE (p.applied_amount > p.amount)
     OR (p.remaining_amount < 0)
     OR (p.applied_amount < 0);

  -- Contar aplicaciones huérfanas
  SELECT COUNT(*) INTO orphaned_applications
  FROM payment_applications pa
  WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.id = pa.payment_id)
     OR NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = pa.invoice_id);

  -- Contar facturas pagadas sin aplicaciones de pago
  SELECT COUNT(*) INTO paid_without_payments
  FROM invoices i
  WHERE i.status = 'paid'
    AND NOT EXISTS (SELECT 1 FROM payment_applications pa WHERE pa.invoice_id = i.id);

  result := jsonb_build_object(
    'validation_timestamp', NOW(),
    'system_health', CASE 
      WHEN inconsistent_invoices = 0 AND inconsistent_payments = 0 
           AND orphaned_applications = 0 AND paid_without_payments = 0 
      THEN 'HEALTHY' 
      ELSE 'NEEDS_ATTENTION' 
    END,
    'issues', jsonb_build_object(
      'inconsistent_invoices', inconsistent_invoices,
      'inconsistent_payments', inconsistent_payments,
      'orphaned_applications', orphaned_applications,
      'paid_without_payments', paid_without_payments
    ),
    'recommendations', CASE 
      WHEN inconsistent_invoices > 0 THEN jsonb_build_array('Ejecutar fix_invoice_payment_inconsistencies()')
      WHEN paid_without_payments > 0 THEN jsonb_build_array('Ejecutar sync_paid_invoices_with_payments()')
      ELSE jsonb_build_array('Sistema en buen estado')
    END
  );

  RETURN result;
END;
$function$;

-- 4. Trigger mejorado para mantener consistencia en aplicaciones de pago
CREATE OR REPLACE FUNCTION public.maintain_payment_consistency()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  payment_total_applied DECIMAL;
  payment_amount DECIMAL;
BEGIN
  -- Solo procesar en INSERT/UPDATE/DELETE de payment_applications
  IF TG_TABLE_NAME = 'payment_applications' THEN
    
    -- Obtener ID del pago afectado
    DECLARE payment_id_affected UUID;
    BEGIN
      payment_id_affected := COALESCE(NEW.payment_id, OLD.payment_id);
      
      -- Recalcular applied_amount del pago
      SELECT 
        COALESCE(SUM(pa.applied_amount), 0),
        p.amount
      INTO payment_total_applied, payment_amount
      FROM payments p
      LEFT JOIN payment_applications pa ON p.id = pa.payment_id
      WHERE p.id = payment_id_affected
      GROUP BY p.amount;
      
      -- Actualizar el pago con los montos correctos
      UPDATE payments 
      SET 
        applied_amount = payment_total_applied,
        status = CASE 
          WHEN payment_total_applied >= amount THEN 'applied'::payment_status
          WHEN payment_total_applied > 0 THEN 'partial'::payment_status
          ELSE 'pending'::payment_status
        END,
        updated_at = NOW()
      WHERE id = payment_id_affected;
      
    END;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Crear triggers para mantener consistencia
DROP TRIGGER IF EXISTS maintain_payment_consistency_trigger ON payment_applications;
CREATE TRIGGER maintain_payment_consistency_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payment_applications
  FOR EACH ROW EXECUTE FUNCTION maintain_payment_consistency();

-- Comentarios para documentación
COMMENT ON FUNCTION public.fix_invoice_payment_inconsistencies() IS 'Corrige inconsistencias en facturas marcadas como pagadas con remaining_amount > 0';
COMMENT ON FUNCTION public.create_automatic_payment_for_invoice(uuid) IS 'Versión mejorada que crea pago automático con validaciones adicionales contra duplicados';
COMMENT ON FUNCTION public.validate_payment_system_integrity() IS 'Valida la integridad completa del sistema de conciliación de pagos';
COMMENT ON FUNCTION public.maintain_payment_consistency() IS 'Mantiene consistencia automática en applied_amount de payments al cambiar payment_applications';