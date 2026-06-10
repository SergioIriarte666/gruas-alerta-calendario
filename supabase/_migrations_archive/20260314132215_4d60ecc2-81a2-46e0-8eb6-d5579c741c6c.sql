
-- Fix services that have quote_number but were incorrectly reverted to 'completed' by the old trigger
-- These should be in 'quoted' status since they have no purchase_order or invoice_folio
UPDATE public.services 
SET status = 'quoted', updated_at = now()
WHERE quote_number IS NOT NULL 
  AND quote_number != ''
  AND status = 'completed'
  AND (invoice_folio IS NULL OR invoice_folio = '')
  AND (purchase_order IS NULL OR purchase_order = '');
