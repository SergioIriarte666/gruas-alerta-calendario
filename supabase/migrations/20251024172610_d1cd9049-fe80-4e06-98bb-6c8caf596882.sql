-- =====================================================
-- CORRECCIÓN COMPLETA DEL SISTEMA DE PAGOS
-- Reactiva triggers y corrige inconsistencias existentes
-- =====================================================

-- Paso 1: Eliminar triggers existentes si los hay (para recrearlos limpios)
DROP TRIGGER IF EXISTS maintain_payment_consistency_trigger ON payment_applications;
DROP TRIGGER IF EXISTS payment_applications_auto_update_invoice_status ON payment_applications;

-- Paso 2: Verificar que las funciones de trigger existan (recrearlas si es necesario)
CREATE OR REPLACE FUNCTION maintain_payment_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_total_applied DECIMAL(10,2);
  v_payment_amount DECIMAL(10,2);
  v_new_status payment_status;
BEGIN
  -- Calcular el total aplicado para este pago
  SELECT COALESCE(SUM(applied_amount), 0)
  INTO v_total_applied
  FROM payment_applications
  WHERE payment_id = COALESCE(NEW.payment_id, OLD.payment_id);

  -- Obtener el monto del pago
  SELECT amount INTO v_payment_amount
  FROM payments
  WHERE id = COALESCE(NEW.payment_id, OLD.payment_id);

  -- Determinar el nuevo estado
  IF v_total_applied = 0 THEN
    v_new_status := 'pending';
  ELSIF v_total_applied >= v_payment_amount THEN
    v_new_status := 'applied';
  ELSE
    v_new_status := 'partial';
  END IF;

  -- Actualizar el pago (solo campos no generados)
  UPDATE payments
  SET 
    applied_amount = v_total_applied,
    status = v_new_status,
    updated_at = now()
  WHERE id = COALESCE(NEW.payment_id, OLD.payment_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

  -- Calcular el total pagado para esta factura
  SELECT COALESCE(SUM(applied_amount), 0)
  INTO v_invoice_paid
  FROM payment_applications
  WHERE invoice_id = v_invoice_id;

  -- Determinar el nuevo estado de la factura
  IF v_invoice_paid = 0 THEN
    -- Mantener el estado actual si no hay pagos
    RETURN COALESCE(NEW, OLD);
  ELSIF v_invoice_paid >= v_invoice_total THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  -- Actualizar la factura (solo campos no generados)
  UPDATE invoices
  SET 
    paid_amount = v_invoice_paid,
    status = v_new_status,
    updated_at = now()
  WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Paso 3: Crear los triggers
CREATE TRIGGER maintain_payment_consistency_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payment_applications
  FOR EACH ROW
  EXECUTE FUNCTION maintain_payment_consistency();

CREATE TRIGGER payment_applications_auto_update_invoice_status
  AFTER INSERT OR UPDATE OR DELETE ON payment_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_status_from_payments();

-- Paso 4: Función para corregir pagos inconsistentes existentes
CREATE OR REPLACE FUNCTION fix_existing_payment_inconsistencies()
RETURNS TABLE(
  payment_id UUID,
  old_applied_amount DECIMAL(10,2),
  new_applied_amount DECIMAL(10,2),
  old_status payment_status,
  new_status payment_status
) AS $$
DECLARE
  v_payment RECORD;
  v_total_applied DECIMAL(10,2);
  v_new_status payment_status;
BEGIN
  -- Iterar sobre todos los pagos
  FOR v_payment IN 
    SELECT p.id, p.amount, p.applied_amount as current_applied, p.status as current_status
    FROM payments p
  LOOP
    -- Calcular el verdadero total aplicado
    SELECT COALESCE(SUM(pa.applied_amount), 0)
    INTO v_total_applied
    FROM payment_applications pa
    WHERE pa.payment_id = v_payment.id;

    -- Determinar el estado correcto
    IF v_total_applied = 0 THEN
      v_new_status := 'pending';
    ELSIF v_total_applied >= v_payment.amount THEN
      v_new_status := 'applied';
    ELSE
      v_new_status := 'partial';
    END IF;

    -- Si hay diferencia, corregir
    IF v_total_applied != v_payment.current_applied OR v_new_status != v_payment.current_status THEN
      -- Guardar valores antiguos para el reporte
      payment_id := v_payment.id;
      old_applied_amount := v_payment.current_applied;
      new_applied_amount := v_total_applied;
      old_status := v_payment.current_status;
      new_status := v_new_status;

      -- Actualizar el pago
      UPDATE payments
      SET 
        applied_amount = v_total_applied,
        status = v_new_status,
        updated_at = now()
      WHERE id = v_payment.id;

      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Paso 5: Función para corregir facturas inconsistentes existentes
CREATE OR REPLACE FUNCTION fix_existing_invoice_inconsistencies()
RETURNS TABLE(
  invoice_id UUID,
  old_paid_amount DECIMAL(10,2),
  new_paid_amount DECIMAL(10,2),
  old_status invoice_status,
  new_status invoice_status
) AS $$
DECLARE
  v_invoice RECORD;
  v_total_paid DECIMAL(10,2);
  v_new_status invoice_status;
BEGIN
  -- Iterar sobre todas las facturas
  FOR v_invoice IN 
    SELECT i.id, i.total, i.paid_amount as current_paid, i.status as current_status
    FROM invoices i
  LOOP
    -- Calcular el verdadero total pagado
    SELECT COALESCE(SUM(pa.applied_amount), 0)
    INTO v_total_paid
    FROM payment_applications pa
    WHERE pa.invoice_id = v_invoice.id;

    -- Determinar el estado correcto (solo si hay pagos)
    IF v_total_paid > 0 THEN
      IF v_total_paid >= v_invoice.total THEN
        v_new_status := 'paid';
      ELSE
        v_new_status := 'partial';
      END IF;
    ELSE
      -- Si no hay pagos, mantener el estado actual
      v_new_status := v_invoice.current_status;
    END IF;

    -- Si hay diferencia, corregir
    IF v_total_paid != v_invoice.current_paid OR (v_total_paid > 0 AND v_new_status != v_invoice.current_status) THEN
      -- Guardar valores antiguos para el reporte
      invoice_id := v_invoice.id;
      old_paid_amount := v_invoice.current_paid;
      new_paid_amount := v_total_paid;
      old_status := v_invoice.current_status;
      new_status := v_new_status;

      -- Actualizar la factura
      UPDATE invoices
      SET 
        paid_amount = v_total_paid,
        status = v_new_status,
        updated_at = now()
      WHERE id = v_invoice.id;

      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Paso 6: Ejecutar la corrección de datos existentes
DO $$
DECLARE
  v_payments_fixed INTEGER := 0;
  v_invoices_fixed INTEGER := 0;
BEGIN
  -- Corregir pagos
  SELECT COUNT(*) INTO v_payments_fixed
  FROM fix_existing_payment_inconsistencies();
  
  -- Corregir facturas
  SELECT COUNT(*) INTO v_invoices_fixed
  FROM fix_existing_invoice_inconsistencies();
  
  RAISE NOTICE 'Corrección completada: % pagos corregidos, % facturas corregidas', 
    v_payments_fixed, v_invoices_fixed;
END $$;

-- Paso 7: Validar que los triggers están activos (corregido para contar nombres únicos)
DO $$
DECLARE
  v_trigger_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT trigger_name) INTO v_trigger_count
  FROM information_schema.triggers
  WHERE trigger_name IN ('maintain_payment_consistency_trigger', 'payment_applications_auto_update_invoice_status')
    AND event_object_table = 'payment_applications';
  
  IF v_trigger_count != 2 THEN
    RAISE EXCEPTION 'ERROR: Los triggers no se crearon correctamente. Encontrados: %', v_trigger_count;
  END IF;
  
  RAISE NOTICE 'Validación exitosa: Los 2 triggers están activos en la tabla payment_applications';
END $$;