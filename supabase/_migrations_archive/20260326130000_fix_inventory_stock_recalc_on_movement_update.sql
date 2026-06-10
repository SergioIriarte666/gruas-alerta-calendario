CREATE OR REPLACE FUNCTION public.update_inventory_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_item_id uuid;
  v_old_location_id uuid;
  v_new_item_id uuid;
  v_new_location_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new_item_id := NEW.item_id;
    v_new_location_id := NEW.location_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_item_id := OLD.item_id;
    v_old_location_id := OLD.location_id;
    v_new_item_id := NEW.item_id;
    v_new_location_id := NEW.location_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_item_id := OLD.item_id;
    v_old_location_id := OLD.location_id;
  END IF;

  IF v_old_item_id IS NOT NULL AND v_old_location_id IS NOT NULL THEN
    INSERT INTO public.inventory_stock (
      item_id,
      location_id,
      current_quantity,
      reserved_quantity,
      last_movement_date,
      created_at,
      updated_at
    )
    SELECT
      v_old_item_id,
      v_old_location_id,
      COALESCE(SUM(
        CASE
          WHEN im.movement_type = 'entry' THEN im.quantity
          WHEN im.movement_type = 'exit' THEN -im.quantity
          ELSE 0
        END
      ), 0) AS current_quantity,
      COALESCE((
        SELECT s.reserved_quantity
        FROM public.inventory_stock s
        WHERE s.item_id = v_old_item_id AND s.location_id = v_old_location_id
      ), 0) AS reserved_quantity,
      MAX(im.movement_date) AS last_movement_date,
      now() AS created_at,
      now() AS updated_at
    FROM public.inventory_movements im
    WHERE im.status = 'active'
      AND im.item_id = v_old_item_id
      AND im.location_id = v_old_location_id
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET
      current_quantity = EXCLUDED.current_quantity,
      reserved_quantity = EXCLUDED.reserved_quantity,
      last_movement_date = EXCLUDED.last_movement_date,
      updated_at = now();
  END IF;

  IF v_new_item_id IS NOT NULL AND v_new_location_id IS NOT NULL
     AND (v_new_item_id IS DISTINCT FROM v_old_item_id OR v_new_location_id IS DISTINCT FROM v_old_location_id) THEN
    INSERT INTO public.inventory_stock (
      item_id,
      location_id,
      current_quantity,
      reserved_quantity,
      last_movement_date,
      created_at,
      updated_at
    )
    SELECT
      v_new_item_id,
      v_new_location_id,
      COALESCE(SUM(
        CASE
          WHEN im.movement_type = 'entry' THEN im.quantity
          WHEN im.movement_type = 'exit' THEN -im.quantity
          ELSE 0
        END
      ), 0) AS current_quantity,
      COALESCE((
        SELECT s.reserved_quantity
        FROM public.inventory_stock s
        WHERE s.item_id = v_new_item_id AND s.location_id = v_new_location_id
      ), 0) AS reserved_quantity,
      MAX(im.movement_date) AS last_movement_date,
      now() AS created_at,
      now() AS updated_at
    FROM public.inventory_movements im
    WHERE im.status = 'active'
      AND im.item_id = v_new_item_id
      AND im.location_id = v_new_location_id
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET
      current_quantity = EXCLUDED.current_quantity,
      reserved_quantity = EXCLUDED.reserved_quantity,
      last_movement_date = EXCLUDED.last_movement_date,
      updated_at = now();
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_update_inventory_stock ON public.inventory_movements;
CREATE TRIGGER trigger_update_inventory_stock
AFTER INSERT OR UPDATE OR DELETE ON public.inventory_movements
FOR EACH ROW
EXECUTE FUNCTION public.update_inventory_stock();
