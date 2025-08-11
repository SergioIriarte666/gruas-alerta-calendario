-- SOLUCIÓN DEFINITIVA: Eliminar el trigger defectuoso que está borrando costos automáticamente

-- 1. Eliminar el trigger problemático
DROP TRIGGER IF EXISTS cascade_delete_service_trigger ON public.services;

-- 2. Eliminar la función problemática  
DROP FUNCTION IF EXISTS public.cascade_delete_service_data();

-- 3. Recrear la función delete_service_cascade SIN eliminar costos automáticamente
-- Los costos deben persistir para auditoría y reportes
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

  -- 2. MANTENER costos para auditoría - solo desasociar del servicio
  UPDATE public.costs 
  SET service_id = NULL, 
      notes = COALESCE(notes || ' | ', '') || 'Servicio eliminado: ' || p_service_id::text
  WHERE service_id = p_service_id;
  RAISE NOTICE 'Desasociados costos del servicio (mantenidos para auditoría): %', p_service_id;

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

-- 4. Recrear los costos que fueron eliminados erróneamente para el servicio 3008437-1
-- Estos datos los obtuvimos de las network requests anteriores
INSERT INTO public.costs (
  date,
  description,
  amount,
  category_id,
  service_id,
  service_folio,
  subcategory,
  cost_center_id
) VALUES 
-- Combustible
(
  '2025-07-20',
  'Combustible',
  100000,
  '1c3e8ed4-c711-4bc8-bd8a-79c152f51e4b',  -- Gastos de Servicios
  'ff01d4cf-0e20-4750-a195-aca55c4a2a0f',
  '3008437-1',
  '',
  'fddd6660-d149-4be8-8067-96856fc4cadb'
),
-- Peajes
(
  '2025-07-20',
  'Peajes',
  15000,
  '1c3e8ed4-c711-4bc8-bd8a-79c152f51e4b',  -- Gastos de Servicios
  'ff01d4cf-0e20-4750-a195-aca55c4a2a0f',
  '3008437-1',
  '',
  'fddd6660-d149-4be8-8067-96856fc4cadb'
),
-- Viaticos
(
  '2025-07-20',
  'Viatico',
  15000,
  '1c3e8ed4-c711-4bc8-bd8a-79c152f51e4b',  -- Gastos de Servicios
  'ff01d4cf-0e20-4750-a195-aca55c4a2a0f',
  '3008437-1',
  '',
  'fddd6660-d149-4be8-8067-96856fc4cadb'
),
-- Comisión
(
  '2025-07-20',
  'Comisión por servicio 3008437-1 - Jesus Rojas',
  150000,
  '440296d4-09c2-4f3a-b02b-835f861df4c4',  -- Comisión Operador
  'ff01d4cf-0e20-4750-a195-aca55c4a2a0f',
  '3008437-1',
  'comisiones',
  'fddd6660-d149-4be8-8067-96856fc4cadb'
);