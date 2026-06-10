-- Remove the old check constraint on supplier_payments that restricts categories to hardcoded values
ALTER TABLE public.supplier_payments DROP CONSTRAINT IF EXISTS supplier_payments_category_check;

-- Check if there's a similar constraint on suppliers table and remove it
ALTER TABLE public.suppliers DROP CONSTRAINT IF EXISTS suppliers_category_check;

-- Verify the constraints have been removed by checking remaining constraints
-- (This is just for verification, the migration will succeed regardless)
DO $$
BEGIN
  -- Check if supplier_payments constraint was removed
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'supplier_payments_category_check'
  ) THEN
    RAISE NOTICE 'supplier_payments_category_check constraint successfully removed';
  END IF;

  -- Check if suppliers constraint was removed (if it existed)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'suppliers_category_check'
  ) THEN
    RAISE NOTICE 'suppliers_category_check constraint removed or did not exist';
  END IF;
END $$;