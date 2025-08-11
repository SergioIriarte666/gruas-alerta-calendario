-- Fix inventory_alerts table to allow NULL in item_id and location_id
-- This allows creating alerts for "all items" or "all locations"

ALTER TABLE inventory_alerts 
ALTER COLUMN item_id DROP NOT NULL;

ALTER TABLE inventory_alerts 
ALTER COLUMN location_id DROP NOT NULL;

-- Add comments to clarify usage
COMMENT ON COLUMN inventory_alerts.item_id IS 'Product ID - NULL means alert applies to all products';
COMMENT ON COLUMN inventory_alerts.location_id IS 'Location ID - NULL means alert applies to all locations';