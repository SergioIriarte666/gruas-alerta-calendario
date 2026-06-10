-- Crear función para eliminar servicio con todos sus datos relacionados
CREATE OR REPLACE FUNCTION public.delete_service_cascade(p_service_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verificar que el usuario sea administrador o tenga permisos
  IF NOT (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'No tiene permisos para eliminar servicios';
  END IF;

  -- Log de la eliminación
  RAISE NOTICE 'Eliminando servicio en cascada: %', p_service_id;

  -- Eliminar registros relacionados en orden correcto para evitar violaciones de FK
  
  -- 1. Eliminar inspecciones
  DELETE FROM public.inspections WHERE service_id = p_service_id;
  RAISE NOTICE 'Eliminadas inspecciones del servicio: %', p_service_id;

  -- 2. Eliminar costos relacionados al servicio
  DELETE FROM public.costs WHERE service_id = p_service_id;
  RAISE NOTICE 'Eliminados costos del servicio: %', p_service_id;

  -- 3. Eliminar service_costs
  DELETE FROM public.service_costs WHERE service_id = p_service_id;
  RAISE NOTICE 'Eliminados service_costs del servicio: %', p_service_id;

  -- 4. Eliminar service_resources
  DELETE FROM public.service_resources WHERE service_id = p_service_id;
  RAISE NOTICE 'Eliminados service_resources del servicio: %', p_service_id;

  -- 5. Eliminar de closure_services
  DELETE FROM public.closure_services WHERE service_id = p_service_id;
  RAISE NOTICE 'Eliminado de closure_services: %', p_service_id;

  -- 6. Eliminar de invoice_services
  DELETE FROM public.invoice_services WHERE service_id = p_service_id;
  RAISE NOTICE 'Eliminado de invoice_services: %', p_service_id;

  -- 7. Eliminar eventos de calendario relacionados
  DELETE FROM public.calendar_events WHERE service_id = p_service_id;
  RAISE NOTICE 'Eliminados eventos de calendario del servicio: %', p_service_id;

  -- 8. Finalmente eliminar el servicio
  DELETE FROM public.services WHERE id = p_service_id;
  RAISE NOTICE 'Servicio eliminado exitosamente: %', p_service_id;

END;
$$;

-- Crear trigger para limpiar automáticamente datos relacionados al eliminar servicio
CREATE OR REPLACE FUNCTION public.cascade_delete_service_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log de la eliminación automática
  RAISE NOTICE 'Trigger: Limpiando datos relacionados del servicio eliminado: %', OLD.id;

  -- Eliminar costos relacionados
  DELETE FROM public.costs WHERE service_id = OLD.id;
  
  -- Eliminar service_costs
  DELETE FROM public.service_costs WHERE service_id = OLD.id;
  
  -- Eliminar service_resources  
  DELETE FROM public.service_resources WHERE service_id = OLD.id;
  
  -- Eliminar inspecciones
  DELETE FROM public.inspections WHERE service_id = OLD.id;
  
  -- Eliminar de closure_services
  DELETE FROM public.closure_services WHERE service_id = OLD.id;
  
  -- Eliminar de invoice_services
  DELETE FROM public.invoice_services WHERE service_id = OLD.id;
  
  -- Eliminar eventos de calendario
  DELETE FROM public.calendar_events WHERE service_id = OLD.id;

  RAISE NOTICE 'Trigger: Datos relacionados eliminados exitosamente para servicio: %', OLD.id;
  
  RETURN OLD;
END;
$$;

-- Crear el trigger en la tabla services
DROP TRIGGER IF EXISTS cascade_delete_service_trigger ON public.services;
CREATE TRIGGER cascade_delete_service_trigger
  BEFORE DELETE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_delete_service_data();