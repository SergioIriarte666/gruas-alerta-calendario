BEGIN;

CREATE OR REPLACE FUNCTION public.list_bank_statement_invoice_candidates(
  p_movement_id uuid
)
RETURNS TABLE(
  invoice_id       uuid,
  folio            text,
  numero_fiscal    text,
  client_id        uuid,
  client_name      text,
  client_rut       text,
  total            numeric,
  issue_date       date,
  due_date         date,
  match_score      integer,
  match_reason     text,
  amount_matches   boolean,
  already_paid     boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_movement        public.bank_statement_movements%ROWTYPE;
  v_payload_text    text;
  v_haystack_text   text;
  v_haystack_norm   text;
  v_haystack_compact text;
  v_haystack_digits  text;
  v_reference_compact text;
  v_payer_norm      text;
  v_detected_client_ruts text[] := ARRAY[]::text[];
  v_extracted_numbers text[] := ARRAY[]::text[];
BEGIN
  -- 1. Cargar el movimiento
  SELECT * INTO v_movement
  FROM public.bank_statement_movements
  WHERE id = p_movement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimiento bancario no encontrado';
  END IF;

  IF v_movement.amount <= 0 THEN
    RETURN;
  END IF;

  -- 2. Construir haystack completo desde todos los campos del movimiento
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

  v_haystack_norm    := trim(regexp_replace(lower(public.unaccent(v_haystack_text)), '[^a-z0-9]+', ' ', 'g'));
  v_haystack_compact := regexp_replace(v_haystack_norm, '\s+', '', 'g');
  v_haystack_digits  := regexp_replace(lower(coalesce(v_haystack_text, '')), '[^0-9k]+', '', 'g');

  v_reference_compact := nullif(
    regexp_replace(lower(public.unaccent(coalesce(v_movement.reference_id, ''))), '[^a-z0-9]+', '', 'g'),
    ''
  );
  v_payer_norm := nullif(
    trim(regexp_replace(lower(public.unaccent(coalesce(v_movement.payer_name, ''))), '[^a-z0-9]+', ' ', 'g')),
    ''
  );

  -- 3. Detectar RUTs en el texto
  SELECT coalesce(
    array_agg(DISTINCT detected_rut) FILTER (WHERE detected_rut IS NOT NULL),
    ARRAY[]::text[]
  )
  INTO v_detected_client_ruts
  FROM (
    SELECT nullif(
      ltrim(
        regexp_replace(lower(match_parts[2]), '[^0-9k]+', '', 'g'),
        '0'
      ),
      ''
    ) AS detected_rut
    FROM regexp_matches(
      lower(coalesce(v_haystack_text, '')),
      '(^|[^0-9k])([0-9]{1,2}\.?[0-9]{3}\.?[0-9]{3}-?[0-9k]|0[0-9]{8}[0-9k]|[0-9]{7,8}-?[0-9k])([^0-9k]|$)',
      'g'
    ) AS match_parts
  ) detected;

  -- 4. Extraer secuencias numéricas de 3-8 dígitos del haystack
  --    para buscar coincidencias con números de folio/factura
  SELECT coalesce(
    array_agg(DISTINCT num_match) FILTER (WHERE num_match IS NOT NULL AND length(num_match) >= 3),
    ARRAY[]::text[]
  )
  INTO v_extracted_numbers
  FROM (
    SELECT (regexp_matches(v_haystack_compact, '([0-9]{3,8})', 'g'))[1] AS num_match
  ) nums;

  -- 5. Query principal de candidatos
  --    PRE-FILTRO: coincidencia de monto exacto OR señal fuerte de identidad
  RETURN QUERY
  WITH candidate_base AS (
    SELECT
      i.id           AS invoice_id,
      i.folio,
      i.numero_fiscal,
      i.client_id,
      c.name::text   AS client_name,
      c.rut::text    AS client_rut,
      i.total,
      i.issue_date,
      i.due_date,
      i.status,
      -- Flags de monto y pago
      (i.total = v_movement.amount)               AS amount_matches,
      (i.status = 'paid' OR coalesce(i.paid_amount, 0) > 0) AS already_paid,
      -- Compactos normalizados
      nullif(regexp_replace(lower(public.unaccent(coalesce(i.numero_fiscal,''))), '[^a-z0-9]+', '', 'g'), '') AS nf_compact,
      nullif(regexp_replace(lower(public.unaccent(coalesce(i.folio,''))), '[^a-z0-9]+', '', 'g'), '')         AS folio_compact,
      nullif(ltrim(regexp_replace(lower(coalesce(c.rut,'')), '[^0-9k]+', '', 'g'), '0'), '')                  AS rut_compact,
      trim(regexp_replace(lower(public.unaccent(coalesce(c.name,''))), '[^a-z0-9]+', ' ', 'g'))               AS name_norm
    FROM public.invoices i
    JOIN public.clients c ON c.id = i.client_id
    WHERE
      -- Estados admitidos: pendientes + ya pagadas (para el aviso)
      i.status IN ('sent', 'overdue', 'paid')
      -- PRE-FILTRO: monto exacto, O señal de identidad fuerte
      AND (
        -- Monto exacto (sin pago previo)
        (i.total = v_movement.amount AND coalesce(i.remaining_amount, i.total) = i.total AND i.status IN ('sent','overdue'))
        -- Ya pagada con monto igual → aviso de duplicado potencial
        OR (i.total = v_movement.amount AND i.status = 'paid')
        -- Identidad fuerte independiente del monto: RUT detectado coincide
        OR (
          coalesce(array_length(v_detected_client_ruts, 1), 0) > 0
          AND nullif(ltrim(regexp_replace(lower(coalesce(c.rut,'')), '[^0-9k]+', '', 'g'), '0'), '') = ANY(v_detected_client_ruts)
        )
        -- Número fiscal aparece en el haystack
        OR (
          nullif(regexp_replace(lower(public.unaccent(coalesce(i.numero_fiscal,''))), '[^a-z0-9]+', '', 'g'), '') IS NOT NULL
          AND position(
            nullif(regexp_replace(lower(public.unaccent(coalesce(i.numero_fiscal,''))), '[^a-z0-9]+', '', 'g'), '')
            IN v_haystack_compact
          ) > 0
        )
      )
  ),
  candidate_signals AS (
    SELECT
      cb.*,
      -- Token matching del nombre del cliente
      (SELECT count(*) FROM unnest(regexp_split_to_array(cb.name_norm, '\s+')) t WHERE length(t) >= 4)::integer AS token_total,
      (SELECT count(*) FROM unnest(regexp_split_to_array(cb.name_norm, '\s+')) t WHERE length(t) >= 4 AND position(' '||t||' ' IN ' '||v_haystack_norm||' ') > 0)::integer AS token_hits,
      -- Número de folio sin prefijos (solo dígitos) para fuzzy
      nullif(regexp_replace(coalesce(cb.folio_compact,''), '[^0-9]', '', 'g'), '') AS folio_digits,
      nullif(regexp_replace(coalesce(cb.nf_compact,''), '[^0-9]', '', 'g'), '')    AS nf_digits
    FROM candidate_base cb
  ),
  scored AS (
    SELECT
      cs.invoice_id, cs.folio, cs.numero_fiscal, cs.client_id,
      cs.client_name, cs.client_rut, cs.total, cs.issue_date, cs.due_date,
      cs.amount_matches, cs.already_paid,
      (
        -- ── MONTO EXACTO (base) ──
        CASE WHEN cs.amount_matches AND NOT cs.already_paid THEN 50 ELSE 0 END

        -- ── NÚMERO FISCAL ──
        -- Referencia del movimiento = número fiscal exacto
        + CASE WHEN v_reference_compact IS NOT NULL AND cs.nf_compact IS NOT NULL
               AND v_reference_compact = cs.nf_compact THEN 220 ELSE 0 END
        -- Número fiscal aparece en cualquier parte del haystack
        + CASE WHEN cs.nf_compact IS NOT NULL
               AND position(cs.nf_compact IN v_haystack_compact) > 0 THEN 140 ELSE 0 END
        -- Solo la parte numérica del N° fiscal aparece en haystack
        + CASE WHEN cs.nf_digits IS NOT NULL AND length(cs.nf_digits) >= 3
               AND cs.nf_digits = ANY(v_extracted_numbers) THEN 80 ELSE 0 END

        -- ── FOLIO ──
        -- Referencia = folio exacto
        + CASE WHEN v_reference_compact IS NOT NULL AND cs.folio_compact IS NOT NULL
               AND v_reference_compact = cs.folio_compact THEN 160 ELSE 0 END
        -- Folio completo en haystack
        + CASE WHEN cs.folio_compact IS NOT NULL
               AND position(cs.folio_compact IN v_haystack_compact) > 0 THEN 90 ELSE 0 END
        -- Solo dígitos del folio en haystack
        + CASE WHEN cs.folio_digits IS NOT NULL AND length(cs.folio_digits) >= 3
               AND cs.folio_digits = ANY(v_extracted_numbers) THEN 50 ELSE 0 END

        -- ── RUT ──
        -- RUT exacto detectado en cartola
        + CASE WHEN cs.rut_compact IS NOT NULL
               AND position(cs.rut_compact IN v_haystack_digits) > 0 THEN 80 ELSE 0 END
        -- RUT detectado coincide con cliente
        + CASE WHEN coalesce(array_length(v_detected_client_ruts,1),0) > 0
               AND cs.rut_compact = ANY(v_detected_client_ruts) THEN 60 ELSE 0 END

        -- ── RAZÓN SOCIAL ──
        -- Nombre completo del ordenante contiene / está contenido en nombre cliente
        + CASE WHEN v_payer_norm IS NOT NULL AND cs.name_norm <> ''
               AND (position(cs.name_norm IN v_payer_norm) > 0 OR position(v_payer_norm IN cs.name_norm) > 0)
               THEN 55 ELSE 0 END
        -- Nombre cliente completo aparece en haystack
        + CASE WHEN cs.name_norm <> '' AND position(cs.name_norm IN v_haystack_norm) > 0 THEN 40 ELSE 0 END
        -- Todas las palabras relevantes del nombre coinciden
        + CASE WHEN cs.token_total > 0 AND cs.token_hits = cs.token_total THEN 25 ELSE 0 END
        -- Al menos una palabra relevante coincide
        + CASE WHEN cs.token_hits > 0 THEN 10 ELSE 0 END

        -- ── PENALIZACIÓN ──
        -- Factura ya pagada: mostrar como aviso pero con score reducido
        - CASE WHEN cs.already_paid THEN 300 ELSE 0 END
      )::integer AS match_score,

      -- Texto de razones de match
      nullif(
        array_to_string(
          array_remove(ARRAY[
            CASE WHEN cs.already_paid THEN '⚠️ Esta factura ya está pagada/conciliada' ELSE NULL END,
            CASE WHEN cs.amount_matches AND NOT cs.already_paid THEN 'Monto exacto coincide' ELSE NULL END,
            CASE WHEN NOT cs.amount_matches THEN format('Monto cartola %s ≠ factura %s', v_movement.amount::text, cs.total::text) ELSE NULL END,
            CASE WHEN v_reference_compact IS NOT NULL AND cs.nf_compact IS NOT NULL AND v_reference_compact = cs.nf_compact THEN 'Referencia exacta con número fiscal' ELSE NULL END,
            CASE WHEN cs.nf_compact IS NOT NULL AND position(cs.nf_compact IN v_haystack_compact) > 0 THEN 'Número fiscal detectado en cartola' ELSE NULL END,
            CASE WHEN cs.nf_digits IS NOT NULL AND length(cs.nf_digits) >= 3 AND cs.nf_digits = ANY(v_extracted_numbers) THEN 'Secuencia numérica de factura coincide' ELSE NULL END,
            CASE WHEN v_reference_compact IS NOT NULL AND cs.folio_compact IS NOT NULL AND v_reference_compact = cs.folio_compact THEN 'Referencia exacta con folio' ELSE NULL END,
            CASE WHEN cs.folio_compact IS NOT NULL AND position(cs.folio_compact IN v_haystack_compact) > 0 THEN 'Folio detectado en cartola' ELSE NULL END,
            CASE WHEN cs.folio_digits IS NOT NULL AND length(cs.folio_digits) >= 3 AND cs.folio_digits = ANY(v_extracted_numbers) THEN 'Número de folio coincide parcialmente' ELSE NULL END,
            CASE WHEN cs.rut_compact IS NOT NULL AND position(cs.rut_compact IN v_haystack_digits) > 0 THEN 'RUT cliente detectado' ELSE NULL END,
            CASE WHEN coalesce(array_length(v_detected_client_ruts,1),0) > 0 AND cs.rut_compact = ANY(v_detected_client_ruts) THEN 'RUT cartola coincide con cliente' ELSE NULL END,
            CASE WHEN v_payer_norm IS NOT NULL AND cs.name_norm <> '' AND (position(cs.name_norm IN v_payer_norm) > 0 OR position(v_payer_norm IN cs.name_norm) > 0) THEN 'Ordenante compatible con cliente' ELSE NULL END,
            CASE WHEN cs.name_norm <> '' AND position(cs.name_norm IN v_haystack_norm) > 0 THEN 'Nombre cliente mencionado' ELSE NULL END,
            CASE WHEN cs.token_total > 1 AND cs.token_hits = cs.token_total THEN 'Todas las palabras relevantes del cliente coinciden' ELSE NULL END,
            CASE WHEN cs.token_hits > 0 AND cs.token_hits < greatest(cs.token_total,1) THEN 'Coincidencia parcial de nombre cliente' ELSE NULL END
          ]::text[], NULL),
          ' | '
        ),
        ''
      ) AS match_reason

    FROM candidate_signals cs
  )
  SELECT
    s.invoice_id, s.folio, s.numero_fiscal, s.client_id,
    s.client_name, s.client_rut, s.total, s.issue_date, s.due_date,
    s.match_score, s.match_reason,
    s.amount_matches, s.already_paid
  FROM scored s
  -- Umbral mínimo: monto exacto sin pago previo, O señal de identidad
  -- (RUT/fiscal/razón social) con score >= 30
  WHERE (s.amount_matches AND NOT s.already_paid)
     OR s.already_paid  -- siempre mostrar las ya pagadas como aviso
     OR s.match_score >= 30
  ORDER BY s.match_score DESC, s.already_paid ASC, s.due_date ASC, s.folio ASC
  LIMIT 30;
END;
$function$;

COMMIT;
