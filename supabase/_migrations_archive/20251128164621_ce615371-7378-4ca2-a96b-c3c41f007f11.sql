
-- Crear función para eliminar comisiones cuando se elimina un servicio
CREATE OR REPLACE FUNCTION public.delete_commissions_on_service_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  commission_category_id UUID;
  deleted_count INTEGER;
BEGIN
  -- Obtener ID de categoría de comisiones
  SELECT id INTO commission_category_id 
  FROM public.cost_categories 
  WHERE name = 'Comisión Operador'
  LIMIT 1;
  
  IF commission_category_id IS NOT NULL THEN
    -- Eliminar todas las comisiones asociadas al servicio
    DELETE FROM public.costs 
    WHERE service_id = OLD.id 
      AND category_id = commission_category_id;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
      RAISE NOTICE '🗑️ Eliminadas % comisiones del servicio %', deleted_count, OLD.folio;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Crear trigger que se ejecuta ANTES de eliminar un servicio
DROP TRIGGER IF EXISTS trigger_delete_commissions_on_service_delete ON services;
CREATE TRIGGER trigger_delete_commissions_on_service_delete
  BEFORE DELETE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_commissions_on_service_delete();
