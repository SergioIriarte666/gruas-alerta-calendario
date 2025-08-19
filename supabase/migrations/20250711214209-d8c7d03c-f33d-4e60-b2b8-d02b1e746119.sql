-- Add supplier_name column to inventory_movements table for free text supplier information
ALTER TABLE public.inventory_movements 
ADD COLUMN supplier_name TEXT;