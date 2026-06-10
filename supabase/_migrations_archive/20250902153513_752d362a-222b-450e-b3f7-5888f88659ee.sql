-- Add purchase_order column to service_closures table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'service_closures' 
        AND column_name = 'purchase_order'
    ) THEN
        ALTER TABLE public.service_closures 
        ADD COLUMN purchase_order text;
    END IF;
END $$;