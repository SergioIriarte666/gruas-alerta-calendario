
-- ====================================================================
-- FIX: Comisiones duplicadas por inconsistencia en subcategory
-- El problema: el trigger buscaba duplicados solo con subcategory = 'Comisión Operador'
-- pero existían comisiones antiguas con subcategory = 'comisiones'
-- ====================================================================

-- PASO 1: Eliminar comisiones duplicadas (mantener la más reciente)
WITH duplicates AS (
  SELECT 
    id,
    service_id,
    operator_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY service_id, operator_id 
      ORDER BY created_at DESC
    ) as rn
  FROM costs
  WHERE category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4' -- Comisión Operador
  AND service_id IS NOT NULL
)
DELETE FROM costs
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- PASO 2: Normalizar todas las subcategorías a 'Comisión Operador'
-- Excepto las que están en payment_date (pagadas)
UPDATE costs
SET subcategory = 'Comisión Operador'
WHERE category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
AND subcategory IN ('comisiones', 'comisiones_pagadas')
AND payment_date IS NULL;

-- Para las pagadas, usar 'Comisión Operador' también (el estado de pago se indica con payment_date)
UPDATE costs
SET subcategory = 'Comisión Operador'
WHERE category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
AND subcategory = 'comisiones_pagadas';

-- PASO 3: Actualizar el trigger para buscar duplicados de manera más robusta
CREATE OR REPLACE FUNCTION public.generate_commission_on_service_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_operator_id UUID;
  v_operator_name TEXT;
  v_commission_amount NUMERIC;
  v_category_id UUID := '440296d4-09c2-4f3a-b02b-835f861df4c4';
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
    RETURN NEW;
  END IF;

  -- Determinar el monto de la comisión
  IF v_commission_amount IS NULL OR v_commission_amount = 0 THEN
    v_commission_amount := NEW.operator_commission;
  END IF;

  -- Si no hay comisión definida, salir
  IF v_commission_amount IS NULL OR v_commission_amount = 0 THEN
    RETURN NEW;
  END IF;

  -- BUSCAR DUPLICADOS: Verificar por service_id + operator_id + category_id
  -- SIN importar subcategory (esto previene duplicados por variantes antiguas)
  SELECT id INTO v_existing_commission_id
  FROM costs
  WHERE service_id = NEW.id
    AND operator_id = v_operator_id
    AND category_id = v_category_id
  LIMIT 1;

  -- Si es actualización de comisión y ya existe, actualizar el monto
  IF v_is_commission_update AND v_existing_commission_id IS NOT NULL THEN
    UPDATE costs
    SET amount = v_commission_amount,
        subcategory = 'Comisión Operador',
        updated_at = NOW()
    WHERE id = v_existing_commission_id;
    RETURN NEW;
  END IF;

  -- Si ya existe una comisión, salir (evitar duplicado)
  IF v_existing_commission_id IS NOT NULL THEN
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

  RETURN NEW;
END;
$function$;

-- PASO 4: Añadir índice único para prevenir duplicados a nivel de DB
-- Primero eliminar si existe
DROP INDEX IF EXISTS idx_costs_unique_commission;

-- Crear índice único parcial (solo para comisiones con service_id y operator_id)
CREATE UNIQUE INDEX idx_costs_unique_commission 
ON costs (service_id, operator_id, category_id)
WHERE service_id IS NOT NULL 
  AND operator_id IS NOT NULL 
  AND category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4';

COMMENT ON INDEX idx_costs_unique_commission IS 
  'Previene comisiones duplicadas: un operador solo puede tener una comisión por servicio';
