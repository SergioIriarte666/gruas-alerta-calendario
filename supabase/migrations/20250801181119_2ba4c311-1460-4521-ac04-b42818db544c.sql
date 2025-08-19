-- Eliminar comisiones duplicadas para el servicio 2542431
DELETE FROM public.costs 
WHERE id IN (
  '1bfa9cfa-be40-4734-a1d7-e44feded5077', 
  '320ac2b4-b78e-45e9-accc-cc9be3f36b00'
) 
AND service_id = 'cc4b2644-3992-492b-ad19-c79eabdd6bd5';