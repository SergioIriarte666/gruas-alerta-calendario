-- Commit the enum value before the batch-import functions may use it.
-- Some existing environments already have this value; clean baseline installs do not.
ALTER TYPE public.service_status ADD VALUE IF NOT EXISTS 'partially_invoiced';
