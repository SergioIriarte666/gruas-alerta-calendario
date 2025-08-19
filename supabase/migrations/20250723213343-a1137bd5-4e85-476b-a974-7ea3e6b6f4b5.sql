-- AJUSTE DEFINITIVO: Eliminar completamente los costos cuando se elimina un servicio manualmente
-- Esto asegura que no queden datos huérfanos cuando el usuario quiere limpiar y volver a empezar

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

  -- 2. ELIMINAR COMPLETAMENTE los costos (incluyendo comisiones)
  DELETE FROM public.costs WHERE service_id = p_service_id;
  RAISE NOTICE 'Eliminados TODOS los costos del servicio: %', p_service_id;

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