-- Update cranes to use exact GetAPI category codes
UPDATE cranes SET toll_vehicle_category = 'CAMION_2_EJES' WHERE toll_vehicle_category = 'CAMION';
-- Update crane_consumption_rates to use exact GetAPI category codes
UPDATE crane_consumption_rates SET toll_vehicle_category = 'CAMION_2_EJES' WHERE toll_vehicle_category = 'CAMION';