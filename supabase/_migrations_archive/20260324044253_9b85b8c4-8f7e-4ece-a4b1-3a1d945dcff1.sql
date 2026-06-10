CREATE OR REPLACE FUNCTION sync_cost_deletion_cascade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sp_id UUID;
BEGIN
  v_sp_id := OLD.supplier_payment_id;
  
  IF v_sp_id IS NOT NULL THEN
    UPDATE costs SET supplier_payment_id = NULL WHERE id = OLD.id;
    DELETE FROM supplier_payments WHERE id = v_sp_id;
  END IF;
  
  DELETE FROM supplier_payments WHERE cost_id = OLD.id AND id != COALESCE(v_sp_id, '00000000-0000-0000-0000-000000000000');
  
  UPDATE inventory_movements 
  SET status = 'cancelled', observations = COALESCE(observations, '') || ' [Costo eliminado]'
  WHERE cost_id = OLD.id AND status = 'active';
  
  RETURN OLD;
END;
$$;