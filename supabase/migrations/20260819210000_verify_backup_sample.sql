-- Prueba de restauración: ejecuta un trozo real del respaldo y lo compara.
--
-- Un respaldo no probado no es un respaldo. Esta función restaura las filas de
-- una tabla tal como están escritas en el archivo y las compara con producción.
-- Es la prueba que detectó que `float8::text` redondeaba las coordenadas GPS;
-- comparar por lectura del código no lo habría visto.
--
-- Seguridad: el SQL del archivo se ejecuta dentro de una subtransacción que
-- SIEMPRE se revierte. Los bloques BEGIN/EXCEPTION de plpgsql crean un
-- savepoint, así que cualquier efecto —incluido un DROP inesperado— desaparece.
-- Las variables no son transaccionales, de modo que los conteos sobreviven al
-- rollback y se pueden devolver.

CREATE OR REPLACE FUNCTION public.verify_backup_sample(
  p_table   text,
  p_inserts text
)
RETURNS TABLE (
  rows_restored   int,
  rows_identical  int,
  rows_differing  int,
  rows_only_in_backup int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET extra_float_digits = 3
AS $fn$
DECLARE
  v_oid        oid;
  v_prefix     text;
  v_rewritten  text;
  v_restored   int := 0;
  v_identical  int := 0;
  v_differing  int := 0;
  v_only       int := 0;
  v_pk         text;
BEGIN
  SELECT c.oid INTO v_oid
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = p_table;
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Tabla desconocida: %', p_table;
  END IF;

  SELECT a.attname::text INTO v_pk
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
  WHERE i.indrelid = v_oid AND i.indisprimary
  LIMIT 1;
  IF v_pk IS NULL THEN
    RAISE EXCEPTION 'La tabla % no tiene clave primaria: no es comparable', p_table;
  END IF;

  v_prefix := format('INSERT INTO public.%I (', p_table);

  -- Todo INSERT del texto debe apuntar a la tabla pedida. No es la defensa
  -- principal —esa es el rollback— pero descarta un archivo equivocado antes
  -- de ejecutarlo.
  IF (length(p_inserts) - length(replace(p_inserts, 'INSERT INTO ', ''))) / length('INSERT INTO ')
     <> (length(p_inserts) - length(replace(p_inserts, v_prefix, ''))) / length(v_prefix) THEN
    RAISE EXCEPTION 'El texto contiene INSERTs que no apuntan a public.%', p_table;
  END IF;

  EXECUTE format(
    'CREATE TEMP TABLE _verify_sample (LIKE public.%I) ON COMMIT DROP', p_table);

  v_rewritten := replace(p_inserts, v_prefix, 'INSERT INTO _verify_sample (');

  BEGIN
    EXECUTE v_rewritten;

    EXECUTE 'SELECT count(*) FROM _verify_sample' INTO v_restored;

    EXECUTE format(
      'SELECT
         count(*) FILTER (WHERE to_jsonb(o) IS NOT DISTINCT FROM to_jsonb(s)),
         count(*) FILTER (WHERE to_jsonb(o) IS DISTINCT FROM to_jsonb(s))
       FROM _verify_sample o
       JOIN public.%I s ON s.%I = o.%I', p_table, v_pk, v_pk)
    INTO v_identical, v_differing;

    EXECUTE format(
      'SELECT count(*) FROM _verify_sample o
        WHERE NOT EXISTS (SELECT 1 FROM public.%I s WHERE s.%I = o.%I)',
      p_table, v_pk, v_pk)
    INTO v_only;

    -- Fuerza el rollback del sandbox conservando los conteos.
    RAISE EXCEPTION 'VERIFY_SANDBOX_ROLLBACK';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'VERIFY_SANDBOX_ROLLBACK' THEN
        RAISE EXCEPTION 'El respaldo no se pudo restaurar: %', SQLERRM;
      END IF;
  END;

  rows_restored := v_restored;
  rows_identical := v_identical;
  rows_differing := v_differing;
  rows_only_in_backup := v_only;
  RETURN NEXT;
END;
$fn$;

COMMENT ON FUNCTION public.verify_backup_sample(text, text) IS
  'Restaura un trozo del respaldo en una tabla temporal y lo compara con producción. Todo efecto se revierte. Solo service_role.';

REVOKE ALL ON FUNCTION public.verify_backup_sample(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_backup_sample(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_backup_sample(text, text) TO service_role;
