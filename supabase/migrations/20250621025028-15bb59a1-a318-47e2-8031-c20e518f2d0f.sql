
-- Verificar qué servicios están en facturas pero no marcados como facturados
SELECT 
  s.folio,
  s.status,
  i.folio as invoice_folio
FROM services s
INNER JOIN closure_services cs ON s.id = cs.service_id
INNER JOIN invoice_closures ic ON cs.closure_id = ic.closure_id
INNER JOIN invoices i ON ic.invoice_id = i.id
WHERE s.status != 'invoiced';

-- Actualizar todos los servicios que están en facturas pero no marcados como facturados
UPDATE services 
SET status = 'invoiced', updated_at = now()
WHERE id IN (
  SELECT DISTINCT s.id 
  FROM services s
  INNER JOIN closure_services cs ON s.id = cs.service_id
  INNER JOIN invoice_closures ic ON cs.closure_id = ic.closure_id
  INNER JOIN invoices i ON ic.invoice_id = i.id
  WHERE s.status != 'invoiced'
);

-- Recrear el trigger para asegurar que funcione correctamente
DROP TRIGGER IF EXISTS trigger_update_service_status_on_invoice_closure ON invoice_closures;

-- Crear función actualizada para manejar la relación a través de cierres
CREATE OR REPLACE FUNCTION update_services_status_on_invoice_closure()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar el status de todos los servicios del cierre a 'invoiced'
  UPDATE services 
  SET status = 'invoiced', updated_at = now()
  WHERE id IN (
    SELECT service_id 
    FROM closure_services 
    WHERE closure_id = NEW.closure_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger que se ejecuta cuando se relaciona un cierre con una factura
CREATE TRIGGER trigger_update_service_status_on_invoice_closure
  AFTER INSERT ON invoice_closures
  FOR EACH ROW
  EXECUTE FUNCTION update_services_status_on_invoice_closure();
