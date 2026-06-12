CREATE OR REPLACE FUNCTION public.list_bank_statement_invoice_candidates(p_movement_id uuid)
RETURNS TABLE (
  invoice_id uuid,
  folio text,
  numero_fiscal text,
  client_id uuid,
  client_name text,
  client_rut text,
  total numeric,
  issue_date date,
  due_date date,
  match_score integer,
  match_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_movement public.bank_statement_movements%ROWTYPE;
  v_payload_text text;
  v_haystack_text text;
  v_haystack_norm text;
  v_haystack_compact text;
  v_haystack_digits text;
  v_reference_compact text;
  v_payer_norm text;
BEGIN
  SELECT *
  INTO v_movement
  FROM public.bank_statement_movements
  WHERE id = p_movement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimiento bancario no encontrado';
  END IF;

  IF v_movement.amount <= 0 THEN
    RETURN;
  END IF;

  SELECT coalesce(string_agg(value, ' '), '')
  INTO v_payload_text
  FROM jsonb_each_text(coalesce(v_movement.raw_payload, '{}'::jsonb));

  v_haystack_text := concat_ws(
    ' ',
    coalesce(v_movement.description, ''),
    coalesce(v_movement.reference_id, ''),
    coalesce(v_movement.payer_name, ''),
    coalesce(v_payload_text, '')
  );

  v_haystack_norm := trim(
    regexp_replace(
      lower(public.unaccent(v_haystack_text)),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );

  v_haystack_compact := regexp_replace(v_haystack_norm, '\s+', '', 'g');
  v_haystack_digits := regexp_replace(lower(coalesce(v_haystack_text, '')), '[^0-9k]+', '', 'g');
  v_reference_compact := nullif(
    regexp_replace(lower(public.unaccent(coalesce(v_movement.reference_id, ''))), '[^a-z0-9]+', '', 'g'),
    ''
  );
  v_payer_norm := nullif(
    trim(regexp_replace(lower(public.unaccent(coalesce(v_movement.payer_name, ''))), '[^a-z0-9]+', ' ', 'g')),
    ''
  );

  RETURN QUERY
  WITH candidate_base AS (
    SELECT
      i.id AS invoice_id,
      i.folio,
      i.numero_fiscal,
      i.client_id,
      c.name::text AS client_name,
      c.rut::text AS client_rut,
      i.total,
      i.issue_date,
      i.due_date,
      nullif(
        regexp_replace(lower(public.unaccent(coalesce(i.numero_fiscal, ''))), '[^a-z0-9]+', '', 'g'),
        ''
      ) AS numero_fiscal_compact,
      nullif(
        regexp_replace(lower(public.unaccent(coalesce(i.folio, ''))), '[^a-z0-9]+', '', 'g'),
        ''
      ) AS folio_compact,
      nullif(regexp_replace(lower(coalesce(c.rut, '')), '[^0-9k]+', '', 'g'), '') AS client_rut_compact,
      trim(
        regexp_replace(
          lower(public.unaccent(coalesce(c.name, ''))),
          '[^a-z0-9]+',
          ' ',
          'g'
        )
      ) AS client_name_norm
    FROM public.invoices i
    JOIN public.clients c ON c.id = i.client_id
    WHERE i.total = v_movement.amount
      AND coalesce(i.paid_amount, 0) = 0
      AND coalesce(i.remaining_amount, i.total) = i.total
      AND i.status IN ('sent', 'overdue')
  ),
  candidate_signals AS (
    SELECT
      candidate.*,
      (
        SELECT count(*)
        FROM unnest(regexp_split_to_array(candidate.client_name_norm, '\s+')) AS token
        WHERE length(token) >= 4
      )::integer AS client_token_total,
      (
        SELECT count(*)
        FROM unnest(regexp_split_to_array(candidate.client_name_norm, '\s+')) AS token
        WHERE length(token) >= 4
          AND position(' ' || token || ' ' IN ' ' || v_haystack_norm || ' ') > 0
      )::integer AS client_token_hits
    FROM candidate_base candidate
  ),
  scored AS (
    SELECT
      candidate.invoice_id,
      candidate.folio,
      candidate.numero_fiscal,
      candidate.client_id,
      candidate.client_name,
      candidate.client_rut,
      candidate.total,
      candidate.issue_date,
      candidate.due_date,
      (
        CASE
          WHEN v_reference_compact IS NOT NULL
            AND candidate.numero_fiscal_compact IS NOT NULL
            AND v_reference_compact = candidate.numero_fiscal_compact THEN 220
          ELSE 0
        END
        + CASE
          WHEN v_reference_compact IS NOT NULL
            AND candidate.folio_compact IS NOT NULL
            AND v_reference_compact = candidate.folio_compact THEN 160
          ELSE 0
        END
        + CASE
          WHEN candidate.numero_fiscal_compact IS NOT NULL
            AND position(candidate.numero_fiscal_compact IN v_haystack_compact) > 0 THEN 140
          ELSE 0
        END
        + CASE
          WHEN candidate.folio_compact IS NOT NULL
            AND position(candidate.folio_compact IN v_haystack_compact) > 0 THEN 90
          ELSE 0
        END
        + CASE
          WHEN candidate.client_rut_compact IS NOT NULL
            AND position(candidate.client_rut_compact IN v_haystack_digits) > 0 THEN 80
          ELSE 0
        END
        + CASE
          WHEN v_payer_norm IS NOT NULL
            AND candidate.client_name_norm <> ''
            AND (
              position(candidate.client_name_norm IN v_payer_norm) > 0
              OR position(v_payer_norm IN candidate.client_name_norm) > 0
            ) THEN 55
          ELSE 0
        END
        + CASE
          WHEN candidate.client_name_norm <> ''
            AND position(candidate.client_name_norm IN v_haystack_norm) > 0 THEN 40
          ELSE 0
        END
        + CASE
          WHEN candidate.client_token_total > 0
            AND candidate.client_token_hits = candidate.client_token_total THEN 25
          ELSE 0
        END
        + CASE
          WHEN candidate.client_token_hits > 0 THEN 10
          ELSE 0
        END
      )::integer AS match_score,
      nullif(
        array_to_string(
          array_remove(
            ARRAY[
              CASE
                WHEN v_reference_compact IS NOT NULL
                  AND candidate.numero_fiscal_compact IS NOT NULL
                  AND v_reference_compact = candidate.numero_fiscal_compact
                THEN 'Referencia exacta con numero fiscal'
                ELSE NULL
              END,
              CASE
                WHEN v_reference_compact IS NOT NULL
                  AND candidate.folio_compact IS NOT NULL
                  AND v_reference_compact = candidate.folio_compact
                THEN 'Referencia exacta con folio'
                ELSE NULL
              END,
              CASE
                WHEN candidate.numero_fiscal_compact IS NOT NULL
                  AND position(candidate.numero_fiscal_compact IN v_haystack_compact) > 0
                THEN 'Numero fiscal detectado en cartola'
                ELSE NULL
              END,
              CASE
                WHEN candidate.folio_compact IS NOT NULL
                  AND position(candidate.folio_compact IN v_haystack_compact) > 0
                THEN 'Folio detectado en cartola'
                ELSE NULL
              END,
              CASE
                WHEN candidate.client_rut_compact IS NOT NULL
                  AND position(candidate.client_rut_compact IN v_haystack_digits) > 0
                THEN 'RUT cliente detectado'
                ELSE NULL
              END,
              CASE
                WHEN v_payer_norm IS NOT NULL
                  AND candidate.client_name_norm <> ''
                  AND (
                    position(candidate.client_name_norm IN v_payer_norm) > 0
                    OR position(v_payer_norm IN candidate.client_name_norm) > 0
                  )
                THEN 'Ordenante compatible con cliente'
                ELSE NULL
              END,
              CASE
                WHEN candidate.client_name_norm <> ''
                  AND position(candidate.client_name_norm IN v_haystack_norm) > 0
                THEN 'Nombre cliente mencionado'
                ELSE NULL
              END,
              CASE
                WHEN candidate.client_token_total > 1
                  AND candidate.client_token_hits = candidate.client_token_total
                THEN 'Todas las palabras relevantes del cliente coinciden'
                ELSE NULL
              END,
              CASE
                WHEN candidate.client_token_hits > 0
                  AND candidate.client_token_hits < greatest(candidate.client_token_total, 1)
                THEN 'Coincidencia parcial de nombre cliente'
                ELSE NULL
              END
            ]::text[],
            NULL
          ),
          ' | '
        ),
        ''
      ) AS match_reason
    FROM candidate_signals candidate
  )
  SELECT
    scored.invoice_id,
    scored.folio,
    scored.numero_fiscal,
    scored.client_id,
    scored.client_name,
    scored.client_rut,
    scored.total,
    scored.issue_date,
    scored.due_date,
    scored.match_score,
    scored.match_reason
  FROM scored
  ORDER BY scored.match_score DESC, scored.due_date ASC, scored.issue_date ASC, scored.folio ASC
  LIMIT 25;
END;
$$;

GRANT ALL ON FUNCTION public.list_bank_statement_invoice_candidates(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.list_bank_statement_invoice_candidates(uuid) TO service_role;
