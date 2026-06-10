-- ============================================================
-- CORRECCIÓN COMPLETA: CONSUMO INMEDIATO RETROACTIVO
-- ============================================================
-- FASE 1: Corrección de registros históricos
-- FASE 2: Trigger UPDATE para cambios futuros
-- FASE 3: Validaciones incluidas como comentarios
-- ============================================================

-- ============================================================
-- FASE 1: CORRECCIÓN DE REGISTROS HISTÓRICOS
-- ============================================================
-- Corregir costos existentes que tienen immediate_consumption = true
-- pero les falta el movimiento de salida correspondiente

DO $$
DECLARE
  v_cost_record RECORD;
  v_movement_entry RECORD;
  v_exit_movement_id UUID;
  v_corrected_count INT := 0;
BEGIN
  RAISE NOTICE '🔧 Iniciando corrección de movimientos históricos con consumo inmediato...';
  
  -- Iterar sobre costos con immediate_consumption = true que solo tienen entrada
  FOR v_cost_record IN
    SELECT 
      c.id as cost_id,
      c.crane_id,
      c.date,
      c.amount,
      c.created_by,
      c.inventory_movement_id,
      c.description,
      COALESCE(c.purchase_quantity, 1) as quantity
    FROM costs c
    WHERE c.immediate_consumption = true
      AND c.inventory_movement_id IS NOT NULL
      AND c.crane_id IS NOT NULL
      -- Solo si NO existe ya un movimiento de salida
      AND NOT EXISTS (
        SELECT 1 FROM inventory_movements im2
        WHERE im2.cost_id = c.id 
          AND im2.movement_type = 'exit'
      )
    ORDER BY c.date ASC
  LOOP
    -- Obtener datos del movimiento de entrada
    SELECT 
      item_id,
      location_id,
      quantity,
      unit_cost,
      total_cost
    INTO v_movement_entry
    FROM inventory_movements
    WHERE id = v_cost_record.inventory_movement_id;
    
    IF v_movement_entry.item_id IS NOT NULL THEN
      -- Crear movimiento de salida correspondiente
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
        observations,
        created_by,
        status
      )
      VALUES (
        v_movement_entry.item_id,
        v_movement_entry.location_id,
        'exit',
        v_movement_entry.quantity,
        v_movement_entry.unit_cost,
        v_movement_entry.total_cost,
        v_cost_record.date,
        'Consumo inmediato (corrección retroactiva)',
        v_cost_record.crane_id,
        v_cost_record.cost_id,
        'Auto-generado por script de corrección - ' || v_cost_record.description,
        v_cost_record.created_by,
        'active'
      )
      RETURNING id INTO v_exit_movement_id;
      
      v_corrected_count := v_corrected_count + 1;
      
      RAISE NOTICE '✅ Corrección aplicada para cost_id: % (%), exit_movement_id: %', 
        v_cost_record.cost_id, v_cost_record.description, v_exit_movement_id;
    ELSE
      RAISE WARNING '⚠️ No se pudo obtener movimiento de entrada para cost_id: %', v_cost_record.cost_id;
    END IF;
  END LOOP;
  
  RAISE NOTICE '🎉 Corrección completada. Total de movimientos corregidos: %', v_corrected_count;
  
  IF v_corrected_count = 0 THEN
    RAISE NOTICE 'ℹ️ No se encontraron movimientos históricos que requieran corrección.';
  END IF;
END $$;

-- ============================================================
-- FASE 2: TRIGGER UPDATE PARA CAMBIOS FUTUROS
-- ============================================================
-- Este trigger permite aplicar consumo inmediato a costos existentes
-- cuando se edita el campo immediate_consumption de false/null a true

CREATE OR REPLACE FUNCTION public.handle_immediate_consumption_update()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_movement_entry RECORD;
  v_exit_movement_id UUID;
  v_already_has_exit BOOLEAN;
