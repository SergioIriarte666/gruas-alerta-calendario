-- Fix trigger to prevent duplication and ensure proper stock management
-- This trigger should create crane_parts record for inventory exits ONLY if one doesn't exist

CREATE OR REPLACE FUNCTION public.sync_inventory_exit_to_crane_parts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  -- Solo procesar salidas (exit) de inventario con crane_id
  IF NEW.movement_type = 'exit' AND NEW.crane_id IS NOT NULL AND NEW.status = 'active' THEN
    
    -- Verificar si ya existe un registro en crane_parts para esta combinación
    -- de crane_id, item_name y fecha (para evitar duplicados)
    SELECT COUNT(*) INTO existing_count
    FROM public.crane_parts cp
    JOIN public.inventory_items ii ON ii.name = (
      SELECT name FROM public.inventory_items WHERE id = NEW.item_id
    )
    WHERE cp.crane_id = NEW.crane_id
    AND cp.part_name = ii.name
    AND cp.date = NEW.movement_date::date
    AND (cp.inventory_movement_id = NEW.id OR cp.inventory_movement_id IS NULL);
    
    -- Solo crear si no existe un registro similar
    IF existing_count = 0 THEN
      INSERT INTO public.crane_parts (
        crane_id,
        part_name,
        supplier,
        quantity,
        unit_price,
        total_value,
        date,
        notes,
        inventory_movement_id,
        created_by
      )
      SELECT 
        NEW.crane_id,
        ii.name,
        COALESCE(NEW.supplier_name, 'Consumo de inventario'),
        NEW.quantity,
        COALESCE(NEW.unit_cost, 0),
        COALESCE(NEW.total_cost, NEW.unit_cost * NEW.quantity, 0),
        NEW.movement_date::date,
        COALESCE('Consumo automático de inventario. ' || NEW.observations, 'Consumo automático de inventario'),
        NEW.id,
        NEW.created_by
      FROM public.inventory_items ii
      WHERE ii.id = NEW.item_id;
      
      RAISE NOTICE 'Created crane_parts record for inventory exit: % (movement_id: %)', 
        (SELECT name FROM public.inventory_items WHERE id = NEW.item_id), NEW.id;
    ELSE
      RAISE NOTICE 'Skipped creating crane_parts record - already exists for: % on %', 
        (SELECT name FROM public.inventory_items WHERE id = NEW.item_id), NEW.movement_date::date;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Clean up any duplicate records that may exist
-- Remove crane_parts records that point to the same inventory_movement_id multiple times
DELETE FROM public.crane_parts 
WHERE id IN (
  SELECT cp1.id
  FROM public.crane_parts cp1
  JOIN public.crane_parts cp2 ON cp1.inventory_movement_id = cp2.inventory_movement_id
  WHERE cp1.id > cp2.id 
  AND cp1.inventory_movement_id IS NOT NULL
);

-- Ensure trigger is properly attached
DROP TRIGGER IF EXISTS sync_inventory_exit_to_crane_parts_trigger ON public.inventory_movements;
CREATE TRIGGER sync_inventory_exit_to_crane_parts_trigger
  AFTER INSERT OR UPDATE ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_inventory_exit_to_crane_parts();