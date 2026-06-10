
ALTER TABLE public.company_data
  ADD COLUMN IF NOT EXISTS daily_report_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_report_emails text DEFAULT '',
  ADD COLUMN IF NOT EXISTS daily_report_hour integer DEFAULT 9;
