-- Actualizar servicios históricos anteriores al 1 de diciembre 2025
-- Asignar a Sergio Iriarte como creador
UPDATE services 
SET created_by = 'c6342c12-a2b4-420a-a2c0-439d1188887b'
WHERE created_by IS NULL 
  AND created_at < '2025-12-01 00:00:00+00';