-- ============================================================
-- CORRECCIÓN: Recrear trigger para sincronización de inventario
-- ============================================================

-- Eliminar trigger si existe (por seguridad)
DROP TRIGGER IF EXISTS sync_inventory_cost_trigger ON public.costs;

-- Recrear el trigger que sincroniza costos → inventory_movements
CREATE TRIGGER sync_inventory_cost_trigger
  AFTER INSERT ON public.costs
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_inventory_cost_to_movement();

COMMENT ON TRIGGER sync_inventory_cost_trigger ON public.costs IS
'Sincroniza automáticamente las compras de inventario desde el módulo de Costos hacia inventory_movements. 
Si immediate_consumption=true, crea entrada y salida automática.';

-- ============================================================
-- CORRECCIÓN RETROACTIVA: Procesar costos huérfanos
-- ============================================================

-- Identificar costos de inventario sin movimientos asociados
DO $$
DECLARE
  v_cost RECORD;
  v_category_name TEXT;
  v_inventory_item_id UUID;
  v_location_id UUID;
  v_category_id UUID;
  v_quantity INT;
  v_unit_cost NUMERIC;
  v_movement_id UUID;
  v_supplier_id UUID;
  v_fixed_count INT := 0;
BEGIN
  RAISE NOTICE '🔧 Iniciando corrección de costos de inventario sin movimientos...';
  
  FOR v_cost IN
    SELECT 
      c.id,
      c.description,
      c.amount,
      c.purchase_quantity,
      c.purchase_unit_cost,
      c.immediate_consumption,
      c.crane_id,
      c.date,
      c.notes,
      c.created_by,
      c.supplier_payment_id,
      c.category_id
    FROM costs c
    INNER JOIN cost_categories cc ON cc.id = c.category_id
    WHERE cc.name ILIKE '%inventario%'
      AND c.inventory_movement_id IS NULL
      AND c.purchase_quantity IS NOT NULL
      AND c.purchase_unit_cost IS NOT NULL
      AND c.purchase_quantity > 0
      AND c.purchase_unit_cost > 0
    ORDER BY c.created_at ASC
  LOOP
    BEGIN
      v_quantity := v_cost.purchase_quantity;
      v_unit_cost := v_cost.purchase_unit_cost;
      
      -- Buscar o crear item de inventario
      SELECT id INTO v_inventory_item_id
      FROM inventory_items
      WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_cost.description))
      LIMIT 1;
      
      IF v_inventory_item_id IS NULL THEN
        SELECT id INTO v_category_id
        FROM inventory_categories
        WHERE LOWER(name) LIKE '%general%'
        LIMIT 1;
        
        INSERT INTO inventory_items (
          name,
          category_id,
          unit_of_measure,
          unit_cost,
          is_active,
          created_by
        )
        VALUES (
          v_cost.description,
          v_category_id,
          'unidad',
          v_unit_cost,
          true,
          v_cost.created_by
        )
        RETURNING id INTO v_inventory_item_id;
      END IF;
      
      -- Obtener ubicación principal
      SELECT id INTO v_location_id
      FROM inventory_locations
      WHERE code = 'MAIN'
      LIMIT 1;
      
      IF v_location_id IS NULL THEN
        SELECT id INTO v_location_id
        FROM inventory_locations
        WHERE is_active = true
        ORDER BY created_at ASC
        LIMIT 1;
      END IF;
      
      -- Extraer supplier_id si viene de pago a proveedor
      IF v_cost.supplier_payment_id IS NOT NULL THEN
        SELECT supplier_id INTO v_supplier_id
        FROM supplier_payments
        WHERE id = v_cost.supplier_payment_id;
      END IF;
      
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
        v_quantity,
        v_unit_cost,
        v_cost.amount,
        v_cost.date,
        'Corrección retroactiva - Compra desde módulo de costos',
        v_cost.crane_id,
        v_cost.id,
        v_supplier_id,
        COALESCE(v_cost.notes, 'Sincronización automática'),
        v_cost.created_by,
        'active'
      )
      RETURNING id INTO v_movement_id;
      
      -- Actualizar el cost con el movement_id
      UPDATE costs
      SET inventory_movement_id = v_movement_id
      WHERE id = v_cost.id;
      
      -- Si es consumo inmediato, crear SALIDA
      IF v_cost.immediate_consumption = true AND v_cost.crane_id IS NOT NULL THEN
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
          v_cost.amount,
          v_cost.date,
          'Consumo inmediato - Corrección retroactiva',
          v_cost.crane_id,
          v_cost.id,
          v_supplier_id,
          'Salida automática por consumo inmediato',
          v_cost.created_by,
          'active'
        );
      END IF;
      
      v_fixed_count := v_fixed_count + 1;
      RAISE NOTICE '✅ Costo corregido: % (ID: %)', v_cost.description, v_cost.id;
      
    EXCEPTION 
      WHEN OTHERS THEN
        RAISE WARNING '❌ Error procesando costo % (ID: %): %', v_cost.description, v_cost.id, SQLERRM;
        CONTINUE;
    END;
  END LOOP;
  
  RAISE NOTICE '🎉 Corrección completada: % costo(s) procesado(s)', v_fixed_count;
END $$;