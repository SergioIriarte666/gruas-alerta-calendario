-- Inventario de tablas para el respaldo automático.
--
-- El respaldo diario venía con una lista de tablas escrita a mano en la edge
-- function: cubría 16 de 143 tablas y nadie se enteraba, porque el archivo se
-- generaba "completed" igual. Con esta función la lista se resuelve contra el
-- catálogo en cada corrida, así que una tabla nueva entra sola al respaldo.
--
-- Devuelve además la columna por la que paginar: sin un ORDER BY estable, dos
-- páginas consecutivas de PostgREST pueden repetir u omitir filas.

CREATE OR REPLACE FUNCTION public.backup_table_inventory()
RETURNS TABLE (
  table_name     text,
  order_column   text,
  estimated_rows bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    c.relname::text AS table_name,
    COALESCE(
      -- primera columna de la clave primaria
      (SELECT a.attname::text
         FROM pg_index i
         JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
        WHERE i.indrelid = c.oid AND i.indisprimary
        LIMIT 1),
      -- sin PK: la primera columna de la tabla
      (SELECT a.attname::text
         FROM pg_attribute a
        WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum
        LIMIT 1)
    ) AS order_column,
    GREATEST(c.reltuples, 0)::bigint AS estimated_rows
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
  ORDER BY c.relname;
$$;

COMMENT ON FUNCTION public.backup_table_inventory() IS
  'Tablas de public a respaldar, con la columna de orden para paginar de forma estable. Solo service_role.';

REVOKE ALL ON FUNCTION public.backup_table_inventory() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backup_table_inventory() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_table_inventory() TO service_role;
