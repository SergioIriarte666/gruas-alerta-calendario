BEGIN;

CREATE OR REPLACE FUNCTION public.reconcile_bank_statement_movement_full(
  p_movement_id uuid,
  p_invoice_id uuid,
  p_payment_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_movement public.bank_statement_movements%ROWTYPE;
  v_invoice public.invoices%ROWTYPE;
  v_payment_id uuid;
  v_application_result jsonb;
  v_effective_payment_date date;
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
    RAISE EXCEPTION 'El movimiento ya fue conciliado';
  END IF;

  IF v_movement.amount <= 0 THEN
    RAISE EXCEPTION 'Solo se pueden conciliar abonos positivos';
  END IF;

  SELECT *
  INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  IF v_invoice.status NOT IN ('sent', 'overdue') THEN
    RAISE EXCEPTION 'La factura no se encuentra en un estado conciliable';
  END IF;

  IF coalesce(v_invoice.paid_amount, 0) <> 0 THEN
    RAISE EXCEPTION 'La conciliacion con cartola solo acepta facturas sin pagos previos';
  END IF;

  IF v_invoice.total <> v_movement.amount THEN
    RAISE EXCEPTION 'El monto del movimiento no coincide exactamente con el total de la factura';
  END IF;

  v_effective_payment_date := coalesce(p_payment_date, v_movement.transaction_date);

  INSERT INTO public.payments (
    client_id,
    amount,
    payment_date,
    bank_reference,
    payment_method,
    notes,
    status,
    created_by
  ) VALUES (
    v_invoice.client_id,
    v_movement.amount,
    v_effective_payment_date,
    coalesce(v_movement.reference_id, 'CARTOLA-' || left(v_movement.id::text, 8)),
    'cartola_bancaria',
    left(
      coalesce(v_movement.description, 'Conciliacion bancaria total')
      || ' | Cartola ' || left(v_movement.import_id::text, 8),
      500
    ),
    'pending',
    v_user_id
  )
  RETURNING id INTO v_payment_id;

  SELECT public.apply_payment_manual(
    v_payment_id,
    jsonb_build_array(
      jsonb_build_object(
        'invoice_id', p_invoice_id,
        'amount', v_movement.amount
      )
    )
  )
  INTO v_application_result;

  IF coalesce((v_application_result ->> 'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'No se pudo aplicar el pago a la factura';
  END IF;

  UPDATE public.bank_statement_movements
  SET
    reconciliation_status = 'reconciled',
    matched_invoice_id = p_invoice_id,
    payment_id = v_payment_id,
    reconciled_by = v_user_id,
    reconciled_at = now(),
    updated_at = now()
  WHERE id = p_movement_id;

  RETURN jsonb_build_object(
    'success', true,
    'movement_id', p_movement_id,
    'invoice_id', p_invoice_id,
    'payment_id', v_payment_id
  );
END;
$$;

COMMIT;
