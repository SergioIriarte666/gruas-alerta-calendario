-- Generación del respaldo dentro de Postgres.
--
-- Armar los INSERT fila por fila en la edge function agotaba su presupuesto de
-- cómputo antes de terminar (143 tablas, ~75.000 filas): moría con
-- WORKER_RESOURCE_LIMIT. Postgres produce el mismo texto mucho más rápido, así
-- que la función solo transporta y comprime bytes.
--
-- Los valores se serializan con `col::text` + quote_nullable, no vía JSON: es la
-- única forma de que arrays ({1,2}), jsonb y enums vuelvan a entrar tal cual.

CREATE OR REPLACE FUNCTION public.backup_table_page(
  p_table        text,
  p_order_column text,
  p_offset       bigint,
  p_limit        int
)
RETURNS TABLE (rows_returned int, sql_text text, json_text text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
-- Sin esto, `float8::text` redondea y las coordenadas GPS no vuelven iguales:
-- el round-trip lo detectó en services.origin_lat/lng y destination_lat.
SET extra_float_digits = 3
AS $fn$
DECLARE
  v_oid      oid;
  v_collist  text;
  v_values   text;
  v_template text;
  v_query    text;
BEGIN
  -- p_table y p_order_column se validan contra el catálogo antes de
  -- interpolarse: sin esto la función sería un vector de inyección.
  SELECT c.oid INTO v_oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
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
            COALESCE((SELECT string_agg(format(%L, concat_ws('', '', %s)), E''\n'' ORDER BY t.%I) FROM page t), ''''),
            COALESCE((SELECT string_agg(to_jsonb(t)::text, '','' ORDER BY t.%I) FROM page t), '''')',
    p_table, p_order_column, p_offset, p_limit,
    v_template, v_values, p_order_column, p_order_column);

  RETURN QUERY EXECUTE v_query;
END;
$fn$;

COMMENT ON FUNCTION public.backup_table_page(text, text, bigint, int) IS
  'Una página de una tabla de public, ya serializada como INSERTs y como JSON. Solo service_role.';

REVOKE ALL ON FUNCTION public.backup_table_page(text, text, bigint, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backup_table_page(text, text, bigint, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_table_page(text, text, bigint, int) TO service_role;
