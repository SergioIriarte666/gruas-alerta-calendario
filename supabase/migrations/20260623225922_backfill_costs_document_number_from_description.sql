BEGIN;

-- Backfill costs.document_number from invoice folios embedded in description.
-- This is strictly additive and never overwrites an existing document number.
CREATE TEMP TABLE _cost_document_number_backfill ON COMMIT DROP AS
SELECT
  c.id,
  (REGEXP_MATCH(c.description, '(?:N[º°o]\s*|Folio\s+|folio\s+)(\d{3,})', 'i'))[1] AS folio
FROM public.costs c
WHERE c.document_number IS NULL
  AND c.description ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})';

DO $$
DECLARE
  n_actualizados int;
BEGIN
  SELECT COUNT(*) INTO n_actualizados FROM _cost_document_number_backfill;
  RAISE NOTICE '[Backfill] % costs serán actualizados desde el folio de su descripción', n_actualizados;
END $$;

-- The paid-cost guard explicitly allows controlled synchronization through
-- this transaction-local setting. It is restored immediately after the update.
SELECT set_config('app.sync_in_progress', 'true', true);

UPDATE public.costs c
SET document_number = plan.folio
FROM _cost_document_number_backfill plan
WHERE c.id = plan.id
  AND c.document_number IS NULL;

SELECT set_config('app.sync_in_progress', 'false', true);

DO $$
DECLARE
  n_restantes int;
BEGIN
  SELECT COUNT(*) INTO n_restantes
  FROM public.costs
  WHERE document_number IS NULL
    AND description ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})';

  IF n_restantes > 0 THEN
    RAISE NOTICE '[Backfill] Quedan % costs con patrón folio sin actualizar — investigar', n_restantes;
  ELSE
    RAISE NOTICE '[Backfill] OK — todos los costs con patrón folio quedaron con document_number poblado';
  END IF;
END $$;

COMMIT;
