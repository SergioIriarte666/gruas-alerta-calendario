-- 1. Corregir el cierre CIE-230 específicamente
UPDATE service_closures
SET client_id = 'cb5b213d-4824-481c-b29d-5f7e7a13020a'
WHERE id = 'c3d76fde-3675-4564-a63e-fd3933264dfc'
  AND client_id IS NULL;

-- 2. Corregir cualquier otro cierre sin cliente (usando el cliente del primer servicio asociado)
UPDATE service_closures sc
SET client_id = (
  SELECT s.client_id 
  FROM closure_services cs 
  JOIN services s ON s.id = cs.service_id 
  WHERE cs.closure_id = sc.id 
    AND s.client_id IS NOT NULL
  LIMIT 1
)
WHERE sc.client_id IS NULL
  AND EXISTS (
    SELECT 1 FROM closure_services cs 
    JOIN services s ON s.id = cs.service_id 
    WHERE cs.closure_id = sc.id AND s.client_id IS NOT NULL
  );