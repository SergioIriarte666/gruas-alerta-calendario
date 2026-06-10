
-- =====================================================
-- CORRECCIÓN DEFINITIVA: Sistema de Exclusión de Comisiones
-- =====================================================

-- Paso 1: Eliminar la comisión fantasma de SRV-3791
DELETE FROM costs 
WHERE id = '76a6955f-7fcb-4c22-8d9a-cdf4893e85a4';

-- Paso 2: Actualizar el trigger principal con validación de exclusión
CREATE OR REPLACE FUNCTION generate_commission_on_service_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_operator_id UUID;
  v_operator_name TEXT;
  v_commission_amount NUMERIC;
  v_category_id UUID := '440296d4-09c2-4f3a-b02b-835f861df4c4';
  v_existing_commission_id UUID;
  v_is_status_change BOOLEAN := FALSE;
  v_is_commission_update BOOLEAN := FALSE;
  v_excluded_operators TEXT[] := ARRAY['Jorge Iriarte', 'Sergio Iriarte', 'Jorge Ignacio Iriarte'];
BEGIN
  v_is_status_change := (
    NEW.status IN ('completed', 'invoiced', 'with_purchase_order') 
    AND (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'invoiced', 'with_purchase_order'))
  );
  
  v_is_commission_update := (
    NEW.status IN ('completed', 'invoiced', 'with_purchase_order')
    AND NEW.operator_commission > 0
    AND NEW.operator_commission != COALESCE(OLD.operator_commission, 0)
  );
  
  IF NOT v_is_status_change AND NOT v_is_commission_update THEN
    RETURN NEW;
  END IF;

  SELECT sr.operator_id, o.name, sr.commission_amount
  INTO v_operator_id, v_operator_name, v_commission_amount
  FROM service_resources sr
  JOIN operators o ON o.id = sr.operator_id
  WHERE sr.service_id = NEW.id
    AND sr.role = 'Principal'
  LIMIT 1;

  IF v_operator_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- VALIDACIÓN DE EXCLUSIÓN
  IF v_operator_name = ANY(v_excluded_operators) THEN
    RETURN NEW;
  END IF;

  IF v_commission_amount IS NULL OR v_commission_amount = 0 THEN
    v_commission_amount := NEW.operator_commission;
  END IF;

  IF v_commission_amount IS NULL OR v_commission_amount = 0 THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing_commission_id
  FROM costs
  WHERE service_id = NEW.id
    AND operator_id = v_operator_id
    AND category_id = v_category_id
  LIMIT 1;

  IF v_is_commission_update AND v_existing_commission_id IS NOT NULL THEN
    UPDATE costs
    SET amount = v_commission_amount,
        subcategory = 'Comisión Operador',
        updated_at = NOW()
    WHERE id = v_existing_commission_id;
    RETURN NEW;
  END IF;

  IF v_existing_commission_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO costs (
    date, description, amount, category_id, operator_id, service_id, service_folio, subcategory
  ) VALUES (
    NEW.service_date,
    'Comisión operador: ' || v_operator_name || ' - Servicio ' || NEW.folio,
    v_commission_amount, v_category_id, v_operator_id, NEW.id, NEW.folio, 'Comisión Operador'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Paso 3: Eliminar función existente y recrear con exclusión
DROP FUNCTION IF EXISTS force_commission_sync_for_service(UUID);

CREATE FUNCTION force_commission_sync_for_service(p_service_id UUID)
RETURNS JSON AS $$
DECLARE
  v_service RECORD;
  v_category_id UUID := '440296d4-09c2-4f3a-b02b-835f861df4c4';
  v_created_count INT := 0;
  v_resource_record RECORD;
BEGIN
  SELECT id, folio, service_date, crane_id, operator_commission
  INTO v_service
  FROM services
  WHERE id = p_service_id;

  IF v_service.id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Servicio no encontrado');
  END IF;

  IF v_service.operator_commission IS NULL OR v_service.operator_commission <= 0 THEN
    RETURN json_build_object('success', true, 'message', 'El servicio no tiene comisión configurada', 'created', 0);
  END IF;

  DELETE FROM costs
  WHERE service_id = p_service_id
    AND category_id = v_category_id;

  -- Crear comisiones solo para operadores NO excluidos
  FOR v_resource_record IN
    SELECT sr.operator_id, sr.commission_amount, o.name
    FROM service_resources sr
    JOIN operators o ON sr.operator_id = o.id
    WHERE sr.service_id = p_service_id 
      AND sr.resource_type = 'operator'
      AND sr.commission_amount > 0
      AND o.name NOT IN ('Jorge Iriarte', 'Sergio Iriarte', 'Jorge Ignacio Iriarte')
  LOOP
    INSERT INTO costs (
      date, description, amount, category_id, operator_id, service_id, service_folio, subcategory, crane_id
    ) VALUES (
      v_service.service_date,
      'Comisión operador: ' || v_resource_record.name || ' - Servicio ' || v_service.folio,
      v_resource_record.commission_amount, v_category_id, v_resource_record.operator_id,
      p_service_id, v_service.folio, 'Comisión Operador', v_service.crane_id
    );
    v_created_count := v_created_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'message', 'Sincronización completada', 'created', v_created_count, 'folio', v_service.folio);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Paso 4: Trigger de protección
CREATE OR REPLACE FUNCTION check_operator_not_excluded()
RETURNS TRIGGER AS $$
DECLARE
  v_operator_name TEXT;
  v_excluded_operators TEXT[] := ARRAY['Jorge Iriarte', 'Sergio Iriarte', 'Jorge Ignacio Iriarte'];
BEGIN
  IF NEW.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4' AND NEW.operator_id IS NOT NULL THEN
    SELECT name INTO v_operator_name FROM operators WHERE id = NEW.operator_id;
    IF v_operator_name = ANY(v_excluded_operators) THEN
      RAISE EXCEPTION 'No se pueden crear comisiones para operadores excluidos: %', v_operator_name;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_excluded_operator_commissions ON costs;
CREATE TRIGGER prevent_excluded_operator_commissions
BEFORE INSERT ON costs FOR EACH ROW EXECUTE FUNCTION check_operator_not_excluded();

-- Paso 5: Limpiar comisiones fantasma de operadores excluidos
DELETE FROM costs 
WHERE category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
  AND operator_id IN (
    SELECT id FROM operators WHERE name IN ('Jorge Iriarte', 'Sergio Iriarte', 'Jorge Ignacio Iriarte')
  );
