ALTER TABLE public.cost_bulk_payment_operations
ALTER COLUMN payment_date DROP NOT NULL;

ALTER TABLE public.cost_bulk_payment_operations
ADD COLUMN IF NOT EXISTS use_cost_date BOOLEAN NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.mark_costs_paid_batch(UUID[], DATE);
CREATE OR REPLACE FUNCTION public.mark_costs_paid_batch(
  p_cost_ids UUID[],
  p_payment_date DATE DEFAULT NULL
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
  v_use_cost_date BOOLEAN := false;
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

  v_use_cost_date := (p_payment_date IS NULL);

  BEGIN
    SELECT COALESCE(array_agg(c.id), '{}'::uuid[])
      INTO v_already_paid_ids
    FROM public.costs c
    WHERE c.id = ANY(v_requested_ids)
      AND c.payment_date IS NOT NULL;

    WITH updated AS (
      UPDATE public.costs c
      SET
        payment_date = COALESCE(p_payment_date, c.date),
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
      use_cost_date,
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
      v_use_cost_date,
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
      'use_cost_date', v_use_cost_date,
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
        use_cost_date,
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
        v_use_cost_date,
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
        'payment_date', p_payment_date,
        'use_cost_date', v_use_cost_date,
        'requested_ids', COALESCE(v_requested_ids, '{}'::uuid[]),
        'processed_ids', '{}'::uuid[],
        'already_paid_ids', '{}'::uuid[],
        'missing_ids', '{}'::uuid[],
        'error', SQLERRM
      );
  END;
END;
$function$;

