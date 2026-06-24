BEGIN;

DROP INDEX IF EXISTS public.idx_legacy_services_expediente_unique;

CREATE INDEX IF NOT EXISTS idx_legacy_services_expediente
  ON public.legacy_services(expediente);

COMMIT;
