-- 1. Crear la comisión faltante para SRV-6242 (Juan Carlos Sanchez - $30,000)
INSERT INTO public.costs (
  date,
  description,
  amount,
  category_id,
  operator_id,
  service_id,
  service_folio,
  subcategory
)
SELECT 
  s.service_date,
  'Comisión operador: ' || o.name || ' - Servicio ' || s.folio,
  30000,
  '440296d4-09c2-4f3a-b02b-835f861df4c4', -- Comisión Operador category
  sr.operator_id,
  s.id,
  s.folio,
  'Comisión Operador'
FROM services s
JOIN service_resources sr ON sr.service_id = s.id AND sr.role = 'Principal'
JOIN operators o ON o.id = sr.operator_id
WHERE s.folio = 'SRV-6242'
AND NOT EXISTS (
  SELECT 1 FROM costs c 
  WHERE c.service_id = s.id 
  AND c.operator_id = sr.operator_id 
  AND c.subcategory = 'Comisión Operador'
);

-- 2. Mejorar el trigger para cubrir servicios 'invoiced' y actualizaciones de comisión
CREATE OR REPLACE FUNCTION public.generate_commission_on_service_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operator_id UUID;
  v_operator_name TEXT;
  v_commission_amount NUMERIC;
  v_category_id UUID;
  v_existing_commission_id UUID;
  v_is_status_change BOOLEAN := FALSE;
  v_is_commission_update BOOLEAN := FALSE;
BEGIN
  -- Determinar si es un cambio de estado a completed/invoiced
  v_is_status_change := (
    NEW.status IN ('completed', 'invoiced') 
    AND (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'invoiced'))
  );
  
  -- Determinar si es una actualización de comisión en un servicio ya completed/invoiced
  v_is_commission_update := (
    NEW.status IN ('completed', 'invoiced')
    AND NEW.operator_commission > 0
    AND NEW.operator_commission != COALESCE(OLD.operator_commission, 0)
  );
  
  -- Si ninguno aplica, salir
  IF NOT v_is_status_change AND NOT v_is_commission_update THEN
    RETURN NEW;
  END IF;

  -- Obtener el operador principal del servicio desde service_resources
  SELECT sr.operator_id, o.name, sr.commission_amount
  INTO v_operator_id, v_operator_name, v_commission_amount
  FROM service_resources sr
  JOIN operators o ON o.id = sr.operator_id
  WHERE sr.service_id = NEW.id
    AND sr.role = 'Principal'
  LIMIT 1;

  -- Si no hay operador asignado, salir
  IF v_operator_id IS NULL THEN
    RAISE LOG 'generate_commission: No operator found for service %', NEW.folio;
    RETURN NEW;
  END IF;

  -- Determinar el monto de la comisión (prioridad: service_resources > services.operator_commission)
  IF v_commission_amount IS NULL OR v_commission_amount = 0 THEN
    v_commission_amount := NEW.operator_commission;
  END IF;

  -- Si no hay comisión definida, salir
  IF v_commission_amount IS NULL OR v_commission_amount = 0 THEN
    RAISE LOG 'generate_commission: No commission amount for service %', NEW.folio;
    RETURN NEW;
  END IF;

  -- Usar el ID de categoría de Comisión Operador directamente
  v_category_id := '440296d4-09c2-4f3a-b02b-835f861df4c4';

  -- Verificar si ya existe una comisión para este servicio y operador
  SELECT id INTO v_existing_commission_id
  FROM costs
  WHERE service_id = NEW.id
    AND operator_id = v_operator_id
    AND subcategory = 'Comisión Operador'
  LIMIT 1;

  -- Si es actualización de comisión y ya existe, actualizar el monto
  IF v_is_commission_update AND v_existing_commission_id IS NOT NULL THEN
    UPDATE costs
    SET amount = v_commission_amount,
        updated_at = NOW()
    WHERE id = v_existing_commission_id;
    
    RAISE LOG 'generate_commission: Updated commission for service % to %', NEW.folio, v_commission_amount;
    RETURN NEW;
  END IF;

  -- Si ya existe una comisión y no es actualización de monto, salir
  IF v_existing_commission_id IS NOT NULL THEN
    RAISE LOG 'generate_commission: Commission already exists for service %', NEW.folio;
    RETURN NEW;
  END IF;

  -- Insertar la comisión
  INSERT INTO costs (
    date,
    description,
    amount,
    category_id,
    operator_id,
    service_id,
    service_folio,
    subcategory
  ) VALUES (
    NEW.service_date,
    'Comisión operador: ' || v_operator_name || ' - Servicio ' || NEW.folio,
    v_commission_amount,
    v_category_id,
    v_operator_id,
    NEW.id,
    NEW.folio,
    'Comisión Operador'
  );

  RAISE LOG 'generate_commission: Created commission % for service %', v_commission_amount, NEW.folio;

  RETURN NEW;
END;
$$;

-- Recrear el trigger
DROP TRIGGER IF EXISTS trigger_generate_commission_on_service_completion ON services;

CREATE TRIGGER trigger_generate_commission_on_service_completion
  AFTER UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION generate_commission_on_service_completion();