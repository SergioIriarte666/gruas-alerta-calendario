-- Función para calcular costo promedio ponderado de un item
CREATE OR REPLACE FUNCTION public.get_weighted_average_cost(p_item_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_avg_cost numeric;
BEGIN
  SELECT 
    COALESCE(
      SUM(unit_cost * quantity) / NULLIF(SUM(quantity), 0),
      0
    )
  INTO v_avg_cost
  FROM inventory_movements
  WHERE item_id = p_item_id
    AND movement_type = 'entry'
    AND status = 'active'
    AND unit_cost IS NOT NULL;
    
  RETURN COALESCE(v_avg_cost, 0);
END;
$$;

-- Función trigger para auto-llenar costos en salidas
CREATE OR REPLACE FUNCTION public.fill_exit_costs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_avg_cost numeric;
BEGIN
  -- Solo aplica para movimientos de salida sin costo definido
  IF NEW.movement_type = 'exit' AND NEW.unit_cost IS NULL THEN
    -- Obtener costo promedio ponderado
    v_avg_cost := get_weighted_average_cost(NEW.item_id);
    
    -- Asignar costos calculados
    NEW.unit_cost := v_avg_cost;
    NEW.total_cost := v_avg_cost * NEW.quantity;
    
    RAISE NOTICE 'Auto-calculado costo para salida: item=%, unit_cost=%, total_cost=%', 
      NEW.item_id, NEW.unit_cost, NEW.total_cost;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger para auto-calcular costos en salidas
DROP TRIGGER IF EXISTS trigger_fill_exit_costs ON inventory_movements;
CREATE TRIGGER trigger_fill_exit_costs
  BEFORE INSERT OR UPDATE ON inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION fill_exit_costs();

-- Actualizar registros existentes con costos NULL
UPDATE inventory_movements im
SET 
  unit_cost = get_weighted_average_cost(im.item_id),
  total_cost = get_weighted_average_cost(im.item_id) * im.quantity
WHERE movement_type = 'exit'
  AND unit_cost IS NULL
  AND status = 'active';