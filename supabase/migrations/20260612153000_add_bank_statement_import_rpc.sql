CREATE OR REPLACE FUNCTION public.create_bank_statement_import(
  p_file_name text,
  p_file_type text,
  p_bank_name text DEFAULT NULL,
  p_processing_summary jsonb DEFAULT '{}'::jsonb,
  p_movements jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_import_id uuid;
  v_total_movements integer := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF coalesce(trim(p_file_name), '') = '' THEN
    RAISE EXCEPTION 'El nombre del archivo es obligatorio';
  END IF;

  IF p_file_type NOT IN ('pdf', 'xls', 'xlsx') THEN
    RAISE EXCEPTION 'Tipo de archivo no soportado para cartola';
  END IF;

  IF jsonb_typeof(coalesce(p_movements, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Los movimientos de la cartola deben enviarse como arreglo JSON';
  END IF;

  INSERT INTO public.bank_statement_imports (
    file_name,
    file_type,
    bank_name,
    status,
    total_movements,
    uploaded_by,
    processing_summary
  ) VALUES (
    p_file_name,
    p_file_type,
    nullif(trim(coalesce(p_bank_name, '')), ''),
    'processing',
    0,
    v_user_id,
    coalesce(p_processing_summary, '{}'::jsonb)
  )
  RETURNING id INTO v_import_id;

  INSERT INTO public.bank_statement_movements (
    import_id,
    row_index,
    transaction_date,
    posted_date,
    amount,
    currency,
    description,
    reference_id,
    payer_name,
    raw_payload
  )
  SELECT
    v_import_id,
    movement.row_index,
    movement.transaction_date,
    movement.posted_date,
    movement.amount,
    coalesce(nullif(trim(movement.currency), ''), 'CLP'),
    nullif(trim(coalesce(movement.description, '')), ''),
    nullif(trim(coalesce(movement.reference_id, '')), ''),
    nullif(trim(coalesce(movement.payer_name, '')), ''),
    coalesce(movement.raw_payload, '{}'::jsonb)
  FROM jsonb_to_recordset(coalesce(p_movements, '[]'::jsonb)) AS movement(
    row_index integer,
    transaction_date date,
    posted_date date,
    amount numeric,
    currency text,
    description text,
    reference_id text,
    payer_name text,
    raw_payload jsonb
  );

  GET DIAGNOSTICS v_total_movements = ROW_COUNT;

  UPDATE public.bank_statement_imports
  SET
    status = 'completed',
    total_movements = v_total_movements,
    processing_summary = coalesce(p_processing_summary, '{}'::jsonb)
      || jsonb_build_object(
        'imported_by', v_user_id,
        'imported_at', now(),
        'total_movements', v_total_movements
      ),
    updated_at = now()
  WHERE id = v_import_id;

  RETURN jsonb_build_object(
    'success', true,
    'import_id', v_import_id,
    'total_movements', v_total_movements
  );
EXCEPTION
  WHEN OTHERS THEN
    IF v_import_id IS NOT NULL THEN
      UPDATE public.bank_statement_imports
      SET
        status = 'failed',
        processing_summary = coalesce(p_processing_summary, '{}'::jsonb)
          || jsonb_build_object(
            'error', SQLERRM,
            'failed_at', now()
          ),
        updated_at = now()
      WHERE id = v_import_id;
    END IF;
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_bank_statement_movement_exception(
  p_movement_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_movement public.bank_statement_movements%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  SELECT *
  INTO v_movement
  FROM public.bank_statement_movements
  WHERE id = p_movement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimiento bancario no encontrado';
  END IF;

  IF v_movement.reconciliation_status = 'reconciled' THEN
    RAISE EXCEPTION 'No se puede marcar como excepción un movimiento ya conciliado';
  END IF;

  UPDATE public.bank_statement_movements
  SET
    reconciliation_status = 'exception',
    updated_at = now(),
    raw_payload = coalesce(v_movement.raw_payload, '{}'::jsonb)
      || CASE
        WHEN nullif(trim(coalesce(p_reason, '')), '') IS NULL THEN '{}'::jsonb
        ELSE jsonb_build_object(
          'exception_reason', trim(p_reason),
          'exception_marked_at', now(),
          'exception_marked_by', v_user_id
        )
      END
  WHERE id = p_movement_id;

  RETURN jsonb_build_object(
    'success', true,
    'movement_id', p_movement_id,
    'status', 'exception'
  );
END;
$$;

GRANT ALL ON FUNCTION public.create_bank_statement_import(text, text, text, jsonb, jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.create_bank_statement_import(text, text, text, jsonb, jsonb) TO service_role;
GRANT ALL ON FUNCTION public.mark_bank_statement_movement_exception(uuid, text) TO authenticated;
GRANT ALL ON FUNCTION public.mark_bank_statement_movement_exception(uuid, text) TO service_role;
