ALTER TABLE public.company_data 
  ADD COLUMN IF NOT EXISTS report_timezone text NOT NULL DEFAULT 'America/Santiago',
  ADD COLUMN IF NOT EXISTS report_use_system_timezone boolean NOT NULL DEFAULT false;