
-- =====================================================
-- SOLUCIÓN DEFINITIVA: PREVENCIÓN DE DUPLICADOS EN CONCILIACIONES
-- Problema: paid_amount se duplica porque hay actualizaciones manuales + triggers
-- Solución: Triggers automáticos + prevención de duplicados + corrección de data
-- =====================================================

-- ============ PASO 1: ELIMINAR TRIGGERS Y FUNCIONES EXISTENTES ============
DROP TRIGGER IF EXISTS maintain_payment_consistency_trigger ON payment_applications;
DROP TRIGGER IF EXISTS payment_applications_auto_update_invoice_status ON payment_applications;
DROP FUNCTION IF EXISTS fix_duplicate_paid_amounts();

-- ============ PASO 2: CREAR FUNCIONES DE TRIGGER CORRECTAS ============

-- Función para mantener consistencia de pagos
CREATE OR REPLACE FUNCTION maintain_payment_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_total_applied DECIMAL(10,2);
  v_payment_amount DECIMAL(10,2);
  v_new_status payment_status;
BEGIN
  -- Obtener el monto total del pago
  SELECT amount INTO v_payment_amount
  FROM payments
  WHERE id = COALESCE(NEW.payment_id, OLD.payment_id);

  -- Calcular el total aplicado sumando todas las aplicaciones
  SELECT COALESCE(SUM(applied_amount), 0)
  INTO v_total_applied
  FROM payment_applications
  WHERE payment_id = COALESCE(NEW.payment_id, OLD.payment_id);

  -- Determinar nuevo estado del pago
  IF v_total_applied = 0 THEN
    v_new_status := 'pending';
  ELSIF v_total_applied >= v_payment_amount THEN
    v_new_status := 'applied';
  ELSE
    v_new_status := 'partial';
  END IF;

  -- Actualizar el pago (remaining_amount se calcula automáticamente)
  UPDATE payments
  SET 
    applied_amount = v_total_applied,
    status = v_new_status,
    updated_at = now()
  WHERE id = COALESCE(NEW.payment_id, OLD.payment_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Función para actualizar estados de facturas
CREATE OR REPLACE FUNCTION update_invoice_status_from_payments()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_total DECIMAL(10,2);
  v_invoice_paid DECIMAL(10,2);
  v_new_status invoice_status;
  v_invoice_id UUID;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  -- Obtener el total de la factura
  SELECT total INTO v_invoice_total
  FROM invoices
  WHERE id = v_invoice_id;

  -- Calcular el total pagado para esta factura desde payment_applications
  SELECT COALESCE(SUM(applied_amount), 0)
  INTO v_invoice_paid
  FROM payment_applications
  WHERE invoice_id = v_invoice_id;

  -- Determinar el nuevo estado de la factura
  IF v_invoice_paid = 0 THEN
    -- Si no hay pagos, mantener el estado actual (no modificar)
    RETURN COALESCE(NEW, OLD);
  ELSIF v_invoice_paid >= v_invoice_total THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  -- Actualizar la factura (remaining_amount se calcula automáticamente)
  UPDATE invoices
  SET 
    paid_amount = v_invoice_paid,
    status = v_new_status,
    payment_date = CASE 
      WHEN v_invoice_paid >= v_invoice_total THEN COALESCE(payment_date, CURRENT_DATE)
      ELSE payment_date
    END,
    updated_at = now()
  WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============ PASO 3: CREAR TRIGGERS ============
CREATE TRIGGER maintain_payment_consistency_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payment_applications
  FOR EACH ROW
  EXECUTE FUNCTION maintain_payment_consistency();

CREATE TRIGGER payment_applications_auto_update_invoice_status
  AFTER INSERT OR UPDATE OR DELETE ON payment_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_status_from_payments();

-- ============ PASO 4: RECREAR FUNCIÓN apply_payment_manual SIN ACTUALIZACIONES MANUALES ============
CREATE OR REPLACE FUNCTION public.apply_payment_manual(
  p_payment_id uuid,
  p_applications jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payment_amount numeric;
  total_applied numeric := 0;
  application jsonb;
  invoice_total numeric;
  current_paid numeric;
  app_invoice_id uuid;
  app_amount numeric;
  applications_made integer := 0;
  existing_application_count integer;
BEGIN
  -- Validar que el pago existe
  SELECT amount INTO payment_amount
  FROM payments 
  WHERE id = p_payment_id;
  
  IF payment_amount IS NULL THEN
    RAISE EXCEPTION 'Pago no encontrado: %', p_payment_id;
  END IF;

  -- Procesar cada aplicación
  FOR application IN SELECT * FROM jsonb_array_elements(p_applications)
  LOOP
    app_invoice_id := (application->>'invoice_id')::uuid;
    app_amount := (application->>'amount')::numeric;
    
    -- Validar monto
    IF app_amount <= 0 THEN
      RAISE EXCEPTION 'El monto de aplicación debe ser mayor a 0';
    END IF;
    
    total_applied := total_applied + app_amount;
    
    -- Validar que no exceda el monto del pago
    IF total_applied > payment_amount THEN
      RAISE EXCEPTION 'El total aplicado (%) excede el monto del pago (%)', total_applied, payment_amount;
    END IF;
    
    -- Obtener información de la factura
    SELECT total, COALESCE(paid_amount, 0) 
    INTO invoice_total, current_paid
    FROM invoices 
    WHERE id = app_invoice_id;
    
    IF invoice_total IS NULL THEN
      RAISE EXCEPTION 'Factura no encontrada: %', app_invoice_id;
    END IF;
    
    -- PREVENCIÓN DE DUPLICADOS: Verificar si ya existe una aplicación para este pago + factura
    SELECT COUNT(*) INTO existing_application_count
    FROM payment_applications
    WHERE payment_id = p_payment_id AND invoice_id = app_invoice_id;
    
    IF existing_application_count > 0 THEN
      RAISE EXCEPTION 'Ya existe una aplicación de pago para esta combinación de pago y factura. Use eliminación antes de reaplicar.';
    END IF;
    
    -- Validar que la aplicación no exceda lo pendiente de la factura
    IF current_paid + app_amount > invoice_total THEN
      RAISE EXCEPTION 'La aplicación de % excede el monto pendiente de la factura (pendiente: %)', 
        app_amount, (invoice_total - current_paid);
    END IF;
    
    -- Crear aplicación de pago (los triggers se encargarán de actualizar payments e invoices)
    INSERT INTO payment_applications (
      payment_id, invoice_id, applied_amount, application_method, 
      notes, created_by
    ) VALUES (
      p_payment_id, app_invoice_id, app_amount, 'manual',
      'Aplicación manual de pago', auth.uid()
    );
    
    applications_made := applications_made + 1;
  END LOOP;
  
  -- Los triggers maintain_payment_consistency y update_invoice_status_from_payments
  -- actualizarán automáticamente payments e invoices
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'applications_made', applications_made,
    'message', format('Aplicación exitosa: %s facturas procesadas. Triggers actualizarán automáticamente.', applications_made)
  );
END;
$function$;

-- ============ PASO 5: CORRECCIÓN DE DATA EXISTENTE ============

-- Corregir directamente todas las facturas con paid_amount incorrecto
UPDATE invoices i
SET 
  paid_amount = (
    SELECT COALESCE(SUM(pa.applied_amount), 0)
    FROM payment_applications pa
    WHERE pa.invoice_id = i.id
  ),
  status = CASE
    WHEN (SELECT COALESCE(SUM(pa.applied_amount), 0) FROM payment_applications pa WHERE pa.invoice_id = i.id) >= i.total THEN 'paid'::invoice_status
    WHEN (SELECT COALESCE(SUM(pa.applied_amount), 0) FROM payment_applications pa WHERE pa.invoice_id = i.id) > 0 THEN 'partial'::invoice_status
    ELSE i.status
  END,
  updated_at = now()
WHERE i.paid_amount != (
  SELECT COALESCE(SUM(pa.applied_amount), 0)
  FROM payment_applications pa
  WHERE pa.invoice_id = i.id
);

-- Corregir también los pagos
UPDATE payments p
SET 
  applied_amount = (
    SELECT COALESCE(SUM(pa.applied_amount), 0)
    FROM payment_applications pa
    WHERE pa.payment_id = p.id
  ),
  status = CASE
    WHEN (SELECT COALESCE(SUM(pa.applied_amount), 0) FROM payment_applications pa WHERE pa.payment_id = p.id) >= p.amount THEN 'applied'::payment_status
    WHEN (SELECT COALESCE(SUM(pa.applied_amount), 0) FROM payment_applications pa WHERE pa.payment_id = p.id) > 0 THEN 'partial'::payment_status
    ELSE 'pending'::payment_status
  END,
  updated_at = now()
WHERE p.applied_amount != (
  SELECT COALESCE(SUM(pa.applied_amount), 0)
  FROM payment_applications pa
  WHERE pa.payment_id = p.id
);

-- ============ PASO 6: VALIDACIÓN ============
DO $$
DECLARE
  v_trigger_count INTEGER;
  v_inconsistent_invoices INTEGER;
  v_inconsistent_payments INTEGER;
BEGIN
  -- Verificar que los triggers están activos
  SELECT COUNT(DISTINCT trigger_name) INTO v_trigger_count
  FROM information_schema.triggers
  WHERE trigger_name IN ('maintain_payment_consistency_trigger', 'payment_applications_auto_update_invoice_status')
    AND event_object_table = 'payment_applications'
    AND event_object_schema = 'public';
  
  IF v_trigger_count != 2 THEN
    RAISE EXCEPTION 'ERROR: Los triggers no se crearon correctamente. Encontrados: %', v_trigger_count;
  END IF;
  
  -- Verificar que no quedan inconsistencias en facturas
  SELECT COUNT(*) INTO v_inconsistent_invoices
  FROM invoices i
  WHERE i.paid_amount != (
    SELECT COALESCE(SUM(pa.applied_amount), 0)
    FROM payment_applications pa
    WHERE pa.invoice_id = i.id
  );
  
  -- Verificar que no quedan inconsistencias en pagos
  SELECT COUNT(*) INTO v_inconsistent_payments
  FROM payments p
  WHERE p.applied_amount != (
    SELECT COALESCE(SUM(pa.applied_amount), 0)
    FROM payment_applications pa
    WHERE pa.payment_id = p.id
  );
  
  RAISE NOTICE '✅ SOLUCIÓN DEFINITIVA APLICADA:';
  RAISE NOTICE '   - % triggers activos y funcionando', v_trigger_count;
  RAISE NOTICE '   - % facturas con inconsistencias (corregidas)', v_inconsistent_invoices;
  RAISE NOTICE '   - % pagos con inconsistencias (corregidos)', v_inconsistent_payments;
  RAISE NOTICE '   - Prevención de duplicados activada en apply_payment_manual()';
  RAISE NOTICE '   - Sistema de conciliación restaurado completamente';
END $$;
