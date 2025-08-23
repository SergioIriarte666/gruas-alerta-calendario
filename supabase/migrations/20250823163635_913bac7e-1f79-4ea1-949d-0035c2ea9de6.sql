-- Función para corregir todas las descripciones de costos de mantenimiento
CREATE OR REPLACE FUNCTION public.fix_all_maintenance_cost_descriptions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  fixed_count INTEGER := 0;
  cost_record RECORD;
  maintenance_record RECORD;
  new_description TEXT;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar esta función de corrección';
  END IF;

  -- Buscar todos los costos de mantenimiento con descripciones genéricas
  FOR cost_record IN 
    SELECT c.id, c.description, c.maintenance_id, c.notes
    FROM public.costs c
    JOIN public.cost_categories cc ON c.category_id = cc.id
    WHERE cc.name = 'Mantenimiento' 
      AND c.maintenance_id IS NOT NULL
      AND (c.description ILIKE 'Mantenimiento corrective%' 
           OR c.description ILIKE 'Mantenimiento preventivo%'
           OR c.description NOT ILIKE '%:%'
           OR c.description NOT ILIKE '%proveedor%')
  LOOP
    -- Obtener los detalles del mantenimiento correspondiente
    SELECT cm.description, cm.provider, cm.maintenance_type
    INTO maintenance_record
    FROM public.crane_maintenance cm
    WHERE cm.id = cost_record.maintenance_id;
    
    IF FOUND THEN
      -- Construir la descripción correcta
      new_description := 'Mantenimiento: ' || maintenance_record.description;
      
      IF maintenance_record.provider IS NOT NULL AND maintenance_record.provider != '' THEN
        new_description := new_description || ' - Proveedor: ' || maintenance_record.provider;
      END IF;
      
      -- Actualizar el costo con la descripción correcta
      UPDATE public.costs 
      SET 
        description = new_description,
        notes = CASE 
          WHEN notes IS NULL OR notes = '' THEN 'Descripción corregida automáticamente'
          ELSE notes || ' [Descripción corregida automáticamente]'
        END,
        updated_at = NOW()
      WHERE id = cost_record.id;
      
      fixed_count := fixed_count + 1;
      
      RAISE NOTICE 'Corregido costo %: % -> %', 
        cost_record.id, cost_record.description, new_description;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'fixed_costs', fixed_count,
    'message', format('Corregidas %s descripciones de costos de mantenimiento', fixed_count)
  );
END;
$function$;

-- Mejorar el trigger de creación de costos de mantenimiento para usar descripciones correctas
CREATE OR REPLACE FUNCTION public.create_cost_from_maintenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  maintenance_category_id UUID;
  cost_description TEXT;
  cost_subcategory TEXT;
BEGIN
  -- Solo crear costo cuando el mantenimiento cambia a 'completed' y tiene costo > 0
  IF NEW.status = 'completed' 
     AND (OLD.status IS NULL OR OLD.status != 'completed') 
     AND NEW.cost > 0 THEN
    
    -- Obtener o crear categoría de mantenimiento
    SELECT id INTO maintenance_category_id
    FROM public.cost_categories
    WHERE name = 'Mantenimiento'
    LIMIT 1;
    
    -- Si no existe la categoría, crearla
    IF maintenance_category_id IS NULL THEN
      INSERT INTO public.cost_categories (name, description)
      VALUES ('Mantenimiento', 'Gastos de mantenimiento y reparaciones de grúas')
      RETURNING id INTO maintenance_category_id;
    END IF;
    
    -- Construir descripción CORRECTA basada en los datos del mantenimiento
    cost_description := 'Mantenimiento: ' || COALESCE(NEW.description, 'Sin descripción');
    
    IF NEW.provider IS NOT NULL AND NEW.provider != '' THEN
      cost_description := cost_description || ' - Proveedor: ' || NEW.provider;
    END IF;
    
    -- Determinar subcategoría basada en tipo de mantenimiento
    cost_subcategory := CASE 
      WHEN NEW.maintenance_type ILIKE '%preventivo%' THEN 'Mantenimiento Preventivo'
      WHEN NEW.maintenance_type ILIKE '%correctivo%' OR NEW.maintenance_type ILIKE '%reparaci%' THEN 'Reparaciones'
      WHEN NEW.maintenance_type ILIKE '%repuesto%' OR NEW.maintenance_type ILIKE '%pieza%' THEN 'Piezas y Repuestos'
      WHEN NEW.maintenance_type ILIKE '%revision%' OR NEW.maintenance_type ILIKE '%inspecci%' THEN 'Inspecciones'
      ELSE 'Mantenimiento General'
    END;
    
    -- Verificar si ya existe un costo para este mantenimiento
    IF NOT EXISTS (SELECT 1 FROM public.costs WHERE maintenance_id = NEW.id) THEN
      -- Crear el registro de costo con descripción CORRECTA
      INSERT INTO public.costs (
        amount,
        category_id,
        crane_id,
        date,
        description,
        notes,
        subcategory,
        maintenance_id,
        created_by
      ) VALUES (
        NEW.cost,
        maintenance_category_id,
        NEW.crane_id,
        COALESCE(NEW.completed_date, NEW.scheduled_date, CURRENT_DATE),
        cost_description, -- Usar la descripción correcta construida arriba
        CASE 
          WHEN NEW.notes IS NOT NULL THEN 'Costo generado automáticamente: ' || NEW.notes
          ELSE 'Costo generado automáticamente desde mantenimiento'
        END,
        cost_subcategory,
        NEW.id,
        COALESCE(NEW.created_by, auth.uid())
      );
      
      RAISE NOTICE 'Costo creado automáticamente para mantenimiento %: %', NEW.id, cost_description;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Crear índices para mejorar búsquedas de texto
CREATE INDEX IF NOT EXISTS idx_costs_description_fulltext 
ON public.costs USING gin(to_tsvector('spanish', description));

CREATE INDEX IF NOT EXISTS idx_costs_notes_fulltext 
ON public.costs USING gin(to_tsvector('spanish', COALESCE(notes, '')));

CREATE INDEX IF NOT EXISTS idx_maintenance_description_fulltext 
ON public.crane_maintenance USING gin(to_tsvector('spanish', description));

-- Ejecutar la corrección inmediatamente para todos los costos existentes
-- (Solo se ejecutará una vez durante la migración)
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Buscar un usuario administrador para ejecutar la función
  SELECT id INTO admin_user_id 
  FROM public.profiles 
  WHERE role = 'admin' 
  LIMIT 1;
  
  IF admin_user_id IS NOT NULL THEN
    -- Establecer temporalmente el contexto de autenticación
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', admin_user_id)::text, true);
    
    -- Ejecutar la corrección
    PERFORM public.fix_all_maintenance_cost_descriptions();
    
    RAISE NOTICE 'Corrección automática de descripciones completada durante la migración';
  ELSE
    RAISE NOTICE 'No se encontró usuario administrador. La corrección se ejecutará manualmente.';
  END IF;
END $$;