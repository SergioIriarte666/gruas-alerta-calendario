-- SOLUCIÓN REAL: Arreglar el trigger para usar operator_commission del servicio
-- El problema es que el trigger busca en service_resources pero el sistema usa operator_commission

DROP TRIGGER IF EXISTS generate_multiple_commissions_on_service_completion ON public.services;

CREATE OR REPLACE FUNCTION public.generate_commission_on_service_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    
    -- Verificar que no exista comisión previa
    IF NOT EXISTS (
      SELECT 1 FROM public.costs 
      WHERE service_id = NEW.id 
        AND operator_id = NEW.operator_id 
        AND category_id = commission_category_id
    ) THEN
      -- Crear registro de comisión en costs
      INSERT INTO public.costs (
        amount,
        category_id,
        service_id,
        operator_id,
        service_folio,
        date,
        description,
        subcategory,
        cost_center_id
      ) VALUES (
        NEW.operator_commission,
        commission_category_id,
        NEW.id,
        NEW.operator_id,
        NEW.folio,
        NEW.service_date,
        'Comisión por servicio ' || NEW.folio || ' - ' || COALESCE(operator_name, 'Operador'),
        'comisiones',
        'fddd6660-d149-4be8-8067-96856fc4cadb'
      );
      
      RAISE NOTICE 'Comisión creada automáticamente: % para operador %', NEW.operator_commission, operator_name;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear el trigger correcto en la tabla services
CREATE TRIGGER generate_commission_on_completion
  AFTER UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_commission_on_service_completion();