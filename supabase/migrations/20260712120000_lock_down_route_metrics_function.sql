BEGIN;

-- Postgres otorga EXECUTE a PUBLIC por defecto en funciones nuevas, lo que
-- dejaba a compute_service_route_metrics invocable por anon (sin login) via
-- /rest/v1/rpc/compute_service_route_metrics. Es SECURITY DEFINER y escribe
-- bypassando RLS, así que debe quedar restringida a authenticated, igual que
-- create_service_tracking_link (patrón del proyecto, hallazgo de Supabase
-- Advisors aplicado también en 20260712020000_lock_down_revoke_trigger_function.sql).
REVOKE ALL ON FUNCTION public.compute_service_route_metrics(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compute_service_route_metrics(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.compute_service_route_metrics(uuid) TO authenticated;

COMMIT;
