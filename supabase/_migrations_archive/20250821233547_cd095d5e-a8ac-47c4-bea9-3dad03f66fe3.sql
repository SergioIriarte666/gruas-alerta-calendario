-- CORRECCIÓN DEL TRIGGER generate_commission_on_service_completion
-- Eliminar ON CONFLICT problemático y usar INSERT simple con manejo de duplicados

CREATE OR REPLACE FUNCTION public.generate_commission_on_service_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  commission_category_id UUID;
  operator_name TEXT;
  existing_commission_count INTEGER;
BEGIN
  -- Solo ejecutar cuando el servicio cambia a 'completed' y tiene operator_commission > 0
  IF NEW.status = 'completed' 
     AND (OLD.status IS NULL OR OLD.status != 'completed') 
     AND NEW.operator_commission > 0 
     AND NEW.operator_id IS NOT NULL THEN
    
    -- Obtener ID de categoría de comisiones
    SELECT id INTO commission_category_id 
    FROM public.cost_categories 
    WHERE name = 'Comisión Operador'
    LIMIT 1;
    
    -- Si no existe la categoría, crearla
    IF commission_category_id IS NULL THEN
      INSERT INTO public.cost_categories (name, description)
      VALUES ('Comisión Operador', 'Comisiones pagadas a operadores por servicios')
      RETURNING id INTO commission_category_id;
    END IF;
    
    -- Verificar si ya existe una comisión para este servicio y operador
    SELECT COUNT(*) INTO existing_commission_count
    FROM public.costs 
    WHERE service_id = NEW.id 
      AND operator_id = NEW.operator_id 
      AND category_id = commission_category_id;
    
    -- Solo crear si no existe ya
    IF existing_commission_count = 0 THEN
      -- Obtener nombre del operador
      SELECT name INTO operator_name
      FROM public.operators 
      WHERE id = NEW.operator_id;
      
      -- Insertar nueva comisión SIN usar ON CONFLICT
      INSERT INTO public.costs (
        amount,
        category_id,
        date,
        description,
        service_id,
        service_folio,
        operator_id,
        subcategory,
        created_by
      ) VALUES (
        NEW.operator_commission,
        commission_category_id,
        NEW.service_date,
        'Comisión por servicio: ' || COALESCE(operator_name, 'Operador'),
        NEW.id,
        NEW.folio,
        NEW.operator_id,
        'comisiones',
        NEW.created_by
      );
      
      RAISE NOTICE 'Comisión creada para servicio %: $%', NEW.folio, NEW.operator_commission;
    ELSE
      RAISE NOTICE 'Comisión ya existe para servicio %', NEW.folio;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;