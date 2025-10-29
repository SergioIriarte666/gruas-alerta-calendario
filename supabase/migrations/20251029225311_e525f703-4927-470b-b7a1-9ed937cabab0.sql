-- Add missing columns to supplier_payments table for parts and inventory management

-- Add columns for part details
ALTER TABLE public.supplier_payments 
ADD COLUMN IF NOT EXISTS part_name TEXT,
ADD COLUMN IF NOT EXISTS part_quantity NUMERIC,
ADD COLUMN IF NOT EXISTS part_unit_price NUMERIC,
ADD COLUMN IF NOT EXISTS crane_id UUID REFERENCES public.cranes(id),
ADD COLUMN IF NOT EXISTS add_to_inventory BOOLEAN DEFAULT false;

-- Add comment to explain the new columns
COMMENT ON COLUMN public.supplier_payments.part_name IS 'Name of the part/piece purchased';
COMMENT ON COLUMN public.supplier_payments.part_quantity IS 'Quantity of parts purchased';
COMMENT ON COLUMN public.supplier_payments.part_unit_price IS 'Unit price per part';
COMMENT ON COLUMN public.supplier_payments.crane_id IS 'Associated crane for the part (optional)';
COMMENT ON COLUMN public.supplier_payments.add_to_inventory IS 'Whether to automatically add this purchase to inventory';