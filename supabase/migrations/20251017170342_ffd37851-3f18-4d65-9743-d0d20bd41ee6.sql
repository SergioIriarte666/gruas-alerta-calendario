-- FASE 1: Reparar función get_parts_traceability (CRÍTICO)
-- El error indica que las columnas de tipo entero esperadas están retornando bigint
-- Esto ocurre porque SUM() retorna bigint en PostgreSQL

DROP FUNCTION IF EXISTS public.get_parts_traceability(uuid);

CREATE OR REPLACE FUNCTION public.get_parts_traceability(p_crane_id uuid DEFAULT NULL)
RETURNS TABLE (
  part_id uuid,
  part_name text,
  supplier text,
  purchase_date date,
  purchase_cost numeric,
  inventory_item_id uuid,
  inventory_item_name text,
  current_stock bigint,  -- Cambiar de integer a bigint
  total_purchased bigint,  -- Cambiar de integer a bigint
  total_consumed bigint,  -- Cambiar de integer a bigint
  crane_license_plate text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.id as part_id,
    cp.part_name,
    cp.supplier,
    cp.date as purchase_date,
    cp.total_value as purchase_cost,
    ii.id as inventory_item_id,
    ii.name as inventory_item_name,
    COALESCE(
      (SELECT SUM(current_quantity)
       FROM inventory_stock 
       WHERE item_id = ii.id), 
      0::bigint
    ) as current_stock,
    COALESCE(
      (SELECT SUM(quantity)
       FROM inventory_movements 
       WHERE item_id = ii.id AND movement_type = 'entry' AND status = 'active'),
      0::bigint
    ) as total_purchased,
    COALESCE(
      (SELECT SUM(quantity)
       FROM inventory_movements 
       WHERE item_id = ii.id AND movement_type = 'exit' AND status = 'active'),
      0::bigint
    ) as total_consumed,
    c.license_plate as crane_license_plate
  FROM crane_parts cp
  LEFT JOIN cranes c ON cp.crane_id = c.id
  LEFT JOIN inventory_movements im ON cp.inventory_movement_id = im.id
  LEFT JOIN inventory_items ii ON im.item_id = ii.id
  WHERE (p_crane_id IS NULL OR cp.crane_id = p_crane_id)
  ORDER BY cp.date DESC;
END;
$$;