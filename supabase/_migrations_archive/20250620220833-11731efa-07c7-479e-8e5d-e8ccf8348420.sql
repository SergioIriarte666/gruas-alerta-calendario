
-- Actualizar el status de los servicios que ya están facturados pero tienen status 'completed'
UPDATE services 
SET status = 'invoiced', updated_at = now()
WHERE folio IN ('2681063', '2714358') 
AND status = 'completed';

-- Verificar que el trigger funcione correctamente recreándolo
DROP TRIGGER IF EXISTS trigger_update_service_status_on_invoice ON invoice_services;

CREATE TRIGGER trigger_update_service_status_on_invoice
  AFTER INSERT ON invoice_services
  FOR EACH ROW
  EXECUTE FUNCTION update_service_status_on_invoice();