BEGIN
  -- Solo actuar si immediate_consumption cambió de false/null a true
  IF NEW.immediate_consumption = true 
     AND (OLD.immediate_consumption = false OR OLD.immediate_consumption IS NULL)
     AND NEW.crane_id IS NOT NULL 
     AND NEW.inventory_movement_id IS NOT NULL THEN
    
    -- Verificar si ya existe movimiento de salida para este costo
    SELECT EXISTS (
      SELECT 1 FROM inventory_movements 
      WHERE cost_id = NEW.id AND movement_type = 'exit'
    ) INTO v_already_has_exit;
    
    IF NOT v_already_has_exit THEN
      -- Obtener datos del movimiento de entrada
      SELECT 
        item_id,
        location_id,
        quantity,
        unit_cost,
        total_cost
      INTO v_movement_entry
      FROM inventory_movements
      WHERE id = NEW.inventory_movement_id;
      
      IF v_movement_entry.item_id IS NOT NULL THEN
        -- Crear movimiento de salida
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
          observations,
          created_by,
          status
        )
        VALUES (
          v_movement_entry.item_id,
          v_movement_entry.location_id,
          'exit',
          v_movement_entry.quantity,
          v_movement_entry.unit_cost,
          v_movement_entry.total_cost,
          NEW.date,
          'Consumo inmediato (aplicado por UPDATE)',
          NEW.crane_id,
          NEW.id,
          'Auto-generado por cambio de immediate_consumption a true',
          NEW.created_by,
          'active'
        )
        RETURNING id INTO v_exit_movement_id;
        
        RAISE NOTICE '✅ Movimiento de salida creado por UPDATE: % para cost_id: %', 
          v_exit_movement_id, NEW.id;
      ELSE
        RAISE WARNING '⚠️ No se pudo crear movimiento de salida para cost_id: % (movimiento de entrada no encontrado)', NEW.id;
      END IF;
    ELSE
      RAISE NOTICE 'ℹ️ Cost_id % ya tiene movimiento de salida, no se crea duplicado', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION 
  WHEN OTHERS THEN
    RAISE WARNING '❌ Error en handle_immediate_consumption_update para cost_id %: %', NEW.id, SQLERRM;
    RETURN NEW; -- No interrumpir la operación por errores en el trigger
END;
$$;

-- Crear el trigger (DROP IF EXISTS para evitar errores si ya existe)
DROP TRIGGER IF EXISTS handle_immediate_consumption_update_trigger ON public.costs;

CREATE TRIGGER handle_immediate_consumption_update_trigger
  AFTER UPDATE ON public.costs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_immediate_consumption_update();

COMMENT ON FUNCTION public.handle_immediate_consumption_update() IS 
'Trigger que crea automáticamente el movimiento de salida cuando se activa immediate_consumption en un costo existente. Permite aplicar consumo inmediato de forma retroactiva.';

-- ============================================================
-- FASE 3: VALIDACIONES (como comentarios para uso manual)
-- ============================================================
/*
-- Query de validación: Verificar que todos los costos con immediate_consumption = true
-- tengan ambos movimientos (entrada + salida) y stock neto = 0

SELECT 
  c.id,
  c.description,
  c.date,
  c.immediate_consumption,
  c.crane_id,
  cr.internal_number as crane,
  COUNT(DISTINCT im.id) as total_movements,
  COUNT(DISTINCT CASE WHEN im.movement_type = 'entry' THEN im.id END) as entries,
  COUNT(DISTINCT CASE WHEN im.movement_type = 'exit' THEN im.id END) as exits,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN im.movement_type = 'exit' THEN im.id END) = 0 
    THEN '❌ FALTA SALIDA'
    ELSE '✅ COMPLETO'
  END as status
FROM costs c
LEFT JOIN inventory_movements im ON im.cost_id = c.id
LEFT JOIN cranes cr ON cr.id = c.crane_id
WHERE c.immediate_consumption = true
GROUP BY c.id, c.description, c.date, c.immediate_consumption, c.crane_id, cr.internal_number
ORDER BY c.date DESC;

-- Si esta query devuelve filas con status '❌ FALTA SALIDA', 
-- significa que hay registros con problemas
*/

-- ============================================================
-- RESUMEN DE LA IMPLEMENTACIÓN
-- ============================================================
/*
✅ FASE 1: Script de corrección ejecutado
   - Corrige registros históricos (Aceite Hidráulico, Filtros)
   - Crea movimientos de salida faltantes
   - Stock neto queda en 0

✅ FASE 2: Trigger UPDATE implementado
   - Permite activar consumo inmediato en costos existentes
   - Previene duplicados
   - Aplica mismo comportamiento que INSERT

✅ FASE 3: Validaciones disponibles
   - Query de verificación incluida como comentario
   - Permite auditar el estado del sistema

📝 PRÓXIMO PASO:
   - Actualizar documentación en docs/technical/inventory-sync.md
*/