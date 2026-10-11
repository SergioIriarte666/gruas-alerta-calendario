-- El 2026-10-03 el dump dejó de caber en la memoria de la Edge Function.
-- La v1 enviaba una tabla completa aunque superara p_max_bytes. La v2 corta
-- dentro de las tablas y conserva un único encabezado y el total al cerrarlas.
-- La v1 se conserva para desplegar DB antes que la función sin interrumpirla.
CREATE OR REPLACE FUNCTION public.backup_dump_chunk_v2(
  p_start_table text DEFAULT NULL,
  p_max_bytes   int  DEFAULT 6000000,
  p_page        int  DEFAULT 1000,
  p_start_offset bigint DEFAULT 0
)
RETURNS TABLE (
  body          text,
  next_table    text,
  next_offset   bigint,
  rows_by_table jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
-- Sin esto `float8::text` redondea y las coordenadas GPS no vuelven iguales.
SET extra_float_digits = 3
SET statement_timeout = '90s'
AS $fn$
DECLARE
  v_tbl       record;
  v_collist   text;
  v_values    text;
  v_template  text;
  v_query     text;
  v_page_rows int;
  v_page_body text;
  v_offset    bigint;
  v_rows      bigint;
  v_parts     text[] := '{}';
  v_len       bigint := 0;
  v_counts    jsonb  := '{}'::jsonb;
  v_started   boolean;
BEGIN
  IF p_max_bytes <= 0 OR p_page <= 0 OR p_start_offset < 0
     OR (p_start_table IS NULL AND p_start_offset <> 0) THEN
    RAISE EXCEPTION 'Cursor o tamaño de bloque inválido';
  END IF;
  IF p_start_table IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relname=p_start_table
  ) THEN
    RAISE EXCEPTION 'Tabla de continuación desconocida: %', p_start_table;
  END IF;
  v_started := p_start_table IS NULL;

  FOR v_tbl IN
    SELECT c.relname::text AS name,
           COALESCE(
             (SELECT a.attname::text FROM pg_index i
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
               WHERE i.indrelid = c.oid AND i.indisprimary LIMIT 1),
             (SELECT a.attname::text FROM pg_attribute a
               WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
               ORDER BY a.attnum LIMIT 1)
           ) AS order_column,
           c.oid
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    IF NOT v_started THEN
      IF v_tbl.name = p_start_table THEN
        v_started := true;
      ELSE
        CONTINUE;
      END IF;
    END IF;

    -- Presupuesto agotado: se corta ANTES de empezar esta tabla.
    IF v_len >= p_max_bytes THEN
      body := array_to_string(v_parts, '');
      next_table := v_tbl.name;
      next_offset := 0;
      rows_by_table := v_counts;
      RETURN NEXT;
      RETURN;
    END IF;

    SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum),
           string_agg(format('quote_nullable(t.%I::text)', attname), ', ' ORDER BY attnum)
      INTO v_collist, v_values
    FROM pg_attribute
    WHERE attrelid = v_tbl.oid AND attnum > 0 AND NOT attisdropped;

    v_template := format('INSERT INTO public.%I (%s) VALUES (%%s);', v_tbl.name, v_collist);
    v_offset := CASE WHEN v_tbl.name = p_start_table THEN p_start_offset ELSE 0 END;
    v_rows := v_offset;
    IF v_offset = 0 THEN
      v_parts := v_parts || format(E'-- ===== %s =====\n', v_tbl.name);
    END IF;
    LOOP
      -- Serializar una página en Postgres y devolver solo las filas que caben.
      -- Incluir siempre la primera evita estancarse ante una fila grande.
      v_query := format(
        'WITH page AS MATERIALIZED (
           SELECT row_number() OVER (ORDER BY %I) AS rn,
                  format(%L, concat_ws('', '', %s)) AS line
           FROM (SELECT * FROM public.%I ORDER BY %I OFFSET %s LIMIT %s) t
         ), sized AS (
           SELECT *, COALESCE(sum(octet_length(line)+1) OVER
             (ORDER BY rn ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) AS bytes_before
           FROM page
         ), chosen AS (
           SELECT * FROM sized WHERE bytes_before < %s
         )
         SELECT count(*)::int, COALESCE(string_agg(line, E''\n'' ORDER BY rn), '''') FROM chosen',
        v_tbl.order_column, v_template, v_values,
        v_tbl.name, v_tbl.order_column, v_offset, p_page,
        greatest(p_max_bytes-v_len,1));
      EXECUTE v_query INTO v_page_rows, v_page_body;

      EXIT WHEN v_page_rows = 0;

      v_parts := v_parts || (v_page_body || E'\n');
      v_len := v_len + octet_length(v_page_body) + 1;
      v_rows := v_rows + v_page_rows;
      v_offset := v_offset + v_page_rows;

      -- Solo una lectura vacía termina la tabla: una página corta puede
      -- deberse al presupuesto de bytes, no al fin de los datos.
      IF v_len >= p_max_bytes THEN
        v_counts := jsonb_set(v_counts, ARRAY[v_tbl.name],
          to_jsonb(v_offset - CASE WHEN v_tbl.name=p_start_table THEN p_start_offset ELSE 0 END));
        body := array_to_string(v_parts, '');
        next_table := v_tbl.name;
        next_offset := v_offset;
        rows_by_table := v_counts;
        RETURN NEXT;
        RETURN;
      END IF;
    END LOOP;

    v_counts := jsonb_set(v_counts, ARRAY[v_tbl.name], to_jsonb(v_rows - CASE WHEN v_tbl.name=p_start_table THEN p_start_offset ELSE 0 END));
    v_parts := v_parts || format(E'-- %s filas\n\n', v_rows);
  END LOOP;

  body := array_to_string(v_parts, '');
  next_table := NULL;
  next_offset := 0;
  rows_by_table := v_counts;
  RETURN NEXT;
END;
$fn$;

COMMENT ON FUNCTION public.backup_dump_chunk_v2(text, int, int, bigint) IS
  'Respaldo paginado por bytes y filas, conservando marcadores de tabla y cursor. Solo service_role.';

REVOKE ALL ON FUNCTION public.backup_dump_chunk_v2(text, int, int, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backup_dump_chunk_v2(text, int, int, bigint) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_dump_chunk_v2(text, int, int, bigint) TO service_role;

-- No cortar a los 5 s las operaciones que generan/copían/restauran archivos.
DO $cron$
DECLARE job record;
BEGIN
  FOR job IN SELECT jobid, command FROM cron.job WHERE jobname IN (
    'scheduled-backup-email-hourly','sync-backups-to-r2-hourly','verify-backup-restore-monthly'
  ) LOOP
    IF job.command NOT LIKE '%timeout_milliseconds%' THEN
      PERFORM cron.alter_job(job.jobid, command := replace(
        job.command, 'body :=', 'timeout_milliseconds := 120000, body :='
      ));
    END IF;
  END LOOP;
END;
$cron$;
