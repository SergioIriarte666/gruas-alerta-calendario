CREATE OR REPLACE FUNCTION public.sync_cost_deletion_cascade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Evitar que los triggers de supplier_payments intenten reescribir el costo
  PERFORM set_config('app.cascade_delete', 'true', true);

  -- Eliminar pagos relacionados sin tocar la fila de costs que ya se está borrando
  DELETE FROM public.supplier_payments
  WHERE id = OLD.supplier_payment_id
     OR cost_id = OLD.id;

  -- Cancelar movimientos activos de inventario asociados al costo
  UPDATE public.inventory_movements
  SET status = 'cancelled',
      observations = COALESCE(observations, '') || ' [Costo eliminado]'
  WHERE cost_id = OLD.id
    AND status = 'active';

  RETURN OLD;
END;
$$;