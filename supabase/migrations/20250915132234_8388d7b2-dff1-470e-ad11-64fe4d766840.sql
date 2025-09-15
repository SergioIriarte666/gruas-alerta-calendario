-- Crear función para corregir el costo unitario del producto "Materiales Eléctricos"
CREATE OR REPLACE FUNCTION public.fix_materiales_electricos_unit_cost()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item_id_found UUID;
  avg_historical_cost NUMERIC;
  updated_count INTEGER := 0;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden corregir costos de catálogo';
  END IF;

  -- Buscar el item "Materiales Eléctricos"
  SELECT id INTO item_id_found
  FROM public.inventory_items
  WHERE LOWER(name) LIKE '%materiales%electricos%' 
     OR LOWER(name) LIKE '%materiales%eléctricos%'
  LIMIT 1;

  IF item_id_found IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se encontró el producto "Materiales Eléctricos"'
    );
  END IF;

  -- Calcular costo promedio de las entradas históricas
  SELECT AVG(unit_cost) INTO avg_historical_cost
  FROM public.inventory_movements 
  WHERE item_id = item_id_found 
    AND movement_type IN ('entry', 'purchase')
    AND unit_cost > 0
    AND unit_cost IS NOT NULL;

  -- Si no hay costo histórico, usar el valor conocido de $19,620
  IF avg_historical_cost IS NULL OR avg_historical_cost = 0 THEN
    avg_historical_cost := 19620.00;
  END IF;

  -- Actualizar el unit_cost en inventory_items
  UPDATE public.inventory_items
  SET 
    unit_cost = avg_historical_cost,
    updated_at = NOW()
  WHERE id = item_id_found
    AND (unit_cost IS NULL OR unit_cost = 0);
    
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'item_id', item_id_found,
    'updated_count', updated_count,
    'new_unit_cost', avg_historical_cost,
    'message', format('Costo unitario actualizado a $%s', avg_historical_cost)
  );
END;
$function$;