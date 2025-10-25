
-- PASO 1: Corregir pagos con applied_amount incorrecto (remaining_amount se calcula automáticamente)
UPDATE payments p
SET applied_amount = COALESCE((
  SELECT SUM(pa.applied_amount) 
  FROM payment_applications pa 
  WHERE pa.payment_id = p.id
), 0)
WHERE p.applied_amount != COALESCE((
  SELECT SUM(pa.applied_amount) 
  FROM payment_applications pa 
  WHERE pa.payment_id = p.id
), 0);

-- PASO 2: Eliminar triggers duplicados
DROP TRIGGER IF EXISTS update_payment_amounts_on_application ON payment_applications;
DROP TRIGGER IF EXISTS update_payment_amounts_on_application_update ON payment_applications;
DROP TRIGGER IF EXISTS update_payment_amounts_on_application_delete ON payment_applications;

-- PASO 3: Crear trigger optimizado que SOLO actualiza applied_amount
-- (remaining_amount se calcula automáticamente por la columna generada)
CREATE OR REPLACE FUNCTION update_payment_applied_amount()
RETURNS TRIGGER AS $$
DECLARE
  payment_applied NUMERIC;
  payment_total NUMERIC;
BEGIN
  -- Calcular el monto aplicado sumando las aplicaciones
  SELECT COALESCE(SUM(applied_amount), 0) INTO payment_applied
  FROM payment_applications
  WHERE payment_id = COALESCE(NEW.payment_id, OLD.payment_id);

  -- Obtener el total del pago
  SELECT amount INTO payment_total
  FROM payments
  WHERE id = COALESCE(NEW.payment_id, OLD.payment_id);

  -- Actualizar SOLO applied_amount y status
  -- remaining_amount se calcula automáticamente
  UPDATE payments
  SET 
    applied_amount = payment_applied,
    status = CASE
      WHEN payment_applied = 0 THEN 'pending'
      WHEN payment_applied < payment_total THEN 'partial'
      WHEN payment_applied >= payment_total THEN 'applied'
      ELSE status
    END,
    updated_at = now()
  WHERE id = COALESCE(NEW.payment_id, OLD.payment_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- PASO 4: Crear triggers para INSERT, UPDATE y DELETE
CREATE TRIGGER update_payment_applied_after_insert
AFTER INSERT ON payment_applications
FOR EACH ROW
EXECUTE FUNCTION update_payment_applied_amount();

CREATE TRIGGER update_payment_applied_after_update
AFTER UPDATE ON payment_applications
FOR EACH ROW
EXECUTE FUNCTION update_payment_applied_amount();

CREATE TRIGGER update_payment_applied_after_delete
AFTER DELETE ON payment_applications
FOR EACH ROW
EXECUTE FUNCTION update_payment_applied_amount();
