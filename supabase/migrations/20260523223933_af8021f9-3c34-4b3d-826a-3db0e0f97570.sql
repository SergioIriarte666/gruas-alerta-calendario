-- Bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups-auto', 'backups-auto', false)
ON CONFLICT (id) DO NOTHING;

-- Tabla de configuración (singleton)
CREATE TABLE IF NOT EXISTS public.backup_email_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  recipient_email text NOT NULL DEFAULT 'asistencia@gruas5norte.cl',
  schedule_hour integer NOT NULL DEFAULT 3 CHECK (schedule_hour >= 0 AND schedule_hour <= 23),
  signed_url_days integer NOT NULL DEFAULT 7 CHECK (signed_url_days BETWEEN 1 AND 30),
  last_sent_at timestamptz,
  last_status text,
  last_error text,
  last_sql_size_bytes bigint,
  last_json_size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.backup_email_config (enabled, recipient_email, schedule_hour)
SELECT false, 'asistencia@gruas5norte.cl', 3
WHERE NOT EXISTS (SELECT 1 FROM public.backup_email_config);

ALTER TABLE public.backup_email_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view backup email config" ON public.backup_email_config;
CREATE POLICY "Admins can view backup email config"
  ON public.backup_email_config FOR SELECT TO authenticated
  USING (public.is_admin_user_safe());

DROP POLICY IF EXISTS "Admins can update backup email config" ON public.backup_email_config;
CREATE POLICY "Admins can update backup email config"
  ON public.backup_email_config FOR UPDATE TO authenticated
  USING (public.is_admin_user_safe()) WITH CHECK (public.is_admin_user_safe());

DROP POLICY IF EXISTS "Admins can insert backup email config" ON public.backup_email_config;
CREATE POLICY "Admins can insert backup email config"
  ON public.backup_email_config FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user_safe());

DROP TRIGGER IF EXISTS trg_backup_email_config_updated_at ON public.backup_email_config;
CREATE TRIGGER trg_backup_email_config_updated_at
  BEFORE UPDATE ON public.backup_email_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Secret para autenticar al cron
INSERT INTO public.internal_scheduler_secrets (key, value)
SELECT 'scheduled_backup_email_cron', encode(gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (
  SELECT 1 FROM public.internal_scheduler_secrets WHERE key = 'scheduled_backup_email_cron'
);

-- pg_cron job: cada hora (la edge function decide si toca enviar)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scheduled-backup-email-hourly') THEN
    PERFORM cron.unschedule('scheduled-backup-email-hourly');
  END IF;
END $$;

SELECT cron.schedule(
  'scheduled-backup-email-hourly',
  '5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/scheduled-backup-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.internal_scheduler_secrets WHERE key = 'scheduled_backup_email_cron')
    ),
    body := '{}'::jsonb
  );
  $cron$
);