
-- Eliminar duplicados de "Entel PCS Telecomunicaciones S.A." que no tienen datos asociados
-- Conservar bbca0f39-4e77-42fb-9699-6f2a4aca6f5b (tiene 5 costos y 8 pagos)
-- Eliminar 65cfd952-1288-4589-9f76-1ed12a68e540 (sin datos, creado ago 2025)
-- Eliminar 5d4f9eb1-b6be-4911-8eca-a2e4138a9cd8 (sin datos, creado hoy)

DELETE FROM inventory_suppliers 
WHERE id IN (
  '65cfd952-1288-4589-9f76-1ed12a68e540',
  '5d4f9eb1-b6be-4911-8eca-a2e4138a9cd8'
);

-- Estandarizar el nombre del registro que se conserva
UPDATE inventory_suppliers 
SET name = 'Entel PCS Telecomunicaciones S.A.',
    rut = '96.806.980-2'
WHERE id = 'bbca0f39-4e77-42fb-9699-6f2a4aca6f5b';
