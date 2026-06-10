-- First, null out any outsourced_provider_id values that don't exist in inventory_suppliers
UPDATE public.services 
SET outsourced_provider_id = NULL 
WHERE outsourced_provider_id IS NOT NULL 
  AND outsourced_provider_id NOT IN (SELECT id FROM public.inventory_suppliers);

-- Now drop the old constraint and add the correct one
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_outsourced_provider_id_fkey;

ALTER TABLE public.services 
  ADD CONSTRAINT services_outsourced_provider_id_fkey 
  FOREIGN KEY (outsourced_provider_id) 
  REFERENCES public.inventory_suppliers(id) 
  ON DELETE SET NULL;