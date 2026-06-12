CREATE TABLE IF NOT EXISTS public.bank_statement_imports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name text NOT NULL,
  file_type text NOT NULL,
  bank_name text,
  status text NOT NULL DEFAULT 'completed',
  total_movements integer NOT NULL DEFAULT 0,
  uploaded_by uuid REFERENCES public.profiles(id),
  processing_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_statement_imports_file_type_check
    CHECK (file_type IN ('pdf', 'xls', 'xlsx')),
  CONSTRAINT bank_statement_imports_status_check
    CHECK (status IN ('processing', 'completed', 'failed'))
);

CREATE TABLE IF NOT EXISTS public.bank_statement_movements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id uuid NOT NULL REFERENCES public.bank_statement_imports(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  transaction_date date NOT NULL,
  posted_date date,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'CLP',
  description text,
  reference_id text,
  payer_name text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reconciliation_status text NOT NULL DEFAULT 'pending',
  matched_invoice_id uuid REFERENCES public.invoices(id),
  payment_id uuid REFERENCES public.payments(id),
  reconciled_by uuid REFERENCES public.profiles(id),
  reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_statement_movements_amount_check CHECK (amount <> 0::numeric),
  CONSTRAINT bank_statement_movements_currency_check CHECK (currency <> ''),
  CONSTRAINT bank_statement_movements_status_check
    CHECK (reconciliation_status IN ('pending', 'matched', 'reconciled', 'exception')),
  CONSTRAINT bank_statement_movements_import_row_unique UNIQUE (import_id, row_index)
);

CREATE INDEX IF NOT EXISTS idx_bank_statement_imports_created_at
  ON public.bank_statement_imports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bank_statement_movements_import_id
  ON public.bank_statement_movements(import_id);

CREATE INDEX IF NOT EXISTS idx_bank_statement_movements_status
  ON public.bank_statement_movements(reconciliation_status);

CREATE INDEX IF NOT EXISTS idx_bank_statement_movements_amount
  ON public.bank_statement_movements(amount);

ALTER TABLE public.bank_statement_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view bank statement imports" ON public.bank_statement_imports;
CREATE POLICY "Authenticated users can view bank statement imports"
  ON public.bank_statement_imports
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert bank statement imports" ON public.bank_statement_imports;
CREATE POLICY "Authenticated users can insert bank statement imports"
  ON public.bank_statement_imports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update bank statement imports" ON public.bank_statement_imports;
CREATE POLICY "Authenticated users can update bank statement imports"
  ON public.bank_statement_imports
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can view bank statement movements" ON public.bank_statement_movements;
CREATE POLICY "Authenticated users can view bank statement movements"
  ON public.bank_statement_movements
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert bank statement movements" ON public.bank_statement_movements;
CREATE POLICY "Authenticated users can insert bank statement movements"
  ON public.bank_statement_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update bank statement movements" ON public.bank_statement_movements;
CREATE POLICY "Authenticated users can update bank statement movements"
  ON public.bank_statement_movements
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (auth.uid() IS NOT NULL);

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
  match_score integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_movement public.bank_statement_movements%ROWTYPE;
  v_haystack text;
BEGIN
  SELECT *
  INTO v_movement
  FROM public.bank_statement_movements
  WHERE id = p_movement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimiento bancario no encontrado';
  END IF;

  v_haystack := upper(
    coalesce(v_movement.description, '') || ' ' ||
    coalesce(v_movement.reference_id, '') || ' ' ||
    coalesce(v_movement.payer_name, '')
  );

  RETURN QUERY
  SELECT
    i.id,
    i.folio,
    i.numero_fiscal,
    i.client_id,
    c.name,
    c.rut,
    i.total,
    i.issue_date,
    i.due_date,
    (
      CASE
        WHEN coalesce(i.numero_fiscal, '') <> '' AND position(upper(i.numero_fiscal) IN v_haystack) > 0 THEN 100
        ELSE 0
      END
      + CASE
        WHEN coalesce(i.folio, '') <> '' AND position(upper(i.folio) IN v_haystack) > 0 THEN 50
        ELSE 0
      END
      + CASE
        WHEN coalesce(c.name, '') <> '' AND position(upper(c.name) IN v_haystack) > 0 THEN 25
        ELSE 0
      END
      + CASE
        WHEN coalesce(c.rut, '') <> '' AND position(upper(regexp_replace(c.rut, '[^0-9Kk]', '', 'g')) IN regexp_replace(v_haystack, '[^0-9A-Z]', '', 'g')) > 0 THEN 20
        ELSE 0
      END
    )::integer AS match_score
  FROM public.invoices i
  JOIN public.clients c ON c.id = i.client_id
  WHERE coalesce(i.paid_amount, 0) = 0
    AND i.total = v_movement.amount
    AND i.status IN ('sent', 'overdue')
  ORDER BY match_score DESC, i.due_date ASC, i.issue_date ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_bank_statement_movement_full(
  p_movement_id uuid,
  p_invoice_id uuid
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
    RAISE EXCEPTION 'La conciliación con cartola solo acepta facturas sin pagos previos';
  END IF;

  IF v_invoice.total <> v_movement.amount THEN
    RAISE EXCEPTION 'El monto del movimiento no coincide exactamente con el total de la factura';
  END IF;

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
    v_movement.transaction_date,
    coalesce(v_movement.reference_id, 'CARTOLA-' || left(v_movement.id::text, 8)),
    'cartola_bancaria',
    left(
      coalesce(v_movement.description, 'Conciliación bancaria total')
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

GRANT ALL ON TABLE public.bank_statement_imports TO authenticated;
GRANT ALL ON TABLE public.bank_statement_imports TO service_role;
GRANT ALL ON TABLE public.bank_statement_movements TO authenticated;
GRANT ALL ON TABLE public.bank_statement_movements TO service_role;

GRANT ALL ON FUNCTION public.list_bank_statement_invoice_candidates(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.list_bank_statement_invoice_candidates(uuid) TO service_role;
GRANT ALL ON FUNCTION public.reconcile_bank_statement_movement_full(uuid, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.reconcile_bank_statement_movement_full(uuid, uuid) TO service_role;
