-- Add cost_id column to inventory_movements table to link inventory movements with costs
ALTER TABLE public.inventory_movements 
ADD COLUMN cost_id uuid REFERENCES public.costs(id) ON DELETE SET NULL;

-- Add index for better performance on cost_id lookups
CREATE INDEX idx_inventory_movements_cost_id ON public.inventory_movements(cost_id);

-- Add comment for documentation
COMMENT ON COLUMN public.inventory_movements.cost_id IS 'Reference to cost entry when inventory movement generates a cost (e.g., purchases)';