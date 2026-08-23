-- Respaldo por bloques: muchas tablas por petición, no una por petición.
--
-- Diagnóstico del 2026-08-23: el respaldo diario moría con "CPU Time exceeded"
-- a los 33 s. La causa no era el volumen —76.000 filas, las mismas que cuando
-- funcionaba— sino el número de viajes: 143 tablas significaban ~208 peticiones
-- a PostgREST de ~265 ms cada una. Solo el ida y vuelta agotaba el presupuesto.
--
-- Esta función arma un bloque con todas las tablas que quepan en un presupuesto
-- de bytes y dice por cuál seguir. El respaldo completo pasa a resolverse en
-- ~8 peticiones.
--
-- El presupuesto se evalúa SOLO entre tablas: una tabla nunca se parte por la
-- mitad. Así cada `-- ===== tabla =====` sigue teniendo su `-- N filas` con el
-- total correcto, que es lo que el simulacro de restauración usa para recortar
-- secciones. Una tabla más grande que el presupuesto se devuelve entera.

CREATE OR REPLACE FUNCTION public.backup_dump_chunk(
  p_start_table text DEFAULT NULL,
  p_max_bytes   int  DEFAULT 6000000,
  p_page        int  DEFAULT 5000
)
RETURNS TABLE (
  body          text,
  next_table    text,
  rows_by_table jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
-- Sin esto `float8::text` redondea y las coordenadas GPS no vuelven iguales.
SET extra_float_digits = 3
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
    v_parts := v_parts || format(E'-- ===== %s =====\n', v_tbl.name);

    v_offset := 0;
    v_rows := 0;
    LOOP
      v_query := format(
        'WITH page AS (SELECT * FROM public.%I ORDER BY %I OFFSET %s LIMIT %s)
         SELECT (SELECT count(*)::int FROM page),
                COALESCE((SELECT string_agg(format(%L, concat_ws('', '', %s)), E''\n'' ORDER BY t.%I) FROM page t), '''')',
        v_tbl.name, v_tbl.order_column, v_offset, p_page,
        v_template, v_values, v_tbl.order_column);
      EXECUTE v_query INTO v_page_rows, v_page_body;

      EXIT WHEN v_page_rows = 0;

      v_parts := v_parts || (v_page_body || E'\n');
      v_len := v_len + length(v_page_body) + 1;
      v_rows := v_rows + v_page_rows;
      v_offset := v_offset + v_page_rows;

      EXIT WHEN v_page_rows < p_page;
    END LOOP;

    v_counts := jsonb_set(v_counts, ARRAY[v_tbl.name], to_jsonb(v_rows));
    v_parts := v_parts || format(E'-- %s filas\n\n', v_rows);
  END LOOP;

  body := array_to_string(v_parts, '');
  next_table := NULL;
  rows_by_table := v_counts;
  RETURN NEXT;
END;
$fn$;

COMMENT ON FUNCTION public.backup_dump_chunk(text, int, int) IS
  'Un bloque del respaldo con tantas tablas completas como quepan en p_max_bytes, más la tabla por la que seguir. Solo service_role.';

REVOKE ALL ON FUNCTION public.backup_dump_chunk(text, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backup_dump_chunk(text, int, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_dump_chunk(text, int, int) TO service_role;

-- Sin consumidores tras el cambio: se retiran para no dejar código muerto.
DROP FUNCTION IF EXISTS public.backup_table_sql_page(text, text, bigint, int);
DROP FUNCTION IF EXISTS public.backup_table_inventory();
