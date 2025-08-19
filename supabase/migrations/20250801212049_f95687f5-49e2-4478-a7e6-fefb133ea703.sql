-- 1. Corregir el mantenimiento específico inconsistente
UPDATE public.crane_maintenance 
SET status = 'completed', updated_at = now()
WHERE description = 'Reparacion Botella Levante' 
AND completed_date = '2025-08-05' 
AND status = 'in_progress';

-- 2. Función para corregir inconsistencias automáticamente
CREATE OR REPLACE FUNCTION public.fix_maintenance_status_inconsistencies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  fixed_count INTEGER := 0;
  backfilled_count INTEGER := 0;
BEGIN
  -- Corregir mantenimientos con completed_date pero status incorrecto
  UPDATE public.crane_maintenance 
  SET status = 'completed', updated_at = now()
  WHERE completed_date IS NOT NULL 
  AND status != 'completed';
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  
  -- Ejecutar backfill de costos para mantenimientos corregidos
  PERFORM public.backfill_maintenance_costs();
  
  -- Contar costos creados por el backfill
  SELECT COUNT(*) INTO backfilled_count
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name ILIKE '%mantenimiento%'
  AND c.created_at > now() - interval '5 minutes';
  
  RETURN jsonb_build_object(
    'success', true,
    'fixed_maintenance_records', fixed_count,
    'backfilled_costs', backfilled_count,
    'message', format('Corregidos %s mantenimientos y generados %s costos faltantes', fixed_count, backfilled_costs)
  );
END;
$function$;

-- 3. Trigger para mantener consistencia automática
CREATE OR REPLACE FUNCTION public.auto_update_maintenance_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Si se establece completed_date, cambiar status a completed
  IF NEW.completed_date IS NOT NULL AND OLD.completed_date IS NULL THEN
    NEW.status := 'completed';
    RAISE NOTICE 'Auto-actualizado status a completed para mantenimiento %', NEW.id;
  END IF;
  
  -- Si se quita completed_date, cambiar status a in_progress
  IF NEW.completed_date IS NULL AND OLD.completed_date IS NOT NULL THEN
    NEW.status := 'in_progress';
    RAISE NOTICE 'Auto-actualizado status a in_progress para mantenimiento %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Crear trigger si no existe
DROP TRIGGER IF EXISTS auto_maintenance_status_trigger ON public.crane_maintenance;
CREATE TRIGGER auto_maintenance_status_trigger
  BEFORE UPDATE ON public.crane_maintenance
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_maintenance_status();