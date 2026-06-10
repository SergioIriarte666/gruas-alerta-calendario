ALTER TABLE crane_consumption_rates 
ADD COLUMN toll_vehicle_category text NOT NULL DEFAULT '1';

UPDATE crane_consumption_rates SET toll_vehicle_category = '4' WHERE crane_type ILIKE '%Plataforma%';
UPDATE crane_consumption_rates SET toll_vehicle_category = '4' WHERE crane_type ILIKE '%Cama Baja%';
UPDATE crane_consumption_rates SET toll_vehicle_category = '3' WHERE crane_type ILIKE '%Pluma%';
UPDATE crane_consumption_rates SET toll_vehicle_category = '3' WHERE crane_type ILIKE '%Camión%';
UPDATE crane_consumption_rates SET toll_vehicle_category = '2' WHERE crane_type ILIKE '%Horquilla%';