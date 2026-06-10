-- Fix existing rental services with incorrect values
UPDATE public.services 
SET value = custody_total_amount,
    updated_at = now()
WHERE custody_total_amount IS NOT NULL 
  AND custody_total_amount > 0 
  AND (value IS NULL OR value = 0);