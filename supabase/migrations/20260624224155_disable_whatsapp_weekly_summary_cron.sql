-- Desactivar pg_cron job "whatsapp-weekly-summary" (jobid=7).
-- Razón: la Edge Function whatsapp-weekly-summary NO está desplegada
-- ni existe en supabase/functions/, por lo que el cron está fallando
-- con 404 silencioso cada lunes a las 11:00 UTC desde su creación.
--
-- Si en el futuro se desea reactivar el resumen semanal, primero
-- desplegar la Edge Function y luego reactivar con:
--   SELECT cron.alter_job(7, active := true);
-- o re-schedulear con cron.schedule(...).

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobid = 7 AND jobname = 'whatsapp-weekly-summary') THEN
    PERFORM cron.alter_job(7, active := false);
    RAISE NOTICE 'pg_cron job 7 (whatsapp-weekly-summary) desactivado';
  ELSE
    RAISE NOTICE 'pg_cron job 7 no existe o tiene otro nombre - no se aplica cambio';
  END IF;
END $$;

COMMIT;
