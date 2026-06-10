-- Agregar 'horquilla' al enum crane_type si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'horquilla' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'crane_type')) THEN
        ALTER TYPE crane_type ADD VALUE 'horquilla';
    END IF;
END $$;