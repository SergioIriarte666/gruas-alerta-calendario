-- Crear trigger para sincronizar información de servicios en costos
-- Este trigger se ejecuta cuando se actualiza un servicio y notifica cambios relevantes

CREATE OR REPLACE FUNCTION public.sync_service_changes_to_costs()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo procesar si cambiaron campos relevantes del vehículo
  IF (OLD.license_plate IS DISTINCT FROM NEW.license_plate) OR
     (OLD.vehicle_brand IS DISTINCT FROM NEW.vehicle_brand) OR  
     (OLD.vehicle_model IS DISTINCT FROM NEW.vehicle_model) OR
     (OLD.folio IS DISTINCT FROM NEW.folio) THEN
    
    -- Log para debugging
    RAISE NOTICE 'Service % updated: license_plate changed from % to %', 
      NEW.id, OLD.license_plate, NEW.license_plate;
    
    -- Actualizar timestamp para forzar refresh de queries relacionadas
    UPDATE public.costs 
    SET updated_at = now()
    WHERE service_id = NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger
DROP TRIGGER IF EXISTS sync_service_changes_trigger ON public.services;
CREATE TRIGGER sync_service_changes_trigger
  AFTER UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_service_changes_to_costs();