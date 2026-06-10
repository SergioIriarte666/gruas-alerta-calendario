-- Corregir search_path de las 3 funciones nuevas para seguridad

CREATE OR REPLACE FUNCTION public.find_duplicate_suppliers()
RETURNS TABLE (
  proveedor_1 TEXT,
  proveedor_2 TEXT,
  id_1 UUID,
  id_2 UUID,
  rut_1 TEXT,
  rut_2 TEXT,
  similitud FLOAT
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s1.name as proveedor_1,
    s2.name as proveedor_2,
    s1.id as id_1,
    s2.id as id_2,
    s1.rut as rut_1,
    s2.rut as rut_2,
    SIMILARITY(s1.name, s2.name) as similitud
  FROM suppliers s1
  CROSS JOIN suppliers s2
  WHERE s1.id < s2.id
    AND s1.is_active = true
    AND s2.is_active = true
    AND SIMILARITY(s1.name, s2.name) > 0.7
  ORDER BY SIMILARITY(s1.name, s2.name) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.merge_suppliers(
  p_keep_id UUID,
  p_remove_id UUID
)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_payments_count INT;
  v_movements_count INT;
  v_parts_count INT;
BEGIN
  -- Validar que ambos proveedores existan
  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE id = p_keep_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Proveedor principal no existe'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE id = p_remove_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Proveedor a eliminar no existe'
    );
  END IF;

  -- Reasignar todas las referencias
  UPDATE supplier_payments 
  SET supplier_id = p_keep_id 
  WHERE supplier_id = p_remove_id;
  GET DIAGNOSTICS v_payments_count = ROW_COUNT;
  
  UPDATE inventory_movements 
  SET supplier_id = p_keep_id 
  WHERE supplier_id = p_remove_id;
  GET DIAGNOSTICS v_movements_count = ROW_COUNT;
  
  UPDATE crane_parts 
  SET supplier_id = p_keep_id 
  WHERE supplier_id = p_remove_id;
  GET DIAGNOSTICS v_parts_count = ROW_COUNT;
  
  -- Desactivar proveedor duplicado
  UPDATE suppliers 
  SET is_active = false,
      notes = COALESCE(notes || ' | ', '') || 'FUSIONADO CON: ' || p_keep_id::TEXT
  WHERE id = p_remove_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'kept_id', p_keep_id,
    'removed_id', p_remove_id,
    'payments_migrated', v_payments_count,
    'movements_migrated', v_movements_count,
    'parts_migrated', v_parts_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_supplier_traceability_stats(p_supplier_id UUID)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_total_payments NUMERIC;
  v_total_costs NUMERIC;
  v_total_inventory NUMERIC;
  v_total_parts NUMERIC;
  v_payments_count INT;
  v_inventory_count INT;
  v_parts_count INT;
BEGIN
  -- Pagos totales
  SELECT 
    COUNT(*),
    COALESCE(SUM(amount), 0)
  INTO v_payments_count, v_total_payments
  FROM supplier_payments
  WHERE supplier_id = p_supplier_id;

  -- Movimientos de inventario
  SELECT 
    COUNT(*),
    COALESCE(SUM(total_cost), 0)
  INTO v_inventory_count, v_total_inventory
  FROM inventory_movements
  WHERE supplier_id = p_supplier_id
    AND movement_type = 'entry';

  -- Piezas de grúas
  SELECT 
    COUNT(*),
    COALESCE(SUM(total_value), 0)
  INTO v_parts_count, v_total_parts
  FROM crane_parts
  WHERE supplier_id = p_supplier_id;

  -- Costos totales
  SELECT COALESCE(SUM(c.amount), 0)
  INTO v_total_costs
  FROM costs c
  JOIN supplier_payments sp ON sp.id = c.supplier_payment_id
  WHERE sp.supplier_id = p_supplier_id;

  RETURN jsonb_build_object(
    'supplier_id', p_supplier_id,
    'payments', jsonb_build_object(
      'count', v_payments_count,
      'total', v_total_payments
    ),
    'costs', jsonb_build_object(
      'total', v_total_costs
    ),
    'inventory', jsonb_build_object(
      'count', v_inventory_count,
      'total', v_total_inventory
    ),
    'crane_parts', jsonb_build_object(
      'count', v_parts_count,
      'total', v_total_parts
    )
  );
END;
$$;