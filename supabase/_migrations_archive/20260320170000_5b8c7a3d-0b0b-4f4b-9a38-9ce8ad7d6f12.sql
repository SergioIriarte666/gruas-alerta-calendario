CREATE TABLE IF NOT EXISTS public.cost_bulk_payment_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  requested_cost_ids UUID[] NOT NULL,
  processed_cost_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  already_paid_cost_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  missing_cost_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_cost_bulk_payment_operations_executed_by
  ON public.cost_bulk_payment_operations(executed_by);

CREATE INDEX IF NOT EXISTS idx_cost_bulk_payment_operations_executed_at
  ON public.cost_bulk_payment_operations(executed_at DESC);

ALTER TABLE public.cost_bulk_payment_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cost_bulk_payment_operations_select_own_or_admin" ON public.cost_bulk_payment_operations;
CREATE POLICY "cost_bulk_payment_operations_select_own_or_admin"
  ON public.cost_bulk_payment_operations
  FOR SELECT
  TO authenticated
  USING (
    executed_by = auth.uid()
    OR public.is_admin_user()
  );

DROP POLICY IF EXISTS "cost_bulk_payment_operations_insert_admin_operator" ON public.cost_bulk_payment_operations;
CREATE POLICY "cost_bulk_payment_operations_insert_admin_operator"
  ON public.cost_bulk_payment_operations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_operator_user());

DROP FUNCTION IF EXISTS public.mark_costs_paid_batch(UUID[], DATE);
CREATE OR REPLACE FUNCTION public.mark_costs_paid_batch(
  p_cost_ids UUID[],
  p_payment_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_operation_id UUID := gen_random_uuid();
  v_executed_at TIMESTAMPTZ := now();
  v_requested_ids UUID[];
  v_processed_ids UUID[];
  v_already_paid_ids UUID[];
  v_missing_ids UUID[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT public.is_operator_user() THEN
    RAISE EXCEPTION 'No tienes permisos para realizar esta operación';
  END IF;

  v_requested_ids := ARRAY(
    SELECT DISTINCT unnest(p_cost_ids)
  );

  IF v_requested_ids IS NULL OR array_length(v_requested_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No se proporcionaron costos para procesar';
  END IF;

  IF p_payment_date IS NULL THEN
    p_payment_date := CURRENT_DATE;
  END IF;

  BEGIN
    SELECT COALESCE(array_agg(c.id), '{}'::uuid[])
      INTO v_already_paid_ids
    FROM public.costs c
    WHERE c.id = ANY(v_requested_ids)
      AND c.payment_date IS NOT NULL;

    WITH updated AS (
      UPDATE public.costs c
      SET
        payment_date = p_payment_date,
        payment_batch_id = v_operation_id::text,
        updated_at = v_executed_at
      WHERE c.id = ANY(v_requested_ids)
        AND c.payment_date IS NULL
      RETURNING c.id
    )
    SELECT COALESCE(array_agg(u.id), '{}'::uuid[])
      INTO v_processed_ids
    FROM updated u;

    SELECT COALESCE(array_agg(x.id), '{}'::uuid[])
      INTO v_missing_ids
    FROM (
      SELECT input_id AS id
      FROM unnest(v_requested_ids) AS input_id
      LEFT JOIN public.costs c ON c.id = input_id
      WHERE c.id IS NULL
    ) x;

    INSERT INTO public.cost_bulk_payment_operations (
      id,
      executed_at,
      executed_by,
      payment_date,
      requested_cost_ids,
      processed_cost_ids,
      already_paid_cost_ids,
      missing_cost_ids,
      status,
      error_message
    ) VALUES (
      v_operation_id,
      v_executed_at,
      v_user_id,
      p_payment_date,
      v_requested_ids,
      v_processed_ids,
      v_already_paid_ids,
      v_missing_ids,
      'success',
      NULL
    );

    RETURN jsonb_build_object(
      'success', true,
      'operation_id', v_operation_id,
      'executed_at', v_executed_at,
      'executed_by', v_user_id,
      'payment_date', p_payment_date,
      'requested_ids', v_requested_ids,
      'processed_ids', v_processed_ids,
      'already_paid_ids', v_already_paid_ids,
      'missing_ids', v_missing_ids,
      'requested_count', COALESCE(array_length(v_requested_ids, 1), 0),
      'processed_count', COALESCE(array_length(v_processed_ids, 1), 0),
      'already_paid_count', COALESCE(array_length(v_already_paid_ids, 1), 0),
      'missing_count', COALESCE(array_length(v_missing_ids, 1), 0)
    );
  EXCEPTION
    WHEN OTHERS THEN
      INSERT INTO public.cost_bulk_payment_operations (
        id,
        executed_at,
        executed_by,
        payment_date,
        requested_cost_ids,
        processed_cost_ids,
        already_paid_cost_ids,
        missing_cost_ids,
        status,
        error_message
      ) VALUES (
        v_operation_id,
        v_executed_at,
        v_user_id,
        COALESCE(p_payment_date, CURRENT_DATE),
        COALESCE(v_requested_ids, '{}'::uuid[]),
        '{}'::uuid[],
        '{}'::uuid[],
        '{}'::uuid[],
        'error',
        SQLERRM
      );

      RETURN jsonb_build_object(
        'success', false,
        'operation_id', v_operation_id,
        'executed_at', v_executed_at,
        'executed_by', v_user_id,
        'payment_date', COALESCE(p_payment_date, CURRENT_DATE),
        'requested_ids', COALESCE(v_requested_ids, '{}'::uuid[]),
        'processed_ids', '{}'::uuid[],
        'already_paid_ids', '{}'::uuid[],
        'missing_ids', '{}'::uuid[],
        'error', SQLERRM
      );
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_non_admin_updates_on_paid_costs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.payment_date IS NOT NULL AND NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Este costo está marcado como pagado y no puede ser modificado sin autorización especial';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_non_admin_updates_on_paid_costs_trigger ON public.costs;
CREATE TRIGGER prevent_non_admin_updates_on_paid_costs_trigger
BEFORE UPDATE ON public.costs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_non_admin_updates_on_paid_costs();
