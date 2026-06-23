-- ═══════════════════════════════════════════════════════════════════════
-- FASE B — Backfill seguro de costs.document_number desde description
-- ═══════════════════════════════════════════════════════════════════════
-- PRECONDICIÓN: Ejecutar primero el diagnóstico Fase A (A.5) en Supabase
-- SQL Editor. Si A.5 reporta 0 costs pendientes, esta migración es
-- inofensiva (UPDATE sin filas afectadas).
--
-- REGLAS:
--   - Solo costs con document_number = NULL
--   - Solo si description contiene patrón "N° XXXX" / "Folio XXXX" (min 3 digits)
--   - Nunca sobrescribe un document_number ya poblado
--   - Es estrictamente ADITIVO

BEGIN;

UPDATE public.costs c
SET document_number = (REGEXP_MATCH(c.description, '(?:N[º°o]\s*|Folio\s+|folio\s+)(\d{3,})', 'i'))[1]
WHERE c.document_number IS NULL
  AND c.description ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})';

-- Verificación post-backfill
DO $$
DECLARE
  n_restantes int;
  n_actualizados int;
BEGIN
  SELECT COUNT(*) INTO n_restantes
  FROM public.costs
  WHERE document_number IS NULL
    AND description ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})';

  SELECT COUNT(*) INTO n_actualizados
  FROM public.costs
  WHERE document_number IS NOT NULL
    AND description ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})';

  RAISE NOTICE '[Backfill] Costs con folio en desc y document_number poblado: %', n_actualizados;

  IF n_restantes > 0 THEN
    RAISE NOTICE '[Backfill] Quedan % costs con patron folio sin actualizar — investigar', n_restantes;
  ELSE
    RAISE NOTICE '[Backfill] OK — todos los costs con patron folio tienen document_number poblado';
  END IF;
END $$;

COMMIT;
