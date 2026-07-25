-- Destraba DELETE FROM services cuando el servicio tiene un costo pagado a proveedor.
--
-- Cadena circular observada en producción (ERROR 27000 "tuple to be deleted was
-- already modified"):
--   cascade_delete_service_data (BEFORE DELETE en services)
--     -> DELETE costs
--       -> sync_cost_deletion_cascade (BEFORE DELETE en costs) levanta app.cascade_delete
--         -> DELETE supplier_payments
--           -> sync_cost_supplier_payment_deletion (BEFORE DELETE en supplier_payments)
--             -> UPDATE costs SET supplier_payment_id = NULL  <-- misma fila en borrado
--
-- La guarda de sync_cost_supplier_payment_deletion sólo consultaba
-- app.bidirectional_sync y app.sync_in_progress; la bandera que enciende el
-- cascade es app.cascade_delete, así que la guarda leía una bandera distinta de
-- la que se prendía y el UPDATE se ejecutaba igual. Se agrega la tercera
-- condición; el resto de la función queda idéntico.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_cost_supplier_payment_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('app.bidirectional_sync', true) = 'true'
     OR current_setting('app.sync_in_progress', true) = 'true'
     OR current_setting('app.cascade_delete', true) = 'true' THEN
    RETURN OLD;
  END IF;

  IF OLD.cost_id IS NULL THEN
    RETURN OLD;
  END IF;

  PERFORM set_config('app.bidirectional_sync', 'true', true);
  PERFORM set_config('app.sync_in_progress', 'true', true);

  UPDATE public.costs
  SET supplier_payment_id = NULL,
      payment_date = NULL,
      updated_at = now()
  WHERE id = OLD.cost_id
    AND supplier_payment_id = OLD.id;

  RETURN OLD;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('app.bidirectional_sync', 'false', true);
    PERFORM set_config('app.sync_in_progress', 'false', true);
    RAISE;
END;
$$;

-- Función de trigger SECURITY DEFINER: sigue en la denylist de
-- 20260627170000_harden_supabase_security_warnings; los triggers no requieren
-- EXECUTE del invocador, así que se mantiene sin GRANT a roles de cliente.
REVOKE ALL ON FUNCTION public.sync_cost_supplier_payment_deletion()
  FROM PUBLIC, anon, authenticated;

COMMIT;
