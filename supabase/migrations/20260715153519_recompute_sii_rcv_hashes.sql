BEGIN;

-- Normalización de RUT en el módulo Lowboy (sii_rcv_records).
--
-- Contexto: el importador CSV del SII guardaba el RUT de contraparte tal cual
-- venía en el archivo (7/8 con puntos "96.511.460-2", 1 sin puntos "78924030-2").
-- El content_hash de dedupe se calcula en el frontend como:
--   SHA-256( entity_rut | book_type | doc_type | folio | counterpart_rut | total_amount )
-- es decir, el hash INCLUYE el RUT. Al pasar el frontend a normalizar los RUT al
-- formato estándar XX.XXX.XXX-D ANTES de calcular el hash, los registros ya
-- importados deben recalcularse sobre el mismo esquema o el dedupe por
-- content_hash dejaría de reconocerlos y se re-insertarían duplicados.
--
-- Esta migración:
--   1. Normaliza counterpart_rut y entity_rut de los registros source='sii_import'.
--   2. Recalcula content_hash replicando EXACTAMENTE el string del frontend
--      (mismo orden de campos, separador '|') pero con los RUT normalizados.
-- El registro folio 6734292 (78.924.030-2, ya corregido a mano en la BD) se
-- recalcula con ese valor normalizado. Drift colateral corregido en el mismo
-- cambio: 77095981-0 -> 77.095.981-0 y 78080199-9 -> 78.080.199-9.
--
-- No toca records_inserted/records_skipped ni la bitácora sii_rcv_imports.

-- Réplica en SQL de normalizeRut() del frontend (src/utils/rutFormatter.ts).
-- Idempotente; devuelve el valor con trim() sin cambios si no parece un RUT.
CREATE FUNCTION pg_temp.normalize_rut(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  trimmed text := btrim(coalesce(raw, ''));
  clean text;
  body text;
  dv text;
  formatted text;
BEGIN
  IF trimmed = '' THEN
    RETURN trimmed;
  END IF;

  clean := upper(regexp_replace(trimmed, '[.[:space:]-]', '', 'g'));

  -- Cuerpo (>=1 dígito) + dígito verificador (0-9 o K). Si no calza, no es RUT.
  IF clean !~ '^[0-9]+[0-9K]$' THEN
    RETURN trimmed;
  END IF;

  body := left(clean, length(clean) - 1);
  dv := right(clean, 1);

  -- Puntos de miles: se invierte el cuerpo, se agrega un punto tras cada grupo
  -- de 3 dígitos seguido de otro dígito, y se vuelve a invertir.
  formatted := reverse(regexp_replace(reverse(body), '([0-9]{3})(?=[0-9])', '\1.', 'g'));

  RETURN formatted || '-' || dv;
END;
$$;

-- Guarda de seguridad: verificar que los hashes recalculados no colisionen con
-- el UNIQUE (sii_rcv_records_content_hash_key) antes de escribir.
DO $$
DECLARE
  total_rows integer;
  distinct_hashes integer;
BEGIN
  SELECT count(*),
         count(DISTINCT encode(digest(
           pg_temp.normalize_rut(entity_rut) || '|' || book_type || '|' ||
           doc_type::text || '|' || folio::text || '|' ||
           pg_temp.normalize_rut(counterpart_rut) || '|' || total_amount::text,
           'sha256'), 'hex'))
    INTO total_rows, distinct_hashes
  FROM public.sii_rcv_records
  WHERE source = 'sii_import';

  IF total_rows <> distinct_hashes THEN
    RAISE EXCEPTION 'Recalcular content_hash generaría colisión: % filas, % hashes distintos', total_rows, distinct_hashes;
  END IF;
END;
$$;

UPDATE public.sii_rcv_records
SET
  entity_rut = pg_temp.normalize_rut(entity_rut),
  counterpart_rut = pg_temp.normalize_rut(counterpart_rut),
  content_hash = encode(digest(
    pg_temp.normalize_rut(entity_rut) || '|' || book_type || '|' ||
    doc_type::text || '|' || folio::text || '|' ||
    pg_temp.normalize_rut(counterpart_rut) || '|' || total_amount::text,
    'sha256'), 'hex')
WHERE source = 'sii_import';

-- Verificación final: no debe quedar ningún counterpart_rut fuera de formato.
DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT count(*) INTO bad_count
  FROM public.sii_rcv_records
  WHERE source = 'sii_import'
    AND counterpart_rut !~ '^[0-9]{1,2}\.[0-9]{3}\.[0-9]{3}-[0-9K]$';

  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Quedaron % counterpart_rut sin normalizar tras la migración', bad_count;
  END IF;
END;
$$;

COMMIT;
