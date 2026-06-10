-- ================================================================
-- CORRECCIÓN: Cambiar FK de inventory_movements para apuntar a suppliers
-- ================================================================

-- Eliminar la FK existente que apunta a inventory_suppliers
ALTER TABLE inventory_movements 
DROP CONSTRAINT IF EXISTS inventory_movements_supplier_id_fkey;

-- Crear nueva FK que apunte a la tabla suppliers (módulo general)
ALTER TABLE inventory_movements 
ADD CONSTRAINT inventory_movements_supplier_id_fkey 
FOREIGN KEY (supplier_id) REFERENCES suppliers(id);

-- ================================================================
-- FASE 1: Conectar Suppliers → Inventory Movements
-- ================================================================

-- Paso 1.1: Modificar trigger para usar supplier_id (FK) en lugar de supplier_name
CREATE OR REPLACE FUNCTION public.sync_inventory_cost_to_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_category_name TEXT;
  v_inventory_item_id UUID;
  v_location_id UUID;
  v_category_id UUID;
  v_quantity INT := 1;
  v_unit_cost NUMERIC;
  v_movement_id UUID;
  v_supplier_id UUID;
BEGIN
  -- Solo procesar costos con datos de compra de inventario
  IF NEW.purchase_quantity IS NULL OR NEW.purchase_unit_cost IS NULL THEN
    RETURN NEW;
  END IF;

  -- Prevenir duplicados: si ya existe inventory_movement_id, salir
  IF NEW.inventory_movement_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Obtener nombre de la categoría
  SELECT name INTO v_category_name
  FROM cost_categories
  WHERE id = NEW.category_id;

  -- Buscar item de inventario
  SELECT id INTO v_inventory_item_id
  FROM inventory_items
  WHERE LOWER(TRIM(name)) = LOWER(TRIM(NEW.description))
  LIMIT 1;

  -- Si no existe, crear el item
  IF v_inventory_item_id IS NULL THEN
    SELECT id INTO v_category_id
    FROM inventory_categories
    WHERE LOWER(name) LIKE '%' || LOWER(v_category_name) || '%'
    LIMIT 1;

    IF v_category_id IS NULL THEN
      SELECT id INTO v_category_id
      FROM inventory_categories
      WHERE LOWER(name) = 'general'
      LIMIT 1;
    END IF;

    INSERT INTO inventory_items (
      name,
      category_id,
      unit_of_measure,
      unit_cost,
      created_by
    )
    VALUES (
      NEW.description,
      v_category_id,
      'unidad',
      NEW.purchase_unit_cost,
      NEW.created_by
    )
    RETURNING id INTO v_inventory_item_id;
  END IF;

  -- Obtener ubicación por defecto
  SELECT id INTO v_location_id
  FROM inventory_locations
  WHERE code = 'MAIN'
  LIMIT 1;

  IF v_location_id IS NULL THEN
    SELECT id INTO v_location_id
    FROM inventory_locations
    ORDER BY created_at
    LIMIT 1;
  END IF;

  v_quantity := NEW.purchase_quantity;
  v_unit_cost := NEW.purchase_unit_cost;

  -- ⭐ EXTRAER supplier_id desde supplier_payments si existe
  IF NEW.supplier_payment_id IS NOT NULL THEN
    SELECT supplier_id INTO v_supplier_id 
    FROM supplier_payments 
    WHERE id = NEW.supplier_payment_id;
  END IF;

  -- Crear movimiento de ENTRADA con supplier_id (FK formal)
  INSERT INTO inventory_movements (
    item_id,
    location_id,
    movement_type,
    quantity,
    unit_cost,
    total_cost,
    movement_date,
    reason,
    crane_id,
    cost_id,
    supplier_id,
    observations,
    created_by,
    status
  )
  VALUES (
    v_inventory_item_id,
    v_location_id,
    'entry',
    v_quantity,
    v_unit_cost,
    NEW.amount,
    NEW.date,
    'Compra desde módulo de costos',
    NEW.crane_id,
    NEW.id,
    v_supplier_id,
    COALESCE(NEW.notes, 'Sincronización automática'),
    NEW.created_by,
    'active'
  )
  RETURNING id INTO v_movement_id;

  -- Actualizar el cost con el movement_id
  UPDATE costs
  SET inventory_movement_id = v_movement_id
  WHERE id = NEW.id;

  -- Si es consumo inmediato, crear salida automática
  IF NEW.immediate_consumption = true THEN
    INSERT INTO inventory_movements (
      item_id,
      location_id,
      movement_type,
      quantity,
      unit_cost,
      total_cost,
      movement_date,
      reason,
      crane_id,
      cost_id,
      supplier_id,
      observations,
      created_by,
      status
    )
    VALUES (
      v_inventory_item_id,
      v_location_id,
      'exit',
      v_quantity,
      v_unit_cost,
      NEW.amount,
      NEW.date,
      'Consumo inmediato',
      NEW.crane_id,
      NEW.id,
      v_supplier_id,
      'Salida automática por consumo inmediato',
      NEW.created_by,
      'active'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Paso 1.2: Script de corrección retroactiva
-- Vincular movimientos existentes con proveedores registrados
UPDATE inventory_movements im
SET supplier_id = s.id
FROM costs c
JOIN supplier_payments sp ON sp.id = c.supplier_payment_id
JOIN suppliers s ON s.id = sp.supplier_id
WHERE im.cost_id = c.id
  AND im.supplier_id IS NULL
  AND c.supplier_payment_id IS NOT NULL;

-- Intentar vincular por similitud de nombre (fuzzy matching)
UPDATE inventory_movements im
SET supplier_id = s.id
FROM suppliers s
WHERE im.supplier_id IS NULL
  AND im.supplier_name IS NOT NULL
  AND s.is_active = true
  AND (
    LOWER(TRIM(im.supplier_name)) = LOWER(TRIM(s.name)) OR
    LOWER(im.supplier_name) LIKE LOWER('%' || s.name || '%') OR
    LOWER(s.name) LIKE LOWER('%' || im.supplier_name || '%')
  );

-- Paso 1.3: Deprecar supplier_name gradualmente
COMMENT ON COLUMN inventory_movements.supplier_name IS 
'DEPRECATED: Usar supplier_id (FK a suppliers). Este campo solo existe para migración de datos legacy.';

-- ================================================================
-- FASE 2: Conectar Suppliers → Crane Parts
-- ================================================================

-- Paso 2.1: Agregar columna supplier_id a crane_parts
ALTER TABLE crane_parts 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);

