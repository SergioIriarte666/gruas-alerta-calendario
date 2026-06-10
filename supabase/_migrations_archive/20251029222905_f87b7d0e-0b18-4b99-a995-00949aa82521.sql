-- ========================================
-- FASE 0: Habilitar extensiones necesarias
-- ========================================

-- Habilitar extensión pg_trgm para comparaciones de similitud
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ========================================
-- FASE 1: Establecer Relaciones Formales
-- ========================================

-- 1.1 Agregar columna supplier_id a costs
ALTER TABLE public.costs 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id);

-- Crear índice para rendimiento
CREATE INDEX IF NOT EXISTS idx_costs_supplier_id ON public.costs(supplier_id);

-- Comentario de documentación
COMMENT ON COLUMN public.costs.supplier_id IS 
'FK formal hacia suppliers. Reemplaza el uso de texto libre en notes/description para identificar proveedores.';

-- 1.2 Verificar índice en inventory_movements.supplier_id
CREATE INDEX IF NOT EXISTS idx_inventory_movements_supplier_id 
ON public.inventory_movements(supplier_id);

-- ========================================
-- FASE 2: Triggers Bidireccionales Inteligentes
-- ========================================

-- 2.1 Mejorar trigger: Suppliers → Costs + Inventory
CREATE OR REPLACE FUNCTION public.create_cost_from_supplier_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_cost_category_id UUID;
  v_new_cost_id UUID;
  v_inventory_item_id UUID;
  v_location_id UUID;
  v_category_uuid UUID;
BEGIN
  -- Solo procesar pagos completados
  IF NEW.status != 'paid' THEN
    RETURN NEW;
  END IF;

  -- Verificar si ya existe un costo para este pago
  IF EXISTS (SELECT 1 FROM costs WHERE supplier_payment_id = NEW.id) THEN
    RAISE NOTICE '⚠️ Ya existe un costo para el pago %', NEW.id;
    RETURN NEW;
  END IF;

  -- Intentar convertir category (TEXT) a UUID
  BEGIN
    v_category_uuid := NEW.category::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_category_uuid := NULL;
  END;

  -- Obtener categoría apropiada
  IF v_category_uuid IS NOT NULL THEN
    SELECT id INTO v_cost_category_id
    FROM cost_categories
    WHERE id = v_category_uuid
    LIMIT 1;
  ELSE
    SELECT id INTO v_cost_category_id
    FROM cost_categories
    WHERE name ILIKE '%proveedor%' OR name ILIKE '%mantenimiento%'
    LIMIT 1;
  END IF;

  -- Crear el costo
  INSERT INTO costs (
    description,
    amount,
    date,
    category_id,
    supplier_payment_id,
    supplier_id,
    notes,
    created_by
  )
  VALUES (
    NEW.description,
    NEW.amount,
    NEW.due_date,
    v_cost_category_id,
    NEW.id,
    NEW.supplier_id,
    COALESCE(NEW.notes, 'Generado automáticamente desde pago a proveedor'),
    NEW.created_by
  )
  RETURNING id INTO v_new_cost_id;

  -- ========== NUEVO: Crear movimiento de inventario si tiene datos de producto ==========
  IF NEW.part_name IS NOT NULL AND NEW.part_quantity > 0 AND NEW.part_unit_price > 0 THEN
    
    -- Buscar o crear item de inventario
    SELECT id INTO v_inventory_item_id
    FROM inventory_items
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(NEW.part_name))
    LIMIT 1;

    IF v_inventory_item_id IS NULL THEN
      INSERT INTO inventory_items (name, unit_of_measure, unit_cost, created_by)
      VALUES (NEW.part_name, 'unidad', NEW.part_unit_price, NEW.created_by)
      RETURNING id INTO v_inventory_item_id;
    END IF;

    -- Obtener ubicación principal
    SELECT id INTO v_location_id
    FROM inventory_locations
    WHERE code = 'MAIN' OR is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_location_id IS NOT NULL THEN
      -- Crear movimiento de ENTRADA
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
        NEW.part_quantity,
        NEW.part_unit_price,
        NEW.amount,
        NEW.due_date,
        'Compra desde pago a proveedor',
        NEW.crane_id,
        v_new_cost_id,
        NEW.supplier_id,
        'Sincronización automática: Suppliers → Costs → Inventory',
        NEW.created_by,
        'active'
      );

      RAISE NOTICE '✅ [Supplier→Cost→Inventory] Sincronización triple completada para %', NEW.description;
    ELSE
      RAISE NOTICE '✅ [Supplier→Cost] Sincronización parcial (sin ubicación de inventario)';
    END IF;
  ELSE
    RAISE NOTICE '✅ [Supplier→Cost] Sincronización parcial (sin datos de inventario)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear trigger
