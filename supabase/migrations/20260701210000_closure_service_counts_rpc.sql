BEGIN;

-- Conteo de servicios por cierre, agregado en la base de datos.
-- Devuelve ~482 filas (una por cierre), evitando traer las ~1.339 filas de
-- closure_services al cliente y el conteo frágil por el lado del navegador.
CREATE OR REPLACE FUNCTION public.get_closure_service_counts()
RETURNS TABLE(closure_id uuid, service_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT cs.closure_id, count(*)::bigint AS service_count
  FROM public.closure_services cs
  GROUP BY cs.closure_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_closure_service_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_closure_service_counts() TO service_role;

COMMIT;
