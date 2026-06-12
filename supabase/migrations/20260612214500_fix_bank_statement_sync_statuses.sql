CREATE OR REPLACE FUNCTION public.sync_bank_statement_movement_statuses(
  p_import_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_synced_count integer := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  UPDATE public.bank_statement_movements bsm
  SET
    reconciliation_status = 'reconciled',
    matched_invoice_id = pa.invoice_id,
    payment_id = p.id,
    reconciled_by = coalesce(bsm.reconciled_by, p.created_by),
    reconciled_at = coalesce(bsm.reconciled_at, p.created_at),
    updated_at = now()
  FROM public.payments p
  JOIN public.payment_applications pa ON pa.payment_id = p.id
  WHERE bsm.import_id = p_import_id
    AND bsm.reconciliation_status <> 'reconciled'
    AND p.payment_method = 'cartola_bancaria'
    AND p.status IN ('pending', 'partial', 'applied')
    AND p.amount = bsm.amount
    AND p.payment_date = bsm.transaction_date
    AND coalesce(p.bank_reference, '') = coalesce(bsm.reference_id, 'CARTOLA-' || left(bsm.id::text, 8))
    AND p.notes ILIKE '%' || ('Cartola ' || left(bsm.import_id::text, 8)) || '%'
    AND (
      bsm.payment_id IS DISTINCT FROM p.id
      OR bsm.matched_invoice_id IS DISTINCT FROM pa.invoice_id
      OR bsm.reconciled_at IS NULL
    );

  GET DIAGNOSTICS v_synced_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'synced_movements', v_synced_count
  );
END;
$$;

GRANT ALL ON FUNCTION public.sync_bank_statement_movement_statuses(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.sync_bank_statement_movement_statuses(uuid) TO service_role;
