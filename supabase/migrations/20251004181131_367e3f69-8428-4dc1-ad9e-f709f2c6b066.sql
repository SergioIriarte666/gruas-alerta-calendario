-- Recrear triggers críticos para el sistema de pagos
-- Estos triggers mantienen la consistencia automática entre payments, payment_applications e invoices

-- 1. Trigger para mantener consistencia de pagos (actualiza applied_amount y status en payments)
DROP TRIGGER IF EXISTS maintain_payment_consistency_trigger ON payment_applications;
CREATE TRIGGER maintain_payment_consistency_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payment_applications
  FOR EACH ROW 
  EXECUTE FUNCTION maintain_payment_consistency();

-- 2. Trigger para actualizar estados de facturas automáticamente
DROP TRIGGER IF EXISTS payment_applications_auto_update_invoice_status ON payment_applications;
CREATE TRIGGER payment_applications_auto_update_invoice_status
  AFTER INSERT OR UPDATE OR DELETE ON payment_applications
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_invoice_status();

-- 3. Corregir datos existentes con inconsistencias
SELECT fix_applied_amount_duplications();