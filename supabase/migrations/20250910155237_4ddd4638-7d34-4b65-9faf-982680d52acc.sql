-- Add 'sale' as a valid movement type for inventory_movements
-- First check if 'sale' movement type constraint exists
DO $$
BEGIN
    -- Check if there's a constraint on movement_type
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'inventory_movements' 
        AND constraint_type = 'CHECK' 
        AND constraint_name LIKE '%movement_type%'
    ) THEN
        -- If constraint exists, modify it to include 'sale'
        -- We'll need to drop and recreate the constraint
        ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_movement_type_check;
        
        -- Add new constraint that includes 'sale'
        ALTER TABLE public.inventory_movements 
        ADD CONSTRAINT inventory_movements_movement_type_check 
        CHECK (movement_type IN ('entry', 'exit', 'transfer', 'adjustment', 'sale'));
    END IF;
END $$;