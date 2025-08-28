-- Update unit_cost for Mangueras y Adaptadores to weighted average
UPDATE public.inventory_items 
SET unit_cost = 73171.67,
    updated_at = NOW()
WHERE name = 'Mangueras y Adaptadores';