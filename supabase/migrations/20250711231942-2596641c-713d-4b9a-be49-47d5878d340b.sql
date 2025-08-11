-- First, let's examine the current trigger function
SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'update_inventory_stock';

-- Check if there are any duplicate triggers
SELECT * FROM pg_trigger WHERE tgname = 'trigger_update_inventory_stock';

-- Fix the stock data to reflect the correct quantity (8 instead of 16)
UPDATE inventory_stock 
SET current_quantity = 8,
    available_quantity = 8,
    updated_at = now()
WHERE item_id = (
  SELECT id FROM inventory_items WHERE name ILIKE '%neumático%'
);

-- Add constraint to prevent duplicate stock records
ALTER TABLE inventory_stock 
ADD CONSTRAINT unique_item_location 
UNIQUE (item_id, location_id);

-- Create an improved trigger function with better logging and duplicate prevention
CREATE OR REPLACE FUNCTION public.update_inventory_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  existing_stock_id UUID;
BEGIN
  -- Only process if status is 'active'
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Log the movement for debugging
  RAISE NOTICE 'Processing inventory movement: item_id=%, location_id=%, type=%, quantity=%, movement_id=%', 
    NEW.item_id, NEW.location_id, NEW.movement_type, NEW.quantity, NEW.id;

  -- Check if stock record already exists
  SELECT id INTO existing_stock_id
  FROM inventory_stock 
  WHERE item_id = NEW.item_id AND location_id = NEW.location_id;

  IF NEW.movement_type = 'entry' THEN
    IF existing_stock_id IS NOT NULL THEN
      -- Update existing stock
      UPDATE inventory_stock 
      SET 
        current_quantity = current_quantity + NEW.quantity,
        last_movement_date = NEW.movement_date,
        updated_at = now()
      WHERE id = existing_stock_id;
      
      RAISE NOTICE 'Updated existing stock record: %', existing_stock_id;
    ELSE
      -- Insert new stock record
      INSERT INTO inventory_stock (item_id, location_id, current_quantity, last_movement_date)
      VALUES (NEW.item_id, NEW.location_id, NEW.quantity, NEW.movement_date);
      
      RAISE NOTICE 'Created new stock record for item % at location %', NEW.item_id, NEW.location_id;
    END IF;
    
  ELSIF NEW.movement_type = 'exit' THEN
    IF existing_stock_id IS NOT NULL THEN
      UPDATE inventory_stock 
      SET 
        current_quantity = GREATEST(0, current_quantity - NEW.quantity),
        last_movement_date = NEW.movement_date,
        updated_at = now()
      WHERE id = existing_stock_id;
      
      RAISE NOTICE 'Updated stock for exit: reduced by %', NEW.quantity;
    ELSE
      RAISE WARNING 'Cannot process exit movement: no stock record found for item % at location %', 
        NEW.item_id, NEW.location_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;