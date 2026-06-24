BEGIN;
ALTER TABLE public.legacy_services DROP COLUMN IF EXISTS adjuster;
ALTER TABLE public.legacy_services DROP COLUMN IF EXISTS reference;
COMMIT;
