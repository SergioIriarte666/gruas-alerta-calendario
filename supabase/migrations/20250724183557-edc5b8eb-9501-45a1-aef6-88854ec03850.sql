-- Crear trigger para generar costos automáticamente al completar mantenimientos
CREATE OR REPLACE FUNCTION public.create_cost_for_maintenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  maintenance_category_id UUID;
  existing_cost_count INTEGER;
BEGIN
  -- Solo procesar cuando el mantenimiento cambia a 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Obtener ID de categoría de mantenimiento
    SELECT id INTO maintenance_category_id 
    FROM public.cost_categories 
    WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%mant%'
    LIMIT 1;
    
    -- Si no existe la categoría, crearla
    IF maintenance_category_id IS NULL THEN
      INSERT INTO public.cost_categories (name, description)
      VALUES ('Mantenimiento', 'Gastos de mantenimiento y reparaciones de grúas')
      RETURNING id INTO maintenance_category_id;
    END IF;
    
    -- Verificar que no exista costo previo para este mantenimiento
    SELECT COUNT(*) INTO existing_cost_count
    FROM public.costs 
    WHERE crane_id = NEW.crane_id 
    AND date = COALESCE(NEW.completed_date, NEW.scheduled_date)
    AND amount = NEW.cost
    AND description LIKE '%' || NEW.maintenance_type || '%'
    AND category_id = maintenance_category_id;
    
    -- Solo crear si no existe costo previo y el costo es mayor a 0
    IF existing_cost_count = 0 AND NEW.cost > 0 THEN
      INSERT INTO public.costs (
        amount,
        category_id,
        crane_id,
        date,
        description,
        notes,
        subcategory,
        created_by
      ) VALUES (
        NEW.cost,
        maintenance_category_id,
        NEW.crane_id,
        COALESCE(NEW.completed_date, NEW.scheduled_date),
        'Mantenimiento ' || NEW.maintenance_type || CASE WHEN NEW.provider IS NOT NULL THEN ' - ' || NEW.provider ELSE '' END,
        COALESCE(NEW.notes, '') || CASE WHEN NEW.description IS NOT NULL THEN ' | ' || NEW.description ELSE '' END,
        CASE 
          WHEN NEW.maintenance_type = 'preventive' THEN 'Mantenimiento Preventivo'
          WHEN NEW.maintenance_type = 'corrective' THEN 'Mantenimiento Correctivo'
          WHEN NEW.maintenance_type = 'emergency' THEN 'Mantenimiento de Emergencia'
          ELSE 'Mantenimiento General'
        END,
        NEW.created_by
      );
      
      RAISE NOTICE 'Costo de mantenimiento creado automáticamente: $ % para grúa %', NEW.cost, NEW.crane_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Crear trigger para mantenimientos
DROP TRIGGER IF EXISTS create_maintenance_cost_trigger ON public.crane_maintenance;
CREATE TRIGGER create_maintenance_cost_trigger
  AFTER INSERT OR UPDATE ON public.crane_maintenance
  FOR EACH ROW
  EXECUTE FUNCTION public.create_cost_for_maintenance();

-- Función para corregir mantenimientos históricos sin costos
CREATE OR REPLACE FUNCTION public.backfill_maintenance_costs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  maintenance_record RECORD;
  maintenance_category_id UUID;
  created_count INTEGER := 0;
  error_count INTEGER := 0;
  errors jsonb := '[]'::jsonb;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar esta función';
  END IF;

  -- Obtener categoría de mantenimiento
  SELECT id INTO maintenance_category_id 
  FROM public.cost_categories 
  WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%mant%'
  LIMIT 1;

  -- Si no existe, crearla
  IF maintenance_category_id IS NULL THEN
    INSERT INTO public.cost_categories (name, description)
    VALUES ('Mantenimiento', 'Gastos de mantenimiento y reparaciones de grúas')
    RETURNING id INTO maintenance_category_id;
  END IF;

  -- Procesar mantenimientos completados sin costos asociados
  FOR maintenance_record IN 
    SELECT cm.* 
    FROM public.crane_maintenance cm
    WHERE cm.status = 'completed' 
    AND cm.cost > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.costs c 
      WHERE c.crane_id = cm.crane_id 
      AND c.date = COALESCE(cm.completed_date, cm.scheduled_date)
      AND c.amount = cm.cost
      AND c.category_id = maintenance_category_id
    )
    ORDER BY cm.completed_date DESC NULLS LAST
  LOOP
    BEGIN
      INSERT INTO public.costs (
        amount,
        category_id,
        crane_id,
        date,
        description,
        notes,
        subcategory,
        created_by
      ) VALUES (
        maintenance_record.cost,
        maintenance_category_id,
        maintenance_record.crane_id,
        COALESCE(maintenance_record.completed_date, maintenance_record.scheduled_date),
        'Mantenimiento ' || maintenance_record.maintenance_type || 
        CASE WHEN maintenance_record.provider IS NOT NULL THEN ' - ' || maintenance_record.provider ELSE '' END ||
        ' (Backfill automático)',
        COALESCE(maintenance_record.notes, '') || 
        CASE WHEN maintenance_record.description IS NOT NULL THEN ' | ' || maintenance_record.description ELSE '' END,
        CASE 
          WHEN maintenance_record.maintenance_type = 'preventive' THEN 'Mantenimiento Preventivo'
          WHEN maintenance_record.maintenance_type = 'corrective' THEN 'Mantenimiento Correctivo'
          WHEN maintenance_record.maintenance_type = 'emergency' THEN 'Mantenimiento de Emergencia'
          ELSE 'Mantenimiento General'
        END,
        maintenance_record.created_by
      );
      
      created_count := created_count + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        errors := errors || jsonb_build_object(
          'maintenance_id', maintenance_record.id,
          'crane_id', maintenance_record.crane_id,
          'error', SQLERRM
        );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'created_count', created_count,
    'error_count', error_count,
    'errors', errors,
    'message', format('Backfill completado: %s costos creados, %s errores', created_count, error_count)
  );
END;
$function$;

-- Mejorar función de prevención de duplicados para incluir mantenimientos
CREATE OR REPLACE FUNCTION public.prevent_duplicate_maintenance_costs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  maintenance_category_id UUID;
  existing_count INTEGER;
BEGIN
  -- Obtener ID de categoría de mantenimiento
  SELECT id INTO maintenance_category_id 
  FROM public.cost_categories 
  WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%mant%';
  
  IF NEW.category_id = maintenance_category_id THEN
    -- Verificar duplicados para costos de mantenimiento
    SELECT COUNT(*) INTO existing_count
    FROM public.costs 
    WHERE crane_id = NEW.crane_id 
      AND date = NEW.date
      AND amount = NEW.amount
      AND category_id = maintenance_category_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF existing_count > 0 THEN
      RAISE EXCEPTION 'Ya existe un costo de mantenimiento duplicado para esta grúa en la misma fecha con el mismo monto';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Crear trigger para prevenir duplicados de mantenimiento
DROP TRIGGER IF EXISTS prevent_maintenance_cost_duplicates ON public.costs;
CREATE TRIGGER prevent_maintenance_cost_duplicates
  BEFORE INSERT OR UPDATE ON public.costs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_maintenance_costs();