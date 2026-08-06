-- Comisiones de operador: el servicio define la comisión y su estado no
-- participa en la elegibilidad. La ficha del operador (commission_exempt)
-- define si corresponde pagarla. Costs es únicamente la proyección contable:
-- nace no pagada y solo un lote creado desde Comisiones puede pagarla.

BEGIN;

-- ── 1. Proyección servicio -> costo, independiente del estado ──────────────
CREATE OR REPLACE FUNCTION public.sync_service_commissions(p_service_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_service RECORD;
  v_category_id CONSTANT uuid := '440296d4-09c2-4f3a-b02b-835f861df4c4';
BEGIN
  IF p_service_id IS NULL THEN
    RETURN;
  END IF;

  -- services y service_resources pueden disparar la función dentro de
  -- transacciones distintas. Serializar por servicio evita inserts gemelos y
  -- mantiene siempre el mismo orden de bloqueo.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_service_id::text, 0));
  PERFORM set_config('app.commission_autoflow', 'true', true);

  SELECT id, folio, service_date, crane_id
  INTO v_service
  FROM public.services
  WHERE id = p_service_id;

  IF NOT FOUND THEN
    PERFORM set_config('app.commission_autoflow', 'false', true);
    RETURN;
  END IF;

  -- Quitar solo proyecciones NO PAGADAS que ya no representan al servicio:
  -- operador removido, comisión en cero o trabajador ahora exento.
  DELETE FROM public.costs c
  WHERE c.service_id = p_service_id
    AND c.category_id = v_category_id
    AND c.payment_date IS NULL
    AND c.payment_batch_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.service_resources sr
      JOIN public.operators o ON o.id = sr.operator_id
      WHERE sr.service_id = p_service_id
        AND sr.resource_type = 'operator'
        AND sr.operator_id = c.operator_id
        AND sr.commission_amount > 0
        AND NOT o.commission_exempt
    );

  -- El servicio sigue siendo la fuente para montos y metadatos mientras la
  -- comisión no esté pagada. Una comisión pagada queda como hecho contable.
  UPDATE public.costs c
  SET amount = sr.commission_amount,
      service_folio = v_service.folio,
      date = v_service.service_date,
      description = 'Comisión ' || o.name,
      subcategory = 'comisiones',
      crane_id = v_service.crane_id,
      updated_at = now()
  FROM public.service_resources sr
  JOIN public.operators o ON o.id = sr.operator_id
  WHERE c.service_id = p_service_id
    AND c.category_id = v_category_id
    AND c.payment_date IS NULL
    AND c.payment_batch_id IS NULL
    AND sr.service_id = p_service_id
    AND sr.resource_type = 'operator'
    AND sr.operator_id = c.operator_id
    AND sr.commission_amount > 0
    AND NOT o.commission_exempt;

  -- Todas nacen no pagadas. El índice parcial idx_costs_unique_commission
  -- garantiza una fila por servicio/operador/categoría; ON CONFLICT cubre una
  -- carrera residual sin convertir el guardado del servicio en error.
  INSERT INTO public.costs (
    amount,
    category_id,
    service_id,
    operator_id,
    service_folio,
    date,
    description,
    subcategory,
    notes,
    crane_id,
    payment_date,
    payment_batch_id
  )
  SELECT
    sr.commission_amount,
    v_category_id,
    p_service_id,
    sr.operator_id,
    v_service.folio,
    v_service.service_date,
    'Comisión ' || o.name,
    'comisiones',
    'Comisión generada automáticamente desde el servicio',
    v_service.crane_id,
    NULL,
    NULL
  FROM public.service_resources sr
  JOIN public.operators o ON o.id = sr.operator_id
  WHERE sr.service_id = p_service_id
    AND sr.resource_type = 'operator'
    AND sr.commission_amount > 0
    AND NOT o.commission_exempt
    AND NOT EXISTS (
      SELECT 1
      FROM public.costs existing
      WHERE existing.service_id = p_service_id
        AND existing.operator_id = sr.operator_id
        AND existing.category_id = v_category_id
    )
  ON CONFLICT (service_id, operator_id, category_id)
    WHERE service_id IS NOT NULL
      AND operator_id IS NOT NULL
      AND category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'::uuid
  DO NOTHING;

  PERFORM set_config('app.commission_autoflow', 'false', true);
