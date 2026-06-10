-- =====================================================
-- SOLUCIÓN DEFINITIVA: Corrección Completa del Trigger
-- create_cost_from_supplier_payment
-- =====================================================
-- Este trigger crea automáticamente:
-- 1. Registro en costs (CON crane_id)
-- 2. Registro en inventory_movements (si add_to_inventory = true)
-- 3. Registro en crane_parts (si crane_id está presente)
-- =====================================================

-- Eliminar función existente
DROP FUNCTION IF EXISTS public.create_cost_from_supplier_payment() CASCADE;

-- Crear función corregida
CREATE OR REPLACE FUNCTION public.create_cost_from_supplier_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost_category_id UUID;
  v_new_cost_id UUID;
  v_inventory_item_id UUID;
  v_inventory_movement_id UUID;
  v_unit_cost DECIMAL(12,2);
  v_existing_cost_count INTEGER;
BEGIN
  -- Solo ejecutar cuando el pago se marca como "paid"
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    
    RAISE NOTICE '🔔 [Trigger] Pago marcado como pagado: %', NEW.id;
    
    -- Verificar si ya existe un costo para este supplier_payment_id
    SELECT COUNT(*) INTO v_existing_cost_count
    FROM public.costs
    WHERE supplier_payment_id = NEW.id;
    
    IF v_existing_cost_count > 0 THEN
      RAISE NOTICE '⚠️ [Trigger] Ya existe un costo para este pago. Saltando creación.';
      RETURN NEW;
    END IF;

    -- =====================================================
    -- PASO 1: Obtener category_id desde category (TEXT o UUID)
    -- =====================================================
    BEGIN
      -- Intentar convertir directamente si es UUID
      v_cost_category_id := NEW.category::UUID;
      RAISE NOTICE '✅ [Category] UUID directo: %', v_cost_category_id;
    EXCEPTION
      WHEN invalid_text_representation THEN
        -- Si falla, buscar por nombre en cost_categories
        SELECT id INTO v_cost_category_id
        FROM public.cost_categories
        WHERE name ILIKE NEW.category
        LIMIT 1;
        
        IF v_cost_category_id IS NULL THEN
          RAISE NOTICE '⚠️ [Category] No encontrada: %. Usando categoría por defecto.', NEW.category;
          SELECT id INTO v_cost_category_id
          FROM public.cost_categories
          WHERE name ILIKE '%mantenim%' OR name ILIKE '%manten%'
          LIMIT 1;
        ELSE
          RAISE NOTICE '✅ [Category] Encontrada por nombre: %', NEW.category;
        END IF;
    END;

    -- =====================================================
    -- PASO 2: Crear registro en COSTS (CON crane_id)
    -- =====================================================
    INSERT INTO public.costs (
      description,
      amount,
      date,
      category_id,
      crane_id,              -- ✅ AGREGADO
      supplier_payment_id,
      supplier_id,
      notes,
      created_by
    )
    VALUES (
      NEW.description,
      NEW.amount,
      COALESCE(NEW.paid_date, NEW.due_date, CURRENT_DATE),
      v_cost_category_id,
      NEW.crane_id,          -- ✅ AGREGADO
      NEW.id,
      NEW.supplier_id,
      COALESCE(NEW.notes, 'Generado automáticamente desde pago a proveedor'),
      NEW.created_by
    )
    RETURNING id INTO v_new_cost_id;

    RAISE NOTICE '✅ [Costs] Costo creado: % con crane_id: %', v_new_cost_id, NEW.crane_id;

    -- =====================================================
    -- PASO 3: Crear registro en INVENTORY_MOVEMENTS
    -- (si add_to_inventory = true)
    -- =====================================================
    IF NEW.add_to_inventory = true AND NEW.part_name IS NOT NULL AND NEW.part_quantity > 0 THEN
      
      RAISE NOTICE '📦 [Inventory] Iniciando creación de inventario para: %', NEW.part_name;
      
      -- Calcular costo unitario (mejorado para manejar part_unit_price = 0)
      v_unit_cost := CASE 
        WHEN NEW.part_unit_price > 0 THEN NEW.part_unit_price 
        ELSE NEW.amount / NULLIF(NEW.part_quantity, 0)
      END;
      
      RAISE NOTICE '💰 [Inventory] Costo unitario calculado: %', v_unit_cost;

      -- Buscar o crear item en inventory_items
      SELECT id INTO v_inventory_item_id
      FROM public.inventory_items
      WHERE LOWER(name) = LOWER(NEW.part_name)
      LIMIT 1;

      IF v_inventory_item_id IS NULL THEN
        INSERT INTO public.inventory_items (
          name,
          description,
          category,
          min_stock,
          unit,
          created_by
        )
        VALUES (
          NEW.part_name,
          'Creado automáticamente desde pago a proveedor',
          'Repuestos',
          1,
          'unidad',
          NEW.created_by
        )
        RETURNING id INTO v_inventory_item_id;
        
        RAISE NOTICE '✅ [Inventory Items] Item creado: %', v_inventory_item_id;
      ELSE
        RAISE NOTICE '✅ [Inventory Items] Item existente: %', v_inventory_item_id;
      END IF;

      -- Crear movimiento de inventario
      INSERT INTO public.inventory_movements (
        item_id,
        movement_type,
        quantity,
        unit_cost,
        notes,
        crane_id,
        cost_id,
        created_by
      )
      VALUES (
        v_inventory_item_id,
        'entry',
        NEW.part_quantity,
        v_unit_cost,
        'Entrada desde pago a proveedor: ' || NEW.description,
        NEW.crane_id,
        v_new_cost_id,
        NEW.created_by
      )
      RETURNING id INTO v_inventory_movement_id;

      RAISE NOTICE '✅ [Inventory Movements] Movimiento creado: %', v_inventory_movement_id;

      -- Actualizar el cost con el inventory_movement_id
      UPDATE public.costs
      SET inventory_movement_id = v_inventory_movement_id
      WHERE id = v_new_cost_id;

      RAISE NOTICE '✅ [Costs] Actualizado con inventory_movement_id: %', v_inventory_movement_id;

    END IF;

    -- =====================================================
    -- PASO 4: Crear registro en CRANE_PARTS
    -- (si crane_id está presente y hay información de parte)
    -- =====================================================
    IF NEW.crane_id IS NOT NULL AND NEW.part_name IS NOT NULL AND NEW.part_quantity > 0 THEN
      
      RAISE NOTICE '🏗️ [Crane Parts] Iniciando creación para grúa: %', NEW.crane_id;
      
      -- Usar el costo unitario calculado previamente o calcularlo ahora
      IF v_unit_cost IS NULL THEN
        v_unit_cost := CASE 
          WHEN NEW.part_unit_price > 0 THEN NEW.part_unit_price 
          ELSE NEW.amount / NULLIF(NEW.part_quantity, 0)
        END;
      END IF;

      INSERT INTO public.crane_parts (
        crane_id,
        part_name,
        quantity,
        unit_price,
        total_value,
        supplier,
        cost_id,
        notes,
        created_by
      )
      VALUES (
        NEW.crane_id,
        NEW.part_name,
        NEW.part_quantity,
        v_unit_cost,
        NEW.amount,
        (SELECT name FROM public.suppliers WHERE id = NEW.supplier_id),
        v_new_cost_id,
        'Creado automáticamente desde pago a proveedor',
        NEW.created_by
      );

      RAISE NOTICE '✅ [Crane Parts] Registro creado para grúa % con parte %', NEW.crane_id, NEW.part_name;

    END IF;

    RAISE NOTICE '✅ [Trigger] Proceso completado exitosamente';

  END IF;

  RETURN NEW;
END;
$$;

-- Recrear trigger
DROP TRIGGER IF EXISTS create_cost_on_payment_paid ON public.supplier_payments;

CREATE TRIGGER create_cost_on_payment_paid
  AFTER INSERT OR UPDATE ON public.supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_cost_from_supplier_payment();

-- Comentario
COMMENT ON FUNCTION public.create_cost_from_supplier_payment() IS 
'Trigger que crea automáticamente registros en costs, inventory_movements y crane_parts cuando un pago a proveedor se marca como pagado. 
CORREGIDO: Incluye crane_id en costs, mejora cálculo de costo unitario, y crea registros en crane_parts.';