-- Crear índice para mejorar performance
CREATE INDEX IF NOT EXISTS idx_crane_parts_supplier_id ON crane_parts(supplier_id);

COMMENT ON COLUMN crane_parts.supplier_id IS 
'FK formal a tabla suppliers. Preferir esto sobre el campo "supplier" (texto libre).';

-- Migrar datos: intentar encontrar proveedores existentes por nombre
UPDATE crane_parts cp
SET supplier_id = s.id
FROM suppliers s
WHERE cp.supplier_id IS NULL
  AND s.is_active = true
  AND (
    LOWER(TRIM(cp.supplier)) = LOWER(TRIM(s.name)) OR
    LOWER(cp.supplier) LIKE LOWER('%' || s.name || '%') OR
    LOWER(s.name) LIKE LOWER('%' || cp.supplier || '%')
  );

-- Paso 2.2: Modificar trigger create_cost_from_supplier_payment para usar supplier_id
CREATE OR REPLACE FUNCTION public.create_cost_from_supplier_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost_id UUID;
  v_part_id UUID;
  v_notes TEXT;
  v_category_name TEXT;
  v_total_value NUMERIC;
  v_supplier_name TEXT;
  v_supplier_phone TEXT;
BEGIN
  -- Solo crear costo si el pago está marcado como 'paid'
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    
    -- Verificar si ya existe un costo para este pago
    IF EXISTS (
      SELECT 1 FROM costs WHERE supplier_payment_id = NEW.id
    ) THEN
      RETURN NEW;
    END IF;

    -- Obtener el nombre de la categoría
    SELECT name INTO v_category_name
    FROM supplier_categories
    WHERE id = NEW.category;

    -- Preparar notas
    v_notes := COALESCE(NEW.notes, '');
    IF NEW.reference_number IS NOT NULL THEN
      v_notes := v_notes || ' | Ref: ' || NEW.reference_number;
    END IF;

    -- Obtener datos del proveedor
    SELECT name, phone INTO v_supplier_name, v_supplier_phone
    FROM suppliers
    WHERE id = NEW.supplier_id;

    -- Crear el costo en la tabla costs
    INSERT INTO costs (
      date,
      description,
      amount,
      category_id,
      subcategory,
      notes,
      supplier_payment_id,
      payment_date,
      created_by
    )
    VALUES (
      NEW.due_date,
      NEW.description || COALESCE(' - ' || v_category_name, ''),
      COALESCE(NEW.paid_amount, NEW.amount),
      (SELECT id FROM cost_categories WHERE LOWER(name) LIKE '%proveedor%' OR LOWER(name) LIKE '%compra%' LIMIT 1),
      v_category_name,
      v_notes,
      NEW.id,
      NEW.paid_date,
      NEW.created_by
    )
    RETURNING id INTO v_cost_id;

    -- Si el pago incluye detalles de piezas, crear entrada en crane_parts
    IF NEW.part_name IS NOT NULL 
       AND NEW.part_quantity IS NOT NULL 
       AND NEW.part_unit_price IS NOT NULL 
       AND NEW.crane_id IS NOT NULL THEN
      
      v_total_value := NEW.part_quantity * NEW.part_unit_price;
      
      INSERT INTO crane_parts (
        crane_id,
        part_name,
        supplier,
        supplier_id,
        phone,
        quantity,
        unit_price,
        total_value,
        date,
        notes,
        cost_id,
        created_by
      )
      VALUES (
        NEW.crane_id,
        NEW.part_name,
        v_supplier_name,
        NEW.supplier_id,
        v_supplier_phone,
        NEW.part_quantity,
        NEW.part_unit_price,
        v_total_value,
        NEW.due_date,
        v_notes,
        v_cost_id,
        NEW.created_by
      )
      RETURNING id INTO v_part_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- ================================================================
