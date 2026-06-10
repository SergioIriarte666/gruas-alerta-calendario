-- Función para sincronizar facturas ya pagadas con el sistema de pagos
CREATE OR REPLACE FUNCTION public.sync_existing_paid_invoices()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  paid_invoice RECORD;
  payment_id UUID;
  synced_count INTEGER := 0;
BEGIN
  -- Verificar permisos
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'No tiene permisos para sincronizar facturas pagadas';
  END IF;

  -- Procesar facturas marcadas como pagadas que no tienen pagos asociados
  FOR paid_invoice IN 
    SELECT i.* FROM public.invoices i
    WHERE i.status = 'paid' 
      AND i.payment_date IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.payment_applications pa
        JOIN public.payments p ON pa.payment_id = p.id
        WHERE pa.invoice_id = i.id
      )
  LOOP
    -- Crear un pago automático para esta factura
    INSERT INTO public.payments (
      client_id,
      amount,
      payment_date,
      payment_method,
      notes,
      status,
      applied_amount,
      created_by
    ) VALUES (
      paid_invoice.client_id,
      paid_invoice.total,
      paid_invoice.payment_date,
      'historico',
      'Pago sincronizado automáticamente desde factura marcada como pagada',
      'applied',
      paid_invoice.total,
      auth.uid()
    ) RETURNING id INTO payment_id;

    -- Crear la aplicación del pago
    INSERT INTO public.payment_applications (
      payment_id,
      invoice_id,
      applied_amount,
      application_method,
      notes,
      created_by
    ) VALUES (
      payment_id,
      paid_invoice.id,
      paid_invoice.total,
      'manual',
      'Aplicación automática de pago histórico',
      auth.uid()
    );

    -- Actualizar campos de la factura para consistencia
    UPDATE public.invoices 
    SET 
      paid_amount = paid_invoice.total,
      updated_at = NOW()
    WHERE id = paid_invoice.id;

    synced_count := synced_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'synced_invoices', synced_count,
    'message', 'Facturas pagadas sincronizadas exitosamente'
  );
END;
$$;

-- Función para obtener historial completo de pagos y facturas por cliente
CREATE OR REPLACE FUNCTION public.get_client_payment_history(p_client_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  client_name TEXT;
  payment_history jsonb;
  invoice_history jsonb;
  summary_data jsonb;
BEGIN
  -- Obtener nombre del cliente
  SELECT name INTO client_name FROM public.clients WHERE id = p_client_id;
  
  -- Historial de pagos
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'amount', p.amount,
      'payment_date', p.payment_date,
      'payment_method', p.payment_method,
      'status', p.status,
      'applied_amount', p.applied_amount,
      'remaining_amount', p.remaining_amount,
      'bank_reference', p.bank_reference,
      'notes', p.notes,
      'created_at', p.created_at,
      'applications', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'invoice_id', pa.invoice_id,
            'invoice_folio', i.folio,
            'applied_amount', pa.applied_amount,
            'application_method', pa.application_method,
            'applied_at', pa.created_at
          )
        )
        FROM public.payment_applications pa
        JOIN public.invoices i ON pa.invoice_id = i.id
        WHERE pa.payment_id = p.id
      )
    ) ORDER BY p.payment_date DESC, p.created_at DESC
  ) INTO payment_history
  FROM public.payments p
  WHERE p.client_id = p_client_id;

  -- Historial de facturas
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'folio', i.folio,
      'issue_date', i.issue_date,
      'due_date', i.due_date,
      'total', i.total,
      'paid_amount', COALESCE(i.paid_amount, 0),
      'remaining_amount', COALESCE(i.remaining_amount, i.total),
      'status', i.status,
      'payment_date', i.payment_date,
      'notes', i.notes,
      'payment_applications', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'payment_id', pa.payment_id,
            'applied_amount', pa.applied_amount,
            'application_method', pa.application_method,
            'applied_at', pa.created_at,
            'payment_reference', p.bank_reference,
            'payment_method', p.payment_method
          )
        )
        FROM public.payment_applications pa
        JOIN public.payments p ON pa.payment_id = p.id
        WHERE pa.invoice_id = i.id
      )
    ) ORDER BY i.issue_date DESC
  ) INTO invoice_history
  FROM public.invoices i
  WHERE i.client_id = p_client_id;

  -- Resumen
  SELECT jsonb_build_object(
    'total_invoices', COUNT(*),
    'total_invoiced', COALESCE(SUM(i.total), 0),
    'total_paid', COALESCE(SUM(i.paid_amount), 0),
    'total_pending', COALESCE(SUM(i.remaining_amount), 0),
    'paid_invoices_count', COUNT(*) FILTER (WHERE i.status = 'paid'),
    'pending_invoices_count', COUNT(*) FILTER (WHERE i.status IN ('sent', 'overdue', 'draft'))
  ) INTO summary_data
  FROM public.invoices i
  WHERE i.client_id = p_client_id;

  RETURN jsonb_build_object(
    'client_id', p_client_id,
    'client_name', client_name,
    'summary', summary_data,
    'payments', COALESCE(payment_history, '[]'::jsonb),
    'invoices', COALESCE(invoice_history, '[]'::jsonb)
  );
END;
$$;