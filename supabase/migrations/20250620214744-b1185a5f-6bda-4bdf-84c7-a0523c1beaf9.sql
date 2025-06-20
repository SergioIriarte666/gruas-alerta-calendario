
-- Agregar 'invoiced' al enum service_status
ALTER TYPE service_status ADD VALUE 'invoiced';

-- Crear función para actualizar automáticamente el status a 'invoiced'
CREATE OR REPLACE FUNCTION update_service_status_on_invoice()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar el status del servicio a 'invoiced' cuando se agrega a una factura
  UPDATE services 
  SET status = 'invoiced', updated_at = now()
  WHERE id = NEW.service_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger que se ejecuta cuando se inserta en invoice_services
CREATE TRIGGER trigger_update_service_status_on_invoice
  AFTER INSERT ON invoice_services
  FOR EACH ROW
  EXECUTE FUNCTION update_service_status_on_invoice();