-- FASE 3: Herramientas de Validación y Limpieza
-- ================================================================

-- Función para identificar proveedores duplicados
CREATE OR REPLACE FUNCTION public.find_duplicate_suppliers()
RETURNS TABLE (
  proveedor_1 TEXT,
  proveedor_2 TEXT,
  id_1 UUID,
  id_2 UUID,
  rut_1 TEXT,
  rut_2 TEXT,
  similitud FLOAT
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para fusionar proveedores duplicados
CREATE OR REPLACE FUNCTION public.merge_suppliers(
  p_keep_id UUID,
  p_remove_id UUID
)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener estadísticas de trazabilidad por proveedor
CREATE OR REPLACE FUNCTION public.get_supplier_traceability_stats(p_supplier_id UUID)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear índices adicionales para mejorar performance de queries de trazabilidad
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier_id ON supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_supplier_id ON inventory_movements(supplier_id);
CREATE INDEX IF NOT EXISTS idx_costs_supplier_payment_id ON costs(supplier_payment_id);

-- Comentarios para documentación
COMMENT ON FUNCTION find_duplicate_suppliers() IS 
'Identifica proveedores con nombres similares que podrían ser duplicados (similitud > 70%)';

COMMENT ON FUNCTION merge_suppliers(UUID, UUID) IS 
'Fusiona dos proveedores: reasigna todas las referencias del segundo al primero y lo desactiva';

COMMENT ON FUNCTION get_supplier_traceability_stats(UUID) IS 
'Obtiene estadísticas completas de trazabilidad para un proveedor: pagos, costos, inventario y piezas';