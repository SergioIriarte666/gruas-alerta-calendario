-- Update inventory_alerts table to allow all alert types used by frontend
ALTER TABLE inventory_alerts DROP CONSTRAINT IF EXISTS inventory_alerts_alert_type_check;

-- Add updated constraint that includes all alert types
ALTER TABLE inventory_alerts 
ADD CONSTRAINT inventory_alerts_alert_type_check 
CHECK (alert_type IN ('low_stock', 'expiring_soon', 'overstock', 'no_movement', 'excess_stock', 'expiration'));

-- Update any existing 'expiration' alerts to 'expiring_soon' for consistency
UPDATE inventory_alerts 
SET alert_type = 'expiring_soon' 
WHERE alert_type = 'expiration';