END;
$$;

COMMENT ON FUNCTION public.sync_service_commissions(uuid) IS
  'Proyecta las comisiones definidas en service_resources hacia costs sin filtrar por estado del servicio; respeta operators.commission_exempt y nunca modifica pagos.';

REVOKE ALL ON FUNCTION public.sync_service_commissions(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_service_commissions(uuid)
  TO service_role;

-- La elegibilidad se administra en Operadores. Cambiarla debe reconciliar en
-- la misma transacción todos los servicios asignados al trabajador.
CREATE OR REPLACE FUNCTION public.trg_operator_commission_eligibility_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_service_id uuid;
BEGIN
  IF NEW.commission_exempt IS NOT DISTINCT FROM OLD.commission_exempt THEN
    RETURN NEW;
  END IF;

  FOR v_service_id IN
    SELECT DISTINCT sr.service_id
    FROM public.service_resources sr
    WHERE sr.resource_type = 'operator'
      AND sr.operator_id = NEW.id
    ORDER BY sr.service_id
  LOOP
    PERFORM public.sync_service_commissions(v_service_id);
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_operator_commission_eligibility_sync()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_operator_commission_eligibility_sync ON public.operators;
CREATE TRIGGER trigger_operator_commission_eligibility_sync
  AFTER UPDATE OF commission_exempt ON public.operators
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_operator_commission_eligibility_sync();

-- Costs no puede convertirse en una segunda fuente ni en una vía alternativa
-- de pago. Las banderas usadas aquí son locales a la transacción y solo las
-- levantan las funciones específicas definidas en esta migración.
CREATE OR REPLACE FUNCTION public.guard_commission_cost_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_category_id CONSTANT uuid := '440296d4-09c2-4f3a-b02b-835f861df4c4';
  v_is_commission boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_is_commission := NEW.category_id = v_category_id;
  ELSE
    v_is_commission := NEW.category_id = v_category_id OR OLD.category_id = v_category_id;
  END IF;

  IF NOT v_is_commission THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF (NEW.payment_date IS NOT NULL OR NEW.payment_batch_id IS NOT NULL)
       AND current_setting('app.commission_batch_payment', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Las comisiones se pagan exclusivamente mediante un lote en el módulo Comisiones';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.payment_date IS DISTINCT FROM OLD.payment_date
     OR NEW.payment_batch_id IS DISTINCT FROM OLD.payment_batch_id THEN
    IF current_setting('app.commission_batch_payment', true) = 'true' THEN
      RETURN NEW;
    END IF;

    IF current_setting('app.commission_payment_date_edit', true) = 'true'
       AND OLD.payment_date IS NOT NULL
       AND NEW.payment_date IS NOT NULL
       AND NEW.payment_batch_id IS NOT DISTINCT FROM OLD.payment_batch_id THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Las comisiones se pagan exclusivamente mediante un lote en el módulo Comisiones';
  END IF;

  -- Para comisiones automáticas, monto y asignación solo pueden cambiar desde
  -- el servicio. Los ajustes manuales explícitos conservan su flujo propio.
  IF NOT NEW.is_manual_adjustment
     AND (
       NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.operator_id IS DISTINCT FROM OLD.operator_id
       OR NEW.service_id IS DISTINCT FROM OLD.service_id
       OR NEW.category_id IS DISTINCT FROM OLD.category_id
       OR NEW.date IS DISTINCT FROM OLD.date
       OR NEW.crane_id IS DISTINCT FROM OLD.crane_id
       OR NEW.description IS DISTINCT FROM OLD.description
     )
     AND current_setting('app.commission_autoflow', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'La comisión debe modificarse desde el servicio';
  END IF;

  IF NOT NEW.is_manual_adjustment
     AND NEW.service_folio IS DISTINCT FROM OLD.service_folio
     AND current_setting('app.commission_autoflow', true) IS DISTINCT FROM 'true'
     AND current_setting('app.sync_in_progress', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'El folio de la comisión se sincroniza desde el servicio';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_commission_cost_mutation()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_commission_cost_mutation_trigger ON public.costs;
CREATE TRIGGER guard_commission_cost_mutation_trigger
  BEFORE INSERT OR UPDATE ON public.costs
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_commission_cost_mutation();

-- ── 2. Lotes de pago persistentes y transaccionales ───────────────────────
CREATE TABLE IF NOT EXISTS public.commission_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number text NOT NULL UNIQUE,
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE RESTRICT,
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  commission_count integer NOT NULL CHECK (commission_count > 0),
  payment_date date NOT NULL,
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'cancelled')),
  payment_method text,
  payment_reference text,
  notes text,
  commission_ids uuid[] NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_batches_operator_payment_date
  ON public.commission_batches(operator_id, payment_date DESC);

DROP TRIGGER IF EXISTS update_commission_batches_updated_at ON public.commission_batches;
CREATE TRIGGER update_commission_batches_updated_at
  BEFORE UPDATE ON public.commission_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.commission_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commission_batches_admin_read ON public.commission_batches;
CREATE POLICY commission_batches_admin_read
  ON public.commission_batches
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user_safe());

REVOKE ALL ON TABLE public.commission_batches FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.commission_batches FROM authenticated;
GRANT SELECT ON TABLE public.commission_batches TO authenticated;

-- Conservar como lotes persistentes todos los identificadores históricos que
-- ya están en costs. La evidencia actual garantiza un operador y una fecha por
-- identificador; HAVING evita inventar un lote si apareciera un grupo ambiguo.
INSERT INTO public.commission_batches (
  batch_number,
  operator_id,
  total_amount,
  commission_count,
  payment_date,
  payment_method,
  payment_reference,
  notes,
  commission_ids,
  created_at,
  updated_at
)
SELECT
  c.payment_batch_id,
  min(c.operator_id::text)::uuid,
  sum(c.amount),
  count(*)::integer,
  min(c.payment_date),
  NULL,
  NULL,
  'Lote histórico reconstruido desde costs',
  array_agg(c.id ORDER BY c.id),
  min(c.updated_at),
  max(c.updated_at)
FROM public.costs c
WHERE c.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'::uuid
  AND c.payment_batch_id IS NOT NULL
GROUP BY c.payment_batch_id
HAVING count(DISTINCT c.operator_id) = 1
   AND count(DISTINCT c.payment_date) = 1
   AND min(c.payment_date) IS NOT NULL
ON CONFLICT (batch_number) DO NOTHING;

-- Los pagos anteriores al uso de payment_batch_id no pueden recuperar su
-- agrupación original sin inventarla. Se conservan como lotes históricos de
-- una comisión, explícitamente identificados como reconstruidos.
INSERT INTO public.commission_batches (
  batch_number,
  operator_id,
  total_amount,
  commission_count,
  payment_date,
  notes,
  commission_ids,
  created_at,
  updated_at
)
SELECT
  'LEGACY-' || upper(replace(c.id::text, '-', '')),
  c.operator_id,
  c.amount,
  1,
  c.payment_date,
  'Pago histórico sin lote original; reconstruido individualmente',
  ARRAY[c.id],
  c.updated_at,
  c.updated_at
FROM public.costs c
WHERE c.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'::uuid
  AND c.payment_date IS NOT NULL
  AND c.payment_batch_id IS NULL
  AND c.operator_id IS NOT NULL
ON CONFLICT (batch_number) DO NOTHING;

SET LOCAL app.sync_in_progress = 'true';
SET LOCAL app.commission_batch_payment = 'true';

UPDATE public.costs c
SET payment_batch_id = 'LEGACY-' || upper(replace(c.id::text, '-', '')),
    subcategory = 'comisiones_pagadas',
    updated_at = now()
WHERE c.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'::uuid
  AND c.payment_date IS NOT NULL
  AND c.payment_batch_id IS NULL
  AND c.operator_id IS NOT NULL;

SET LOCAL app.commission_batch_payment = 'false';

CREATE OR REPLACE FUNCTION public.create_commission_payment_batch(
  p_operator_id uuid,
  p_commission_ids uuid[],
  p_payment_date date,
  p_payment_method text DEFAULT NULL,
  p_payment_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_category_id CONSTANT uuid := '440296d4-09c2-4f3a-b02b-835f861df4c4';
  v_expected_count integer;
  v_found_count integer;
  v_paid_count integer;
  v_distinct_operator_count integer;
  v_total_amount numeric;
  v_batch_number text;
  v_batch_id uuid;
  v_commission_ids uuid[];
  v_updated_count integer;
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Solo administradores pueden crear lotes de comisiones';
  END IF;

  IF p_operator_id IS NULL OR p_payment_date IS NULL THEN
    RAISE EXCEPTION 'Operador y fecha de pago son obligatorios';
  END IF;

  IF p_commission_ids IS NULL OR cardinality(p_commission_ids) = 0 THEN
    RAISE EXCEPTION 'Debe indicar al menos una comisión';
  END IF;

  v_expected_count := cardinality(p_commission_ids);
  IF v_expected_count <> (SELECT count(DISTINCT id) FROM unnest(p_commission_ids) AS ids(id)) THEN
    RAISE EXCEPTION 'El lote contiene comisiones repetidas';
  END IF;

  -- Bloqueo estable para impedir que dos lotes paguen la misma comisión.
  PERFORM c.id
  FROM public.costs c
  WHERE c.id = ANY(p_commission_ids)
  ORDER BY c.id
  FOR UPDATE;

  SELECT
    count(*),
    count(*) FILTER (WHERE c.payment_date IS NOT NULL OR c.payment_batch_id IS NOT NULL),
    count(DISTINCT c.operator_id),
    coalesce(sum(c.amount), 0),
    array_agg(c.id ORDER BY c.id)
  INTO
    v_found_count,
    v_paid_count,
    v_distinct_operator_count,
    v_total_amount,
    v_commission_ids
  FROM public.costs c
  WHERE c.id = ANY(p_commission_ids)
    AND c.category_id = v_category_id
    AND c.operator_id = p_operator_id;

  IF v_found_count <> v_expected_count THEN
    RAISE EXCEPTION 'Algunas comisiones no existen o no pertenecen al operador seleccionado (esperadas: %, encontradas: %)',
      v_expected_count, v_found_count;
  END IF;

  IF v_distinct_operator_count <> 1 THEN
    RAISE EXCEPTION 'Un lote solo puede contener comisiones de un operador';
  END IF;

  IF v_paid_count > 0 THEN
    RAISE EXCEPTION 'El lote contiene comisiones que ya fueron pagadas';
  END IF;

  v_batch_number := 'LOTE-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.commission_batches (
    batch_number,
    operator_id,
    total_amount,
    commission_count,
    payment_date,
    payment_method,
    payment_reference,
    notes,
    commission_ids,
    created_by
  ) VALUES (
    v_batch_number,
    p_operator_id,
    v_total_amount,
    v_expected_count,
    p_payment_date,
    NULLIF(btrim(p_payment_method), ''),
    NULLIF(btrim(p_payment_reference), ''),
    NULLIF(btrim(p_notes), ''),
    v_commission_ids,
    auth.uid()
  )
  RETURNING id INTO v_batch_id;

  PERFORM set_config('app.sync_in_progress', 'true', true);
  PERFORM set_config('app.commission_batch_payment', 'true', true);

  UPDATE public.costs
  SET payment_date = p_payment_date,
      payment_batch_id = v_batch_number,
      subcategory = 'comisiones_pagadas',
      updated_at = now()
  WHERE id = ANY(v_commission_ids)
    AND category_id = v_category_id
    AND payment_date IS NULL
    AND payment_batch_id IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count <> v_expected_count THEN
    RAISE EXCEPTION 'No se actualizaron todas las comisiones del lote (esperadas: %, actualizadas: %)',
      v_expected_count, v_updated_count;
  END IF;

  PERFORM set_config('app.commission_batch_payment', 'false', true);

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', v_batch_id,
    'batch_number', v_batch_number,
    'operator_id', p_operator_id,
    'total_amount', v_total_amount,
    'commission_count', v_expected_count,
    'payment_date', p_payment_date
  );
