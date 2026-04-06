-- Backfill created_by for inventory_movements that have a linked cost
UPDATE public.inventory_movements im
SET created_by = c.created_by
FROM public.costs c
WHERE im.cost_id = c.id
  AND im.created_by IS NULL
  AND c.created_by IS NOT NULL;

-- For remaining movements without cost link, use the default admin user
UPDATE public.inventory_movements
SET created_by = 'c6342c12-a2b4-420a-a2c0-439d1188887b'
WHERE created_by IS NULL;