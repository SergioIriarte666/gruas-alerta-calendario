-- Add kilometraje field to crane_maintenance table
ALTER TABLE public.crane_maintenance 
ADD COLUMN kilometraje INTEGER;

-- Add kilometraje field to crane_parts table  
ALTER TABLE public.crane_parts 
ADD COLUMN kilometraje INTEGER;