END;
$$;

COMMENT ON FUNCTION public.create_commission_payment_batch(uuid, uuid[], date, text, text, text) IS
  'Crea el lote y marca sus costos de comisión como pagados en una única transacción. Único camino admitido para pagar comisiones pendientes.';

REVOKE ALL ON FUNCTION public.create_commission_payment_batch(uuid, uuid[], date, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_commission_payment_batch(uuid, uuid[], date, text, text, text)
  TO authenticated;

-- Compatibilidad de despliegue: el cliente anterior usa esta RPC tanto para
-- lotes LOTE-* como para ediciones EDIT-*. Los lotes antiguos también se
-- persisten transaccionalmente; las ediciones conservan el lote original. El
-- cliente nuevo usa create_commission_payment_batch para todo pago nuevo.
CREATE OR REPLACE FUNCTION public.update_commission_payment_date(
  p_commission_ids uuid[],
  p_payment_date date DEFAULT NULL,
  p_payment_batch_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_category_id CONSTANT uuid := '440296d4-09c2-4f3a-b02b-835f861df4c4';
  v_expected_count integer;
  v_found_count integer;
  v_operator_count integer;
  v_paid_count integer;
  v_pending_count integer;
  v_updated_count integer;
  v_operator_id uuid;
  v_total_amount numeric;
  v_commission_ids uuid[];
  v_batch_id uuid;
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Solo administradores pueden administrar pagos de comisiones';
  END IF;

  IF p_commission_ids IS NULL OR cardinality(p_commission_ids) = 0 THEN
    RAISE EXCEPTION 'Debe indicar al menos una comisión';
  END IF;

  IF p_payment_date IS NULL THEN
    RAISE EXCEPTION 'La fecha de pago es obligatoria y no puede eliminarse';
  END IF;

  v_expected_count := cardinality(p_commission_ids);

  PERFORM c.id
  FROM public.costs c
  WHERE c.id = ANY(p_commission_ids)
  ORDER BY c.id
  FOR UPDATE;

  SELECT
    count(*),
    count(DISTINCT c.operator_id),
    count(*) FILTER (WHERE c.payment_date IS NOT NULL),
    count(*) FILTER (WHERE c.payment_date IS NULL AND c.payment_batch_id IS NULL),
    min(c.operator_id::text)::uuid,
    coalesce(sum(c.amount), 0),
    array_agg(c.id ORDER BY c.id)
  INTO
    v_found_count,
    v_operator_count,
    v_paid_count,
    v_pending_count,
    v_operator_id,
    v_total_amount,
    v_commission_ids
  FROM public.costs c
  WHERE c.id = ANY(p_commission_ids)
    AND c.category_id = v_category_id;

  IF v_found_count <> v_expected_count THEN
    RAISE EXCEPTION 'Algunas comisiones no existen o no pertenecen a Comisión Operador';
  END IF;

  IF v_operator_count <> 1 THEN
    RAISE EXCEPTION 'Solo se pueden editar comisiones de un operador a la vez';
  END IF;

  -- Edición de fecha: solo filas ya pagadas. EDIT-* se acepta durante el
  -- despliegue del cliente anterior, pero nunca reemplaza payment_batch_id.
  IF v_paid_count = v_expected_count THEN
    IF p_payment_batch_id IS NOT NULL AND p_payment_batch_id NOT LIKE 'EDIT-%' THEN
      RAISE EXCEPTION 'La edición de fecha no puede reemplazar el lote de pago original';
    END IF;

    PERFORM set_config('app.sync_in_progress', 'true', true);
    PERFORM set_config('app.commission_payment_date_edit', 'true', true);

    UPDATE public.costs
    SET payment_date = p_payment_date,
        updated_at = now()
    WHERE id = ANY(v_commission_ids)
      AND category_id = v_category_id
      AND payment_date IS NOT NULL;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    PERFORM set_config('app.commission_payment_date_edit', 'false', true);

    RETURN jsonb_build_object(
      'success', true,
      'updated_count', v_updated_count,
      'payment_date', p_payment_date,
      'operation', 'payment_date_edit'
    );
  END IF;

  -- Pago compatible con el cliente anterior: exige un lote LOTE-* y persiste
  -- la cabecera antes de marcar los costos dentro de la misma transacción.
  IF v_pending_count = v_expected_count THEN
    IF p_payment_batch_id IS NULL OR p_payment_batch_id NOT LIKE 'LOTE-%' THEN
      RAISE EXCEPTION 'Las comisiones pendientes solo pueden pagarse mediante un lote';
    END IF;

    INSERT INTO public.commission_batches (
      batch_number,
      operator_id,
      total_amount,
      commission_count,
      payment_date,
      notes,
      commission_ids,
      created_by
    ) VALUES (
      p_payment_batch_id,
      v_operator_id,
      v_total_amount,
      v_expected_count,
      p_payment_date,
      'Lote creado durante transición de cliente; metadatos no disponibles',
      v_commission_ids,
      auth.uid()
    )
    RETURNING id INTO v_batch_id;

    PERFORM set_config('app.sync_in_progress', 'true', true);
    PERFORM set_config('app.commission_batch_payment', 'true', true);

    UPDATE public.costs
    SET payment_date = p_payment_date,
        payment_batch_id = p_payment_batch_id,
        subcategory = 'comisiones_pagadas',
        updated_at = now()
    WHERE id = ANY(v_commission_ids)
      AND category_id = v_category_id
      AND payment_date IS NULL
      AND payment_batch_id IS NULL;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    IF v_updated_count <> v_expected_count THEN
      RAISE EXCEPTION 'No se actualizaron todas las comisiones del lote';
    END IF;

    PERFORM set_config('app.commission_batch_payment', 'false', true);

    RETURN jsonb_build_object(
      'success', true,
      'updated_count', v_updated_count,
      'payment_date', p_payment_date,
      'payment_batch_id', p_payment_batch_id,
      'batch_id', v_batch_id,
      'operation', 'legacy_batch_creation'
    );
  END IF;

  RAISE EXCEPTION 'No se pueden mezclar comisiones pagadas y pendientes en una misma operación';
END;
$$;

REVOKE ALL ON FUNCTION public.update_commission_payment_date(uuid[], date, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_commission_payment_date(uuid[], date, text)
  TO authenticated;

-- ── 3. Reparación de datos históricos y backfill ───────────────────────────
-- Los servicios legacy guardaban la comisión principal en services. Copiarla
-- a su asignación equivalente únicamente cuando esa asignación está en cero;
-- nunca inferirla para otro operador ni para un trabajador exento.
UPDATE public.service_resources sr
SET commission_amount = s.operator_commission,
    updated_at = now()
FROM public.services s
JOIN public.operators o ON o.id = s.operator_id
WHERE sr.service_id = s.id
  AND sr.resource_type = 'operator'
  AND sr.operator_id = s.operator_id
  AND coalesce(sr.commission_amount, 0) <= 0
  AND s.operator_commission > 0
  AND NOT o.commission_exempt;

-- Proyectar todas las comisiones configuradas, cualquiera sea el estado del
-- servicio, y reconciliar posibles pendientes de operadores ahora exentos.
DO $$
DECLARE
  v_service_id uuid;
BEGIN
  FOR v_service_id IN
    SELECT s.id
    FROM public.services s
    WHERE EXISTS (
      SELECT 1
      FROM public.service_resources sr
      JOIN public.operators o ON o.id = sr.operator_id
      WHERE sr.service_id = s.id
        AND sr.resource_type = 'operator'
        AND sr.commission_amount > 0
        AND NOT o.commission_exempt
    )
    OR EXISTS (
      SELECT 1
      FROM public.costs c
      WHERE c.service_id = s.id
        AND c.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'::uuid
        AND c.payment_date IS NULL
        AND c.payment_batch_id IS NULL
    )
    ORDER BY s.id
  LOOP
    PERFORM public.sync_service_commissions(v_service_id);
  END LOOP;
END;
$$;

COMMIT;
