BEGIN;

-- La migracion anterior (20260710210000) revoco solo de PUBLIC, pero Supabase
-- otorga EXECUTE a anon por defecto para funciones nuevas en el schema public,
-- asi que anon conservaba acceso a esta RPC SECURITY DEFINER. Revocar explicito.
REVOKE EXECUTE ON FUNCTION public.create_service_tracking_link(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_service_tracking_link(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_service_tracking_link(uuid) TO authenticated;

COMMIT;
