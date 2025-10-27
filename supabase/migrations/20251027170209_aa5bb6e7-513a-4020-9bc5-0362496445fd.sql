-- =====================================================
-- LIMPIEZA Y CORRECCIÓN DEFINITIVA DEL SISTEMA DE PAGOS
-- =====================================================

-- PASO 1: Eliminar TODOS los triggers de payment_applications
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_table = 'payment_applications'
      AND trigger_schema = 'public'
  )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON payment_applications', r.trigger_name);
    RAISE NOTICE 'Eliminado trigger: %', r.trigger_name;
  END LOOP;
END $$;

-- PASO 2: Función para prevenir sobrepagos (BEFORE trigger)
CREATE OR REPLACE FUNCTION prevent_invoice_overpayment()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_total NUMERIC;
  v_current_paid NUMERIC;
  v_available NUMERIC;
BEGIN
  SELECT total INTO v_invoice_total
  FROM invoices
  WHERE id = NEW.invoice_id;
  
  SELECT COALESCE(SUM(applied_amount), 0) INTO v_current_paid
  FROM payment_applications
  WHERE invoice_id = NEW.invoice_id
    AND (TG_OP = 'INSERT' OR id != NEW.id);
  
  v_available := v_invoice_total - v_current_paid;
  
  IF NEW.applied_amount > v_available THEN
    RAISE EXCEPTION 'Sobrepago no permitido: Monto $% excede el disponible $% para esta factura', 
      NEW.applied_amount, v_available;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- PASO 3: Función para actualizar montos de PAGOS
CREATE OR REPLACE FUNCTION update_payment_amounts()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_id UUID;
  v_total_applied NUMERIC;
  v_payment_amount NUMERIC;
  v_new_status payment_status;
BEGIN
  v_payment_id := COALESCE(NEW.payment_id, OLD.payment_id);
  
  SELECT COALESCE(SUM(applied_amount), 0) INTO v_total_applied
  FROM payment_applications
  WHERE payment_id = v_payment_id;
  
  SELECT amount INTO v_payment_amount
  FROM payments
  WHERE id = v_payment_id;
  
  IF v_total_applied = 0 THEN
    v_new_status := 'pending';
  ELSIF v_total_applied >= v_payment_amount THEN
    v_new_status := 'applied';
  ELSE
    v_new_status := 'partial';
  END IF;
  
  UPDATE payments
  SET 
    applied_amount = v_total_applied,
    status = v_new_status,
    updated_at = NOW()
  WHERE id = v_payment_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- PASO 4: Función para actualizar montos de FACTURAS
CREATE OR REPLACE FUNCTION update_invoice_amounts()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id UUID;
  v_total_paid NUMERIC;
  v_invoice_total NUMERIC;
  v_invoice_due_date DATE;
  v_new_status invoice_status;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  SELECT total, due_date INTO v_invoice_total, v_invoice_due_date
  FROM invoices
  WHERE id = v_invoice_id;
  
  SELECT COALESCE(SUM(applied_amount), 0) INTO v_total_paid
  FROM payment_applications
  WHERE invoice_id = v_invoice_id;
  
  IF v_total_paid >= v_invoice_total THEN
    v_new_status := 'paid';
  ELSIF v_total_paid > 0 THEN
    v_new_status := 'partial';
  ELSIF v_invoice_due_date < CURRENT_DATE THEN
    v_new_status := 'overdue';
  ELSE
    v_new_status := 'sent';
  END IF;
  
  UPDATE invoices
  SET 
    paid_amount = v_total_paid,
    status = v_new_status,
    payment_date = CASE 
      WHEN v_new_status = 'paid' AND payment_date IS NULL THEN CURRENT_DATE
      WHEN v_new_status != 'paid' THEN NULL
      ELSE payment_date
    END,
    updated_at = NOW()
  WHERE id = v_invoice_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- PASO 5: Crear triggers nuevos
CREATE TRIGGER prevent_invoice_overpayment_trigger
  BEFORE INSERT OR UPDATE ON payment_applications
  FOR EACH ROW
  EXECUTE FUNCTION prevent_invoice_overpayment();

CREATE TRIGGER update_payment_amounts_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payment_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_amounts();

CREATE TRIGGER update_invoice_amounts_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payment_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_amounts();

-- PASO 6: Corregir datos inconsistentes
UPDATE invoices i
SET 
  paid_amount = COALESCE((
    SELECT SUM(pa.applied_amount) 
    FROM payment_applications pa 
    WHERE pa.invoice_id = i.id
  ), 0),
  status = CASE
    WHEN COALESCE((SELECT SUM(pa.applied_amount) FROM payment_applications pa WHERE pa.invoice_id = i.id), 0) >= i.total THEN 'paid'::invoice_status
    WHEN COALESCE((SELECT SUM(pa.applied_amount) FROM payment_applications pa WHERE pa.invoice_id = i.id), 0) > 0 THEN 'partial'::invoice_status
    WHEN i.due_date < CURRENT_DATE THEN 'overdue'::invoice_status
    ELSE i.status
  END,
  updated_at = NOW()
WHERE paid_amount != COALESCE((
  SELECT SUM(pa.applied_amount) 
  FROM payment_applications pa 
  WHERE pa.invoice_id = i.id
), 0);

UPDATE payments p
SET 
  applied_amount = COALESCE((
    SELECT SUM(pa.applied_amount) 
    FROM payment_applications pa 
    WHERE pa.payment_id = p.id
  ), 0),
  status = CASE
    WHEN COALESCE((SELECT SUM(pa.applied_amount) FROM payment_applications pa WHERE pa.payment_id = p.id), 0) = 0 THEN 'pending'::payment_status
    WHEN COALESCE((SELECT SUM(pa.applied_amount) FROM payment_applications pa WHERE pa.payment_id = p.id), 0) >= p.amount THEN 'applied'::payment_status
    ELSE 'partial'::payment_status
  END,
  updated_at = NOW()
WHERE applied_amount != COALESCE((
  SELECT SUM(pa.applied_amount) 
  FROM payment_applications pa 
  WHERE pa.payment_id = p.id
), 0);

-- PASO 7: Validación
DO $$
DECLARE
  v_trigger_count INTEGER;
  v_overpaid INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_trigger_count
  FROM information_schema.triggers
  WHERE event_object_table = 'payment_applications'
    AND trigger_schema = 'public';
  
  SELECT COUNT(*) INTO v_overpaid
  FROM invoices
  WHERE paid_amount > total;
  
  RAISE NOTICE '✓ Sistema restaurado: % triggers activos, % facturas con sobrepago', v_trigger_count, v_overpaid;
END $$;