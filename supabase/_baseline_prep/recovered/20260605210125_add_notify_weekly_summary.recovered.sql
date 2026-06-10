-- Recuperado de supabase_migrations.schema_migrations (version 20260605210125,
-- name "add_notify_weekly_summary") el 2026-06-10. Aplicada en remoto sin
-- archivo local. NO re-aplicar: la columna ya existe en produccion.

ALTER TABLE public.whatsapp_settings ADD COLUMN IF NOT EXISTS notify_weekly_summary BOOLEAN NOT NULL DEFAULT true;
COMMENT ON COLUMN public.whatsapp_settings.notify_weekly_summary IS 'Enviar resumen semanal de métricas a admins cada lunes a las 08:00';
