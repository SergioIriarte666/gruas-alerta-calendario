-- Corregir servicios mal asignados: cambiar de Auxilia Club Asistencia S.A. a Arrendadora S.A.
-- Los 7 servicios creados en la última hora que tienen Auxilia pero deberían ser Arrendadora

UPDATE services 
SET client_id = 'cb5b213d-4824-481c-b29d-5f7e7a13020a'  -- ID de Arrendadora S.A.
WHERE client_id = '5d3536fa-981a-484c-aebc-c910795af2c8'  -- ID de Auxilia Club Asistencia S.A.
  AND created_at > NOW() - INTERVAL '2 hours'
  AND folio IN ('SRV-3680', 'SRV-3681', 'SRV-3682', 'SRV-3683', 'SRV-3684', 'SRV-3685', 'SRV-3686');