DROP TRIGGER IF EXISTS create_cost_from_supplier_payment_trigger ON public.supplier_payments;
CREATE TRIGGER create_cost_from_supplier_payment_trigger
  AFTER INSERT OR UPDATE ON public.supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_cost_from_supplier_payment();

-- 2.2 Actualizar trigger: Costs → Inventory (mejorar existente)
CREATE OR REPLACE FUNCTION public.sync_inventory_cost_to_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_item_id UUID;
  v_location_id UUID;
  v_cost_category_name TEXT;
  v_item_name TEXT;
  v_movement_id UUID;
BEGIN
  -- Obtener nombre de categoría
  SELECT name INTO v_cost_category_name
  FROM cost_categories
  WHERE id = NEW.category_id;

  -- Solo sincronizar si es categoría de inventario o piezas y tiene datos necesarios
  IF (v_cost_category_name ILIKE '%inventario%' OR v_cost_category_name ILIKE '%pieza%' OR v_cost_category_name ILIKE '%repuesto%')
     AND NEW.purchase_quantity IS NOT NULL 
     AND NEW.purchase_unit_cost IS NOT NULL
     AND NEW.immediate_consumption = false
     AND NEW.inventory_movement_id IS NULL THEN

    -- Intentar encontrar item existente por descripción
    SELECT id INTO v_item_id
    FROM inventory_items
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(NEW.description))
    LIMIT 1;

    -- Si no existe, crear el item
    IF v_item_id IS NULL THEN
      INSERT INTO inventory_items (
        name,
        unit_of_measure,
        unit_cost,
        created_by
      )
      VALUES (
        NEW.description,
        'unidad',
        NEW.purchase_unit_cost,
        NEW.created_by
      )
      RETURNING id INTO v_item_id;
    END IF;

    -- Obtener ubicación principal
    SELECT id INTO v_location_id
    FROM inventory_locations
    WHERE code = 'MAIN' OR is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_location_id IS NOT NULL THEN
      -- Crear movimiento de inventario
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
        v_item_id,
        v_location_id,
        'entry',
        NEW.purchase_quantity,
        NEW.purchase_unit_cost,
        NEW.amount,
        NEW.date,
        'Compra desde costo',
        NEW.crane_id,
        NEW.id,
        NEW.supplier_id,
        COALESCE(NEW.notes, 'Sincronización automática: Costs → Inventory'),
        NEW.created_by,
        'active'
      )
      RETURNING id INTO v_movement_id;

      -- Actualizar el costo con el ID del movimiento
      UPDATE costs
      SET inventory_movement_id = v_movement_id
      WHERE id = NEW.id;

      RAISE NOTICE '✅ [Cost→Inventory] Sincronización completada para costo %', NEW.description;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear trigger
DROP TRIGGER IF EXISTS sync_inventory_cost_trigger ON public.costs;
CREATE TRIGGER sync_inventory_cost_trigger
  AFTER INSERT ON public.costs
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_inventory_cost_to_movement();

-- 2.3 NUEVO Trigger: Inventory → Suppliers + Costs
CREATE OR REPLACE FUNCTION public.sync_inventory_to_supplier_and_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_cost_category_id UUID;
  v_new_cost_id UUID;
  v_item_name TEXT;
