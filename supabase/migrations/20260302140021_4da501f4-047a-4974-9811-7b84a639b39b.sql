-- Fix toll vehicle categories based on user's real-world data
UPDATE crane_consumption_rates SET toll_vehicle_category = '3' WHERE crane_type = 'light';
UPDATE crane_consumption_rates SET toll_vehicle_category = '3' WHERE crane_type = 'medium';
UPDATE crane_consumption_rates SET toll_vehicle_category = '2' WHERE crane_type = 'taxi';
UPDATE crane_consumption_rates SET toll_vehicle_category = '4' WHERE crane_type = 'heavy';
UPDATE crane_consumption_rates SET toll_vehicle_category = '2' WHERE crane_type = 'horquilla';