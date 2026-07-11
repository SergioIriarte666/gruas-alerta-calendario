BEGIN;

-- La migracion anterior (20260711000000) revoco solo de PUBLIC, pero Supabase
-- otorga EXECUTE a anon por defecto para funciones nuevas en el schema public
-- (mismo problema ya visto en create_service_tracking_link). Revocar explicito.
REVOKE EXECUTE ON FUNCTION public.upsert_service_origin_location(uuid, text, double precision, double precision, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_service_origin_location(uuid, text, double precision, double precision, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_service_origin_location(uuid, text, double precision, double precision, boolean) TO authenticated;

COMMIT;
