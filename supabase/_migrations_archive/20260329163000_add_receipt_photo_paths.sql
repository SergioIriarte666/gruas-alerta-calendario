ALTER TABLE public.costs
ADD COLUMN IF NOT EXISTS receipt_photo_paths text[];

ALTER TABLE public.crane_maintenance
ADD COLUMN IF NOT EXISTS receipt_photo_paths text[];

ALTER TABLE public.inventory_movements
ADD COLUMN IF NOT EXISTS receipt_photo_paths text[];