BEGIN
  -- Solo para movimientos de ENTRADA con costo unitario
  IF NEW.movement_type != 'entry' OR NEW.unit_cost IS NULL OR NEW.unit_cost <= 0 THEN
    RETURN NEW;
  END IF;

  -- Si ya tiene cost_id asociado, no duplicar
  IF NEW.cost_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Si tiene supplier_id pero no cost_id, crear el costo
  IF NEW.supplier_id IS NOT NULL THEN
    
    -- Obtener categoría "Inventario"
    SELECT id INTO v_cost_category_id
    FROM cost_categories
    WHERE name ILIKE '%inventario%'
    LIMIT 1;

    -- Si no existe, crear la categoría
    IF v_cost_category_id IS NULL THEN
      INSERT INTO cost_categories (name, description)
      VALUES ('Inventario', 'Compras de inventario generadas automáticamente')
      RETURNING id INTO v_cost_category_id;
    END IF;

    -- Obtener nombre del producto
    SELECT name INTO v_item_name
    FROM inventory_items
    WHERE id = NEW.item_id;

    -- Crear el costo
    INSERT INTO costs (
      description,
      amount,
      date,
      category_id,
      supplier_id,
      inventory_movement_id,
      purchase_quantity,
      purchase_unit_cost,
      crane_id,
      notes,
      created_by
    )
    VALUES (
      COALESCE(v_item_name, 'Compra de inventario'),
      COALESCE(NEW.total_cost, NEW.unit_cost * NEW.quantity),
      NEW.movement_date::date,
      v_cost_category_id,
      NEW.supplier_id,
      NEW.id,
      NEW.quantity,
      NEW.unit_cost,
      NEW.crane_id,
      'Generado automáticamente desde movimiento de inventario',
      NEW.created_by
    )
    RETURNING id INTO v_new_cost_id;

    -- Actualizar el movimiento con el cost_id (evita loop)
    UPDATE inventory_movements
    SET cost_id = v_new_cost_id
    WHERE id = NEW.id;

    RAISE NOTICE '✅ [Inventory→Cost] Costo creado automáticamente para movimiento %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger
DROP TRIGGER IF EXISTS sync_inventory_to_cost_trigger ON public.inventory_movements;
CREATE TRIGGER sync_inventory_to_cost_trigger
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_inventory_to_supplier_and_cost();

-- ========================================
-- FASE 4: Migración de Datos Legacy
-- ========================================

-- 4.1 Migrar proveedores de texto libre a FK formal en inventory_movements
DO $$
DECLARE
  v_record RECORD;
  v_supplier_id UUID;
  v_migrated_count INT := 0;
BEGIN
  RAISE NOTICE '🔄 Iniciando migración de proveedores en inventory_movements...';
  
  -- Migrar inventory_movements con supplier_name pero sin supplier_id
  FOR v_record IN
    SELECT id, supplier_name
    FROM inventory_movements
    WHERE supplier_name IS NOT NULL
      AND supplier_name != ''
      AND supplier_id IS NULL
  LOOP
    -- Buscar proveedor similar usando similarity()
    SELECT id INTO v_supplier_id
    FROM suppliers
    WHERE similarity(LOWER(name), LOWER(v_record.supplier_name)) > 0.6
    ORDER BY similarity(LOWER(name), LOWER(v_record.supplier_name)) DESC
    LIMIT 1;
    
    IF v_supplier_id IS NOT NULL THEN
      UPDATE inventory_movements
      SET supplier_id = v_supplier_id
      WHERE id = v_record.id;
      
      v_migrated_count := v_migrated_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ Migración de inventory_movements completada: % movimientos actualizados', v_migrated_count;
END $$;

-- 4.2 Crear función para vista de sincronización
CREATE OR REPLACE FUNCTION public.get_supplier_sync_stats()
RETURNS TABLE (
  supplier_name TEXT,
  total_payments BIGINT,
  total_costs BIGINT,
  total_movements BIGINT,
  total_amount_paid NUMERIC,
  total_amount_costs NUMERIC,
  total_amount_inventory NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.name as supplier_name,
    COUNT(DISTINCT sp.id) as total_payments,
    COUNT(DISTINCT c.id) as total_costs,
    COUNT(DISTINCT im.id) as total_movements,
    COALESCE(SUM(sp.amount), 0) as total_amount_paid,
    COALESCE(SUM(c.amount), 0) as total_amount_costs,
    COALESCE(SUM(im.total_cost), 0) as total_amount_inventory
  FROM suppliers s
  LEFT JOIN supplier_payments sp ON sp.supplier_id = s.id
  LEFT JOIN costs c ON c.supplier_id = s.id
  LEFT JOIN inventory_movements im ON im.supplier_id = s.id
  WHERE s.is_active = true
  GROUP BY s.id, s.name
  ORDER BY total_amount_paid DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;