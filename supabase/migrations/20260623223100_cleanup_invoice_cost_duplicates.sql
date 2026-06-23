BEGIN;

-- Preserve operational costs and remove supplier invoices representing the
-- same supplier, amount, and folio embedded in the cost description.
CREATE TEMP TABLE _duplicate_pairs ON COMMIT DROP AS
WITH costs_con_folio AS (
  SELECT
    c.id AS cost_id,
    c.supplier_id AS cost_sid,
    c.amount,
    c.description,
    (REGEXP_MATCH(c.description, '(?:N[º°o]\s*|Folio\s+)(\d{3,})', 'i'))[1] AS folio
  FROM public.costs c
  WHERE c.supplier_id IS NOT NULL
    AND c.document_number IS NULL
    AND c.description ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})'
)
SELECT
  cf.cost_id,
  cf.folio,
  si.id AS si_id,
  si.source AS si_source,
  cf.amount
FROM costs_con_folio cf
JOIN public.supplier_invoices si
  ON TRIM(si.invoice_number) = TRIM(cf.folio)
 AND si.amount = cf.amount
 AND si.supplier_id = cf.cost_sid;

DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*) INTO n FROM _duplicate_pairs;
  RAISE NOTICE '[Cleanup] % pares cost↔factura duplicados detectados para limpieza', n;
  IF n <> 7 THEN
    RAISE EXCEPTION '[Cleanup] Se esperaban exactamente 7 pares confirmados; se detectaron %', n;
  END IF;
END $$;

-- Populate the preserved costs so future imports can use document_number.
-- The existing paid-cost guard explicitly permits controlled synchronization
-- through this transaction-local setting.
SELECT set_config('app.sync_in_progress', 'true', true);

UPDATE public.costs c
SET document_number = dp.folio
FROM _duplicate_pairs dp
WHERE c.id = dp.cost_id
  AND c.document_number IS NULL;

SELECT set_config('app.sync_in_progress', 'false', true);

-- Explicitly detach payments before deleting their duplicate invoices.
UPDATE public.supplier_payments sp
SET supplier_invoice_id = NULL
FROM _duplicate_pairs dp
WHERE sp.supplier_invoice_id = dp.si_id;

DELETE FROM public.supplier_invoices si
USING _duplicate_pairs dp
WHERE si.id = dp.si_id;

DO $$
DECLARE
  remaining int;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM public.costs c
  JOIN public.supplier_invoices si
    ON si.supplier_id = c.supplier_id
   AND TRIM(si.invoice_number) = TRIM(c.document_number)
   AND si.amount = c.amount
  WHERE c.document_number IS NOT NULL;

  IF remaining > 0 THEN
    RAISE NOTICE '[Cleanup] Quedan % pares cost↔factura con mismo (supplier+folio+monto) — revisar', remaining;
  ELSE
    RAISE NOTICE '[Cleanup] OK — 0 duplicados restantes';
  END IF;
END $$;

COMMIT;
