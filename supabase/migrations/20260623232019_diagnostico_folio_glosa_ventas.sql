-- ═══════════════════════════════════════════════════════════════════════
-- FASE A — Diagnóstico folio-en-glosa, lado VENTAS (read-only)
-- ═══════════════════════════════════════════════════════════════════════
-- Este archivo NO modifica datos. Solo emite RAISE NOTICE con resultados.
-- Se ejecuta como migración temporal para diagnóstico.

DO $$
DECLARE
  -- A.1 Incomes
  a1_total int;
  a1_sin_vinc int;
  a1_con_vinc int;

  -- A.2 Pares match
  a2_match int := 0;
  a2_no_vinc int := 0;
  a2_consistentes int := 0;
  a2_otra_fact int := 0;

  -- A.4 Payments
  a4_total int;
  a4_clientes int;
  a4_con_fact int := 0;

  -- A.5 Costs (ya se aplicó backfill, verificar)
  a5_costs_restantes int;
  a5_costs_actualizados int;

  r record;
  inv record;
  folio text;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  DIAGNÓSTICO FOLIO-EN-GLOSA — VENTAS (2026-06-23)      ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  -- ═══ A.1: Incomes con folio en glosa ═══
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE invoice_id IS NULL),
         COUNT(*) FILTER (WHERE invoice_id IS NOT NULL)
  INTO a1_total, a1_sin_vinc, a1_con_vinc
  FROM public.incomes i
  WHERE i.description ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})'
     OR i.notes ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})'
     OR i.bank_reference ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})';

  RAISE NOTICE '─── A.1: Incomes con folio en glosa ───';
  RAISE NOTICE '  Total: %', a1_total;
  RAISE NOTICE '    Sin invoice_id vinculado: %', a1_sin_vinc;
  RAISE NOTICE '    Ya vinculados: %', a1_con_vinc;
  RAISE NOTICE '';

  -- ═══ A.2: Coincidencias income ↔ invoice ═══
  FOR r IN
    SELECT i.id, i.client_id, i.amount, i.invoice_id,
      COALESCE(
        (REGEXP_MATCH(i.description, '(?:N[º°o]\s*|Folio\s+|folio\s+)(\d{3,})', 'i'))[1],
        (REGEXP_MATCH(i.notes,       '(?:N[º°o]\s*|Folio\s+|folio\s+)(\d{3,})', 'i'))[1],
        (REGEXP_MATCH(i.bank_reference, '(?:N[º°o]\s*|Folio\s+|folio\s+)(\d{3,})', 'i'))[1]
      ) AS folio
    FROM public.incomes i
    WHERE i.description ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})'
       OR i.notes ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})'
       OR i.bank_reference ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})'
  LOOP
    -- Buscar invoice que coincida por (client_id + total + folio)
    SELECT inv.id INTO inv
    FROM public.invoices inv
    WHERE inv.client_id = r.client_id
      AND inv.total = r.amount
      AND (TRIM(inv.numero_fiscal) = TRIM(r.folio) OR TRIM(inv.folio) = TRIM(r.folio))
    LIMIT 1;

    IF FOUND THEN
      a2_match := a2_match + 1;
      IF r.invoice_id IS NULL THEN
        a2_no_vinc := a2_no_vinc + 1;
      ELSIF r.invoice_id = inv.id THEN
        a2_consistentes := a2_consistentes + 1;
      ELSE
        a2_otra_fact := a2_otra_fact + 1;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE '─── A.2: Coincidencias (cliente + monto + folio) ───';
  RAISE NOTICE '  Pares match: %', a2_match;
  RAISE NOTICE '    No vinculados (oportunidad auto-link): %', a2_no_vinc;
  RAISE NOTICE '    Vinculados consistentes: %', a2_consistentes;
  RAISE NOTICE '    Vinculados a OTRA factura (posible error): %', a2_otra_fact;
  RAISE NOTICE '';

  -- ═══ A.3: Sample (top 10) ═══
  RAISE NOTICE '─── A.3: Sample ingresos con folio ───';
  FOR r IN
    SELECT i.id, i.client_id, i.amount, i.income_date, i.invoice_id,
      LEFT(i.description, 60) AS descrip,
      LEFT(i.notes, 60) AS notas,
      COALESCE(
        (REGEXP_MATCH(i.description, '(?:N[º°o]\s*|Folio\s+|folio\s+)(\d{3,})', 'i'))[1],
        (REGEXP_MATCH(i.notes,       '(?:N[º°o]\s*|Folio\s+|folio\s+)(\d{3,})', 'i'))[1],
        (REGEXP_MATCH(i.bank_reference, '(?:N[º°o]\s*|Folio\s+|folio\s+)(\d{3,})', 'i'))[1]
      ) AS folio
    FROM public.incomes i
    WHERE i.description ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})'
       OR i.notes ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})'
       OR i.bank_reference ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})'
    ORDER BY i.income_date DESC
    LIMIT 10
  LOOP
    RAISE NOTICE '  income=%, folio=%, amount=%, date=%, desc="%"',
      left(r.id::text, 8), r.folio, r.amount, r.income_date, r.descrip;
  END LOOP;
  RAISE NOTICE '';

  -- ═══ A.4: Payments ═══
  SELECT COUNT(*),
         COUNT(DISTINCT client_id)
  INTO a4_total, a4_clientes
  FROM public.payments p
  WHERE p.notes ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})'
     OR p.bank_reference ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})';

  -- Count payments with invoice match
  SELECT COUNT(*) INTO a4_con_fact
  FROM (
    SELECT DISTINCT p.id
    FROM public.payments p
    JOIN public.invoices invt
      ON invt.client_id = p.client_id
     AND invt.total = p.amount
    WHERE (p.notes ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})'
        OR p.bank_reference ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})')
      AND (
        TRIM(invt.numero_fiscal) = TRIM(COALESCE(
          (REGEXP_MATCH(p.notes, '(?:N[º°o]\s*|Folio\s+|folio\s+)(\d{3,})', 'i'))[1],
          (REGEXP_MATCH(p.bank_reference, '(?:N[º°o]\s*|Folio\s+|folio\s+)(\d{3,})', 'i'))[1]
        ))
        OR TRIM(invt.folio) = TRIM(COALESCE(
          (REGEXP_MATCH(p.notes, '(?:N[º°o]\s*|Folio\s+|folio\s+)(\d{3,})', 'i'))[1],
          (REGEXP_MATCH(p.bank_reference, '(?:N[º°o]\s*|Folio\s+|folio\s+)(\d{3,})', 'i'))[1]
        ))
      )
  ) matched;

  RAISE NOTICE '─── A.4: Payments con folio en glosa ───';
  RAISE NOTICE '  Total: %', a4_total;
  RAISE NOTICE '    Clientes afectados: %', a4_clientes;
  RAISE NOTICE '    Con factura match (monto+folio+cliente): %', a4_con_fact;
  RAISE NOTICE '';

  -- ═══ A.5: Costs post-backfill ═══
  SELECT COUNT(*) INTO a5_costs_restantes
  FROM public.costs
  WHERE document_number IS NULL
    AND description ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})';

  SELECT COUNT(*) INTO a5_costs_actualizados
  FROM public.costs
  WHERE document_number IS NOT NULL
    AND description ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})';

  RAISE NOTICE '─── A.5: Costs post-backfill ───';
  RAISE NOTICE '  Costs con document_number poblado desde patron: %', a5_costs_actualizados;
  RAISE NOTICE '  Costs pendientes (sin document_number): %', a5_costs_restantes;
  RAISE NOTICE '';

  -- ═══ RESUMEN ═══
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  RESUMEN FINAL';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  A.1 Incomes con folio: % (sin vinc: %, vinc: %)', a1_total, a1_sin_vinc, a1_con_vinc;
  RAISE NOTICE '  A.2 Pares match: % (no vinc: %, OK: %, otra: %)', a2_match, a2_no_vinc, a2_consistentes, a2_otra_fact;
  RAISE NOTICE '  A.4 Payments con folio: % (match fact: %)', a4_total, a4_con_fact;
  RAISE NOTICE '  A.5 Costs backfill: % actualizados, % restantes', a5_costs_actualizados, a5_costs_restantes;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;
