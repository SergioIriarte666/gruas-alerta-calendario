-- Crear función para generar costos de comisión automáticamente
CREATE OR REPLACE FUNCTION public.generate_commission_cost()
RETURNS TRIGGER AS $$
DECLARE
  service_record RECORD;
  category_id_commission UUID;
BEGIN
  -- Solo procesar recursos de tipo operator con comisión > 0
  IF NEW.resource_type = 'operator' AND NEW.commission_amount > 0 AND NEW.operator_id IS NOT NULL THEN
    
    -- Obtener datos del servicio
    SELECT s.*, o.name as operator_name
    INTO service_record
    FROM public.services s
    LEFT JOIN public.operators o ON NEW.operator_id = o.id
    WHERE s.id = NEW.service_id;
    
    -- Obtener el category_id de comisiones
    SELECT id INTO category_id_commission
    FROM public.cost_categories
    WHERE name = 'Comisión Operador'
    LIMIT 1;
    
    -- Solo generar si no existe ya un costo de comisión para este servicio y operador
    IF NOT EXISTS (
      SELECT 1 FROM public.costs c
      JOIN public.cost_categories cc ON c.category_id = cc.id
      WHERE cc.name = 'Comisión Operador'
        AND c.service_id = NEW.service_id
        AND c.operator_id = NEW.operator_id
    ) THEN
      
      -- Insertar el costo de comisión
      INSERT INTO public.costs (
        amount,
        category_id,
        service_id,
        operator_id,
        service_folio,
        date,
        description,
        subcategory,
        notes,
        created_by
      ) VALUES (
        NEW.commission_amount,
        category_id_commission,
        NEW.service_id,
        NEW.operator_id,
        service_record.folio,
        service_record.service_date,
        'Comisión por servicio ' || service_record.folio || ' - ' || service_record.operator_name,
        'comisiones',
        'Comisión generada automáticamente',
        service_record.created_by
      );
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para service_resources
DROP TRIGGER IF EXISTS trigger_generate_commission_cost ON public.service_resources;
CREATE TRIGGER trigger_generate_commission_cost
  AFTER INSERT OR UPDATE ON public.service_resources
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_commission_cost();

-- Generar costos para servicios existentes que tienen comisiones pero no costos
INSERT INTO public.costs (
  amount,
  category_id,
  service_id,
  operator_id,
  service_folio,
  date,
  description,
  subcategory,
  notes,
  created_by
)
SELECT 
  sr.commission_amount,
  (SELECT id FROM public.cost_categories WHERE name = 'Comisión Operador' LIMIT 1),
  s.id,
  sr.operator_id,
  s.folio,
  s.service_date,
  'Comisión por servicio ' || s.folio || ' - ' || o.name,
  'comisiones',
  'Comisión generada automáticamente por migración',
  s.created_by
FROM public.service_resources sr
JOIN public.services s ON sr.service_id = s.id
JOIN public.operators o ON sr.operator_id = o.id
WHERE sr.resource_type = 'operator'
  AND sr.commission_amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.costs c
    JOIN public.cost_categories cc ON c.category_id = cc.id
    WHERE cc.name = 'Comisión Operador'
      AND c.service_id = s.id
      AND c.operator_id = sr.operator_id
  );