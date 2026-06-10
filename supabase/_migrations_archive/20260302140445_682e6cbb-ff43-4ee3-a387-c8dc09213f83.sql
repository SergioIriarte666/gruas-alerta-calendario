ALTER TABLE cranes ADD COLUMN toll_vehicle_category text NOT NULL DEFAULT '2';

-- Set categories based on existing crane types
UPDATE cranes SET toll_vehicle_category = '3' WHERE type IN ('light', 'medium');
UPDATE cranes SET toll_vehicle_category = '2' WHERE type = 'taxi';
UPDATE cranes SET toll_vehicle_category = '4' WHERE type = 'heavy';
UPDATE cranes SET toll_vehicle_category = '2' WHERE type = 'horquilla';