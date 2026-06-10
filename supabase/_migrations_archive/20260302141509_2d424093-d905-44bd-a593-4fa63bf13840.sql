-- Update existing toll_vehicle_category values from numeric to text-based API values

-- Update cranes table
UPDATE cranes SET toll_vehicle_category = 'CAMION' WHERE toll_vehicle_category IN ('3', '4');
UPDATE cranes SET toll_vehicle_category = 'LIVIANO' WHERE toll_vehicle_category IN ('1', '2');

-- Update crane_consumption_rates table
UPDATE crane_consumption_rates SET toll_vehicle_category = 'CAMION' WHERE toll_vehicle_category IN ('3', '4');
UPDATE crane_consumption_rates SET toll_vehicle_category = 'LIVIANO' WHERE toll_vehicle_category IN ('1', '2');

-- Update default value for new cranes
ALTER TABLE cranes ALTER COLUMN toll_vehicle_category SET DEFAULT 'LIVIANO';

-- Update default value for new consumption rates
ALTER TABLE crane_consumption_rates ALTER COLUMN toll_vehicle_category SET DEFAULT 'LIVIANO';