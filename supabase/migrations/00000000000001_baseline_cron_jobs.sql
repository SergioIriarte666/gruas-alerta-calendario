-- ============================================================================
-- COMPLEMENTO BASELINE — pg_cron: jobs vivos en cron.job de produccion
-- Un dump del esquema public NO incluye los jobs (viven en el esquema cron).
-- ============================================================================
-- jobid 1 | active: t
SELECT cron.schedule('cleanup-orphaned-costs', '0 2 * * *', 'SELECT cleanup_orphaned_supplier_costs();');

-- jobid 2 | active: t
SELECT cron.schedule('send-daily-pending-report', '0 12 * * 1-5', '
  SELECT
    net.http_post(
        url:=''https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/send-daily-pending-report'',
        headers:=''{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impxc3p4bGp0ZnVrbmh1dnVoZWtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4NjcxMDEsImV4cCI6MjA2NTQ0MzEwMX0.vsTKjDOp6_eTi4IaOEOfABfEtJEtUPtUa_WmZ-QLZic"}''::jsonb,
        body:=''{}''::jsonb
    ) AS request_id;
  ');

-- jobid 3 | active: t
SELECT cron.schedule('send-daily-pending-report-hourly', '5 * * * *', '
  SELECT net.http_post(
    url := ''https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/send-daily-pending-report'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''x-cron-secret'', (
        SELECT value
        FROM public.internal_scheduler_secrets
        WHERE key = ''daily_pending_report_cron''
      )
    ),
    body := jsonb_build_object(
      ''source'', ''pg_cron''
    )
  );
  ');

-- jobid 4 | active: t
SELECT cron.schedule('generate-auto-backup-daily', '15 3 * * *', '
  SELECT net.http_post(
    url := ''https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/generate-backup'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''x-cron-secret'', (
        SELECT value
        FROM public.internal_scheduler_secrets
        WHERE key = ''generate_backup_cron''
      )
    ),
    body := jsonb_build_object(
      ''source'', ''pg_cron''
    )
  );
  ');

-- jobid 5 | active: t
SELECT cron.schedule('scheduled-backup-email-hourly', '5 * * * *', '
  SELECT net.http_post(
    url := ''https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/scheduled-backup-email'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''x-cron-secret'', (SELECT value FROM public.internal_scheduler_secrets WHERE key = ''scheduled_backup_email_cron'')
    ),
    body := ''{}''::jsonb
  );
  ');

-- jobid 6 | active: t
SELECT cron.schedule('whatsapp-daily-alerts', '0 11 * * 1-5', '
  SELECT net.http_post(
    url := ''https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/whatsapp-daily-alerts'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''x-cron-secret'', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = ''CRON_SECRET''
        LIMIT 1
      )
    ),
    body := jsonb_build_object(
      ''source'', ''pg_cron''
    )
  );
  ');

-- jobid 7 | active: t
SELECT cron.schedule('whatsapp-weekly-summary', '0 11 * * 1', '
  SELECT net.http_post(
    url := ''https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/whatsapp-weekly-summary'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''x-cron-secret'', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = ''CRON_SECRET''
        LIMIT 1
      )
    ),
    body := jsonb_build_object(''source'', ''pg_cron'')
  );
  ');

