-- SOLUCIÓN DEFINITIVA: Eliminar el trigger que altera fechas y reemplazarlo con uno que NO toque las fechas

-- Primero eliminar el trigger existente
DROP TRIGGER IF EXISTS generate_commission_on_service_completion_trigger ON public.services;

-- Crear función corregida que NO toque las fechas
CREATE OR REPLACE FUNCTION generate_commission_on_service_completion()
RETURNS TRIGGER AS $$
DECLARE
  commission_category_id UUID;
  operator_name TEXT;
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
    
    -- Obtener nombre del operador
    SELECT name INTO operator_name
    FROM public.operators 
    WHERE id = NEW.operator_id;
    
    -- Crear costo de comisión SIN TOCAR LAS FECHAS DEL SERVICIO
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
      NEW.service_date, -- Usar la fecha del servicio SIN MODIFICARLA
      'Comisión por servicio: ' || COALESCE(operator_name, 'Operador'),
      NEW.id,
      NEW.folio,
      NEW.operator_id,
      'comisiones',
      NEW.created_by
    );
    
    RAISE NOTICE 'Comisión creada para servicio %: $%', NEW.folio, NEW.operator_commission;
  END IF;
  
  -- CRÍTICO: NO modificar NEW, devolver tal como está para preservar fechas
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear el trigger
CREATE TRIGGER generate_commission_on_service_completion_trigger
  AFTER UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION generate_commission_on_service_completion();