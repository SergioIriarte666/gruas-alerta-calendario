-- Normaliza services.vehicle_brand / vehicle_model.
--
-- Motivo: el autocompletado del bloque "Datos del Vehículo" resuelve la marca
-- buscando el nombre crudo del historial dentro de vehicle_brands. Un espacio
-- sobrante ('Nissan ' en SRV-6382) rompe el match, el Select de Marca cae al
-- placeholder y el formulario queda a medio llenar.
--
-- Estado previo (medido 2026-08-09):
--   57 servicios con espacios sobrantes en vehicle_brand (11 valores distintos)
--    3 servicios con espacios sobrantes en vehicle_model
--   17 servicios con espacios internos dobles en vehicle_brand
--   18 servicios con marca fuera de catálogo (10 valores distintos)
--
-- services tiene trigger de auditoría (service_change_history): este UPDATE
-- masivo genera filas ahí. Es esperado.

BEGIN;

-- 1. Trim general -----------------------------------------------------------

UPDATE services
SET vehicle_brand = btrim(vehicle_brand)
WHERE vehicle_brand IS NOT NULL
  AND vehicle_brand <> btrim(vehicle_brand);

UPDATE services
SET vehicle_model = btrim(vehicle_model)
WHERE vehicle_model IS NOT NULL
  AND vehicle_model <> btrim(vehicle_model);

-- 2. Colapsar espacios internos dobles ('Chevrolet  Sail') ------------------

UPDATE services
SET vehicle_brand = regexp_replace(vehicle_brand, '\s+', ' ', 'g')
WHERE vehicle_brand ~ '\s{2,}';

UPDATE services
SET vehicle_model = regexp_replace(vehicle_model, '\s+', ' ', 'g')
WHERE vehicle_model ~ '\s{2,}';

-- 3. Tipeos con destino verificado en vehicle_brands ------------------------
--    La comparación va sobre btrim(upper(...)) para no depender del casing.

UPDATE services s
SET vehicle_brand = m.correct_name
FROM (
  VALUES
    ('MISTIBUSHI',  'Mitsubishi'),
    ('MITSUBISH1',  'Mitsubishi'),
    ('MITUSBISHI',  'Mitsubishi'),
    ('TOTOYA',      'Toyota'),
    ('DOGDE',       'Dodge'),
    ('CHEVOLET',    'Chevrolet'),
    ('GREAT WALLL', 'Great Wall')
) AS m(typo_upper, correct_name)
WHERE s.vehicle_brand IS NOT NULL
  AND btrim(upper(s.vehicle_brand)) = m.typo_upper
  AND s.vehicle_brand <> m.correct_name;

-- 4. Casos NO mapeables: se dejan tal cual, a la espera de decisión manual.
--       'DS3'    (1 servicio) — es un modelo, no una marca; la marca sería
--                 Citroen, que sí existe en catálogo. No se toca.
--       'Volare' (1 servicio) — marca real de buses (Marcopolo Volare), fuera
--                 de catálogo. No se crea la marca por cuenta propia.
--       'N/A'    (7 servicios) — marcador explícito de "sin dato". Se deja.

COMMIT;

-- Verificación (ejecutar a mano tras el push):
--
--   -- espacios sobrantes: esperado 0 / 0
--   SELECT
--     (SELECT count(*) FROM services
--       WHERE vehicle_brand IS NOT NULL AND vehicle_brand <> btrim(vehicle_brand)) AS brand_untrimmed,
--     (SELECT count(*) FROM services
--       WHERE vehicle_model IS NOT NULL AND vehicle_model <> btrim(vehicle_model)) AS model_untrimmed;
--
--   -- marcas aún fuera de catálogo: esperado sólo 'N/A', 'Volare', 'DS3'
--   SELECT DISTINCT s.vehicle_brand
--   FROM services s
--   WHERE s.vehicle_brand IS NOT NULL
--     AND btrim(s.vehicle_brand) <> ''
--     AND NOT EXISTS (
--       SELECT 1 FROM vehicle_brands b
--       WHERE upper(btrim(b.name)) = upper(btrim(s.vehicle_brand))
--     );
