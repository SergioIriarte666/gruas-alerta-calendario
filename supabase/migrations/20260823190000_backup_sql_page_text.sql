-- Página del respaldo como texto plano, no como JSON.
--
-- `backup_table_page` devolvía sql_text y json_text dentro de una respuesta
-- JSON: cada página viajaba dos veces y había que parsear ~130 MB de JSON por
-- corrida. Eso agotó el presupuesto de CPU de la edge function y el respaldo
-- diario dejó de generarse el 2026-08-20 (CPU Time exceeded a los 33 s).
--
-- Ahora devuelve `text` y se pide con `Accept: text/plain`, así que PostgREST
-- entrega el contenido crudo: ni escape ni parseo. El conteo de filas viaja en
-- la primera línea para no necesitar una segunda consulta ni contar en JS.
--
-- Formato: "<n>\n<INSERTs>"

CREATE OR REPLACE FUNCTION public.backup_table_sql_page(
  p_table        text,
  p_order_column text,
  p_offset       bigint,
  p_limit        int
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
-- Sin esto `float8::text` redondea y las coordenadas GPS no vuelven iguales.
SET extra_float_digits = 3
AS $fn$
DECLARE
  v_oid      oid;
  v_collist  text;
  v_values   text;
  v_template text;
  v_query    text;
  v_rows     int;
  v_body     text;
BEGIN
  -- p_table y p_order_column se validan contra el catálogo antes de
  -- interpolarse: sin esto la función sería un vector de inyección.
  SELECT c.oid INTO v_oid
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = p_table;
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Tabla desconocida: %', p_table;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = v_oid AND attnum > 0 AND NOT attisdropped
      AND attname = p_order_column
  ) THEN
    RAISE EXCEPTION 'Columna de orden desconocida: %.%', p_table, p_order_column;
  END IF;

  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum),
         string_agg(format('quote_nullable(t.%I::text)', attname), ', ' ORDER BY attnum)
    INTO v_collist, v_values
  FROM pg_attribute
  WHERE attrelid = v_oid AND attnum > 0 AND NOT attisdropped;

  v_template := format('INSERT INTO public.%I (%s) VALUES (%%s);', p_table, v_collist);

  v_query := format(
    'WITH page AS (SELECT * FROM public.%I ORDER BY %I OFFSET %s LIMIT %s)
     SELECT (SELECT count(*)::int FROM page),
            COALESCE((SELECT string_agg(format(%L, concat_ws('', '', %s)), E''\n'' ORDER BY t.%I) FROM page t), '''')',
    p_table, p_order_column, p_offset, p_limit,
    v_template, v_values, p_order_column);

  EXECUTE v_query INTO v_rows, v_body;
  RETURN v_rows::text || E'\n' || v_body;
END;
$fn$;

COMMENT ON FUNCTION public.backup_table_sql_page(text, text, bigint, int) IS
  'Una página de una tabla como texto plano: primera línea el número de filas, luego los INSERTs. Solo service_role.';

REVOKE ALL ON FUNCTION public.backup_table_sql_page(text, text, bigint, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backup_table_sql_page(text, text, bigint, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_table_sql_page(text, text, bigint, int) TO service_role;

-- La versión JSON queda sin consumidores: se retira para no dejar código muerto
-- ni una segunda forma de hacer lo mismo.
DROP FUNCTION IF EXISTS public.backup_table_page(text, text, bigint, int);
