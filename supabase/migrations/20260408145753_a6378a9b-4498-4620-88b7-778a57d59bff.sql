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
BEGIN
  -- Validate: must start with SELECT or WITH
  normalized := upper(trim(query_text));
  IF NOT (normalized LIKE 'SELECT%' OR normalized LIKE 'WITH%') THEN
    RAISE EXCEPTION 'Solo se permiten consultas SELECT';
  END IF;
  
  -- Block dangerous keywords
  IF normalized ~ '\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXECUTE|EXEC)\b' THEN
    RAISE EXCEPTION 'Consulta contiene operaciones no permitidas';
  END IF;

  -- Execute and return as JSON
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query_text || ') t' INTO result;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Only allow service role to execute this function
REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM anon;
REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM authenticated;