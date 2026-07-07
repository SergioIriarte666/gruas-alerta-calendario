-- Corrige puntos de operator_location_points capturados desde Safari/WebKit
-- con recorded_at referido al epoch de Apple (2001-01-01) en vez del epoch
-- Unix (1970-01-01). Diferencia exacta: 978307200 segundos (31 años).
-- También elimina duplicados exactos insertados por el bug de reintentos
-- múltiples por session_id, y agrega un índice único que impide que vuelvan
-- a ocurrir sin romper el diseño append-only de la tabla.

BEGIN;

DO $$
DECLARE
  affected_points integer;
  affected_sessions integer;
BEGIN
  SELECT count(*) INTO affected_points
  FROM public.operator_location_points
  WHERE recorded_at < '2020-01-01';

  SELECT count(*) INTO affected_sessions
  FROM public.operator_location_sessions
  WHERE last_point_at < '2020-01-01';

  RAISE NOTICE 'operator_location_points con recorded_at corrupto: %', affected_points;
  RAISE NOTICE 'operator_location_sessions con last_point_at corrupto: %', affected_sessions;
END $$;

-- 1. Eliminar duplicados exactos existentes (mismo operador/instante/coords)
-- ANTES de corregir fechas, dejando solo la fila más antigua por grupo.
DELETE FROM public.operator_location_points p
USING public.operator_location_points dup
WHERE p.operator_id = dup.operator_id
  AND p.recorded_at = dup.recorded_at
  AND p.latitude = dup.latitude
  AND p.longitude = dup.longitude
  AND p.id > dup.id;

-- 2. Corregir el offset de epoch Apple en los puntos.
UPDATE public.operator_location_points
SET recorded_at = recorded_at + INTERVAL '978307200 seconds'
WHERE recorded_at < '2020-01-01';

-- 3. Corregir el mismo offset en last_point_at de las sesiones asociadas.
UPDATE public.operator_location_sessions
SET last_point_at = last_point_at + INTERVAL '978307200 seconds'
WHERE last_point_at < '2020-01-01';

-- 4. Re-deduplicar por si el corrimiento de fecha generó nuevas colisiones
-- exactas con puntos que ya tenían fecha correcta (caso extremo).
DELETE FROM public.operator_location_points p
USING public.operator_location_points dup
WHERE p.operator_id = dup.operator_id
  AND p.recorded_at = dup.recorded_at
  AND p.latitude = dup.latitude
  AND p.longitude = dup.longitude
  AND p.id > dup.id;

-- 5. Índice único defensivo: impide clones exactos futuros sin violar el
-- carácter append-only de la tabla (sigue permitiendo múltiples filas por
-- operador, solo bloquea el (operador, instante, coords) repetido).
CREATE UNIQUE INDEX IF NOT EXISTS uq_operator_location_points_dedup
  ON public.operator_location_points (operator_id, recorded_at, latitude, longitude);

DO $$
DECLARE
  remaining_corrupt integer;
BEGIN
  SELECT count(*) INTO remaining_corrupt
  FROM public.operator_location_points
  WHERE recorded_at < '2020-01-01';

  RAISE NOTICE 'operator_location_points con recorded_at corrupto tras la migración: %', remaining_corrupt;
END $$;

COMMIT;
