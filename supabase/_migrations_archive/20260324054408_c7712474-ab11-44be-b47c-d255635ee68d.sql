
-- =====================================================
-- FIX 1: Remove duplicate trigger on costs table
-- There are TWO triggers calling create_supplier_payment_from_cost:
--   - create_supplier_payment_from_cost (tgtype=29: INSERT+DELETE+UPDATE)
--   - create_supplier_payment_from_cost_trigger (tgtype=21: INSERT+UPDATE)
-- This causes the function to fire TWICE per INSERT/UPDATE, creating
-- cascading trigger storms that can break XML imports.
-- Keep only the correct one (INSERT+UPDATE).
-- =====================================================
DROP TRIGGER IF EXISTS create_supplier_payment_from_cost ON public.costs;

-- =====================================================
-- FIX 2: Update cascade deletion to also handle crane_parts
-- Previously crane_parts with cost_id referencing a deleted cost
-- were left orphaned.
-- =====================================================
CREATE OR REPLACE FUNCTION public.sync_cost_deletion_cascade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Prevent supplier_payment delete triggers from trying to update the cost being deleted
  PERFORM set_config('app.cascade_delete', 'true', true);

  -- Delete related supplier payments
  DELETE FROM public.supplier_payments
  WHERE id = OLD.supplier_payment_id
     OR cost_id = OLD.id;

  -- Cancel active inventory movements associated with the cost
  UPDATE public.inventory_movements
  SET status = 'cancelled',
      observations = COALESCE(observations, '') || ' [Costo eliminado]'
  WHERE cost_id = OLD.id
    AND status = 'active';

  -- Unlink crane_parts from the deleted cost (set cost_id to NULL)
  UPDATE public.crane_parts
  SET cost_id = NULL
  WHERE cost_id = OLD.id;

  RETURN OLD;
END;
$$;
