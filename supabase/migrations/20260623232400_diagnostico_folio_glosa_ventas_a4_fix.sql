-- Fix: A.4 Payments diagnosis (previous migration failed at A.4 due to var conflict)
DO $$
DECLARE
  a4_total int;
  a4_clientes int;
  a4_con_fact int := 0;
BEGIN
  -- Count payments with folio pattern
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
    JOIN public.invoices i2
      ON i2.client_id = p.client_id
     AND i2.total = p.amount
    WHERE (p.notes ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})'
        OR p.bank_reference ~* '(N[º°o]\s*\d{3,}|Folio\s+\d{3,})')
      AND (
        TRIM(i2.numero_fiscal) = TRIM(COALESCE(
          (REGEXP_MATCH(p.notes, '(?:N[º°o]\s*|Folio\s+|folio\s+)(\d{3,})', 'i'))[1],
          (REGEXP_MATCH(p.bank_reference, '(?:N[º°o]\s*|Folio\s+|folio\s+)(\d{3,})', 'i'))[1]
        ))
        OR TRIM(i2.folio) = TRIM(COALESCE(
          (REGEXP_MATCH(p.notes, '(?:N[º°o]\s*|Folio\s+|folio\s+)(\d{3,})', 'i'))[1],
          (REGEXP_MATCH(p.bank_reference, '(?:N[º°o]\s*|Folio\s+|folio\s+)(\d{3,})', 'i'))[1]
        ))
      )
  ) matched;

  RAISE NOTICE '═══ A.4: Payments con folio en glosa ═══';
  RAISE NOTICE '  Total: %', a4_total;
  RAISE NOTICE '    Clientes afectados: %', a4_clientes;
  RAISE NOTICE '    Con factura match (monto+folio+cliente): %', a4_con_fact;
END $$;
