-- PASO 1: DROP y recrear get_commissions_with_details
DROP FUNCTION IF EXISTS public.get_commissions_with_details();

CREATE FUNCTION public.get_commissions_with_details()
RETURNS TABLE(
  id uuid,
  date date,
  payment_date date,
  payment_batch_id text,
  description text,
  amount numeric,
  operator_id uuid,
  service_id uuid,
  service_folio text,
  subcategory text,
  created_at timestamptz,
  updated_at timestamptz,
  operator_name text,
  operator_rut text,
  service_date date,
  service_value numeric,
  client_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.date,
    c.payment_date,
    c.payment_batch_id,
    c.description,
    c.amount,
    c.operator_id,
    c.service_id,
    c.service_folio,
    c.subcategory,
    c.created_at,
    c.updated_at,
    o.name AS operator_name,
    o.rut AS operator_rut,
    s.service_date,
    s.value AS service_value,
    cl.name AS client_name
  FROM costs c
  LEFT JOIN cost_categories cc ON cc.id = c.category_id
  LEFT JOIN operators o ON o.id = c.operator_id
  LEFT JOIN services s ON s.id = c.service_id
  LEFT JOIN clients cl ON cl.id = s.client_id
  WHERE (
    c.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
    OR cc.name = 'Comisión Operador'
    OR c.subcategory IN ('comisiones', 'comisiones_pagadas', 'Comisión Operador')
    OR c.description ILIKE '%Comisión operador%'
    OR c.description ILIKE '%Comision operador%'
  )
  ORDER BY c.date DESC, c.created_at DESC;
END;
$$;

-- PASO 2: Trigger multi-operador
CREATE OR REPLACE FUNCTION public.generate_commission_on_service_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_id uuid;
  v_record RECORD;
  v_existing_count integer;
  v_found_any boolean := false;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    
    SELECT cc_inner.id INTO v_category_id
    FROM cost_categories cc_inner
    WHERE cc_inner.name = 'Comisión Operador'
    LIMIT 1;
    
    IF v_category_id IS NULL THEN
      v_category_id := '440296d4-09c2-4f3a-b02b-835f861df4c4';
    END IF;

    FOR v_record IN
      SELECT sr.operator_id, o.name AS operator_name, sr.commission_amount
      FROM service_resources sr
      JOIN operators o ON o.id = sr.operator_id
      WHERE sr.service_id = NEW.id
        AND sr.commission_amount IS NOT NULL
        AND sr.commission_amount > 0
    LOOP
      v_found_any := true;
      
      SELECT COUNT(*) INTO v_existing_count
      FROM costs
      WHERE service_id = NEW.id
        AND operator_id = v_record.operator_id
        AND category_id = v_category_id;
      
      IF v_existing_count = 0 THEN
        INSERT INTO costs (date, description, amount, category_id, operator_id, service_id, service_folio, subcategory)
        VALUES (
          COALESCE(NEW.service_date, CURRENT_DATE),
          'Comisión operador ' || v_record.operator_name || ' - Servicio ' || COALESCE(NEW.folio, 'S/F'),
          v_record.commission_amount,
          v_category_id,
          v_record.operator_id,
          NEW.id,
          NEW.folio,
          'comisiones'
        );
      END IF;
    END LOOP;

    -- Fallback: si no hay service_resources con comisión, usar campos directos del servicio
    IF NOT v_found_any AND NEW.operator_commission IS NOT NULL AND NEW.operator_commission > 0 AND NEW.operator_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_existing_count
      FROM costs
      WHERE service_id = NEW.id
        AND operator_id = NEW.operator_id
        AND category_id = v_category_id;
      
      IF v_existing_count = 0 THEN
        INSERT INTO costs (date, description, amount, category_id, operator_id, service_id, service_folio, subcategory)
        VALUES (
          COALESCE(NEW.service_date, CURRENT_DATE),
          'Comisión operador - Servicio ' || COALESCE(NEW.folio, 'S/F'),
          NEW.operator_commission,
          v_category_id,
          NEW.operator_id,
          NEW.id,
          NEW.folio,
          'comisiones'
        );
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generate_commission_on_service_completion_trigger ON services;
CREATE TRIGGER generate_commission_on_service_completion_trigger
  AFTER UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION generate_commission_on_service_completion();

-- PASO 3: Reconciliar comisiones históricas faltantes
INSERT INTO costs (date, description, amount, category_id, operator_id, service_id, service_folio, subcategory)
SELECT
  COALESCE(s.service_date, CURRENT_DATE),
  'Comisión operador ' || o.name || ' - Servicio ' || COALESCE(s.folio, 'S/F'),
  sr.commission_amount,
  '440296d4-09c2-4f3a-b02b-835f861df4c4',
  sr.operator_id,
  s.id,
  s.folio,
  'comisiones'
FROM service_resources sr
JOIN services s ON s.id = sr.service_id
JOIN operators o ON o.id = sr.operator_id
WHERE sr.commission_amount IS NOT NULL
  AND sr.commission_amount > 0
  AND s.status IN ('completed', 'invoiced')
  AND NOT EXISTS (
    SELECT 1 FROM costs c
    WHERE c.service_id = s.id
      AND c.operator_id = sr.operator_id
      AND (
        c.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
        OR c.subcategory IN ('comisiones', 'comisiones_pagadas', 'Comisión Operador')
        OR c.description ILIKE '%Comisión operador%'
      )
  )
ON CONFLICT DO NOTHING;