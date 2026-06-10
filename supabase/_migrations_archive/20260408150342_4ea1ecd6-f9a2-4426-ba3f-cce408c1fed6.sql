CREATE OR REPLACE FUNCTION public.execute_readonly_query(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '5s'
AS $$
DECLARE
  result jsonb;
  normalized text;
  clean_query text;
BEGIN
  -- Clean trailing semicolons and whitespace
  clean_query := rtrim(trim(query_text), ';');
  
  -- Validate: must start with SELECT or WITH
  normalized := upper(trim(clean_query));
  IF NOT (normalized LIKE 'SELECT%' OR normalized LIKE 'WITH%') THEN
    RAISE EXCEPTION 'Solo se permiten consultas SELECT';
  END IF;
  
  -- Block dangerous keywords
  IF normalized ~ '\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b' THEN
    RAISE EXCEPTION 'Consulta contiene operaciones no permitidas';
  END IF;

  -- Execute and return as JSON
  EXECUTE 'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (' || clean_query || ') t' INTO result;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM anon;
REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM authenticated;