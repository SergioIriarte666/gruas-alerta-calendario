BEGIN;

ALTER TABLE public.inventory_movements ENABLE TRIGGER sync_inventory_to_cost_trigger;

COMMIT;
