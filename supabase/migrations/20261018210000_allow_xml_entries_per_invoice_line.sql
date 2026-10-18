BEGIN;

DROP INDEX IF EXISTS public.uniq_inventory_entry_active_per_cost;

CREATE UNIQUE INDEX uniq_inventory_entry_active_per_cost
  ON public.inventory_movements (cost_id)
  WHERE cost_id IS NOT NULL
    AND supplier_invoice_item_id IS NULL
    AND movement_type = 'entry'
    AND status = 'active';

CREATE UNIQUE INDEX uniq_inventory_entry_active_per_cost_invoice_line
  ON public.inventory_movements (cost_id, supplier_invoice_item_id)
  WHERE cost_id IS NOT NULL
    AND supplier_invoice_item_id IS NOT NULL
    AND movement_type = 'entry'
    AND status = 'active';

COMMIT;
