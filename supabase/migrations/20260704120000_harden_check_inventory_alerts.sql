BEGIN;

-- Bug A: check_inventory_alerts() reventaba con notification_logs_user_id_fkey
-- cuando un perfil admin/operator no tenía un auth.users correspondiente (o estaba
-- inactivo), bloqueando cualquier UPDATE de inventory_stock que gatillara la alerta
-- de stock bajo. Se filtra a perfiles con usuario auth real y activo.
CREATE OR REPLACE FUNCTION "public"."check_inventory_alerts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  item_record RECORD;
  alert_record RECORD;
BEGIN
  -- Get item details
  SELECT * INTO item_record FROM public.inventory_items WHERE id = NEW.item_id;

  -- Check low stock alerts
  IF NEW.current_quantity <= item_record.minimum_stock THEN
    INSERT INTO public.notification_logs (user_id, type, title, body, data)
    SELECT
      p.id,
      'inventory_alert',
      'Stock Bajo: ' || item_record.name,
      'El producto ' || item_record.name || ' tiene stock bajo (' || NEW.current_quantity || ' unidades)',
      jsonb_build_object('item_id', NEW.item_id, 'location_id', NEW.location_id, 'quantity', NEW.current_quantity)
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.role IN ('admin', 'operator')
      AND p.is_active = true;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."check_inventory_alerts"() OWNER TO "postgres";

COMMIT;
