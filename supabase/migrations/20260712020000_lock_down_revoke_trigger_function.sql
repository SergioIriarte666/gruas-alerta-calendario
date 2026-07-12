BEGIN;

-- Postgres otorga EXECUTE a PUBLIC por defecto en funciones nuevas. Esta es
-- una funcion de trigger (SECURITY DEFINER) que no debe ser invocable
-- directamente via RPC publico (/rest/v1/rpc/...) por anon/authenticated —
-- solo debe correr como efecto del trigger AFTER UPDATE OF status ON services,
-- que no requiere EXECUTE grant para disparar. Hallazgo de Supabase Advisors.
REVOKE ALL ON FUNCTION public.revoke_tracking_links_on_service_close() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_tracking_links_on_service_close() FROM anon;
REVOKE ALL ON FUNCTION public.revoke_tracking_links_on_service_close() FROM authenticated;

COMMIT;
