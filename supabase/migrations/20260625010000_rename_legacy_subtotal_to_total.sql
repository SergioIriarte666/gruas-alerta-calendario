BEGIN;

ALTER TABLE public.legacy_services DROP COLUMN IF EXISTS total_clp;

ALTER TABLE public.legacy_services RENAME COLUMN subtotal_clp TO total_clp;

COMMIT;
