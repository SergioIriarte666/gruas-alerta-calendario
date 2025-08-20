-- Drop and recreate the get_client_payment_history function with proper error handling
DROP FUNCTION IF EXISTS public.get_client_payment_history(UUID);

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
  
  -- Historial de pagos con aplicaciones correctas
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'amount', p.amount,
      'payment_date', p.payment_date,
      'payment_method', p.payment_method,
      'status', p.status,
      'applied_amount', p.applied_amount,
      'remaining_amount', p.amount - COALESCE(p.applied_amount, 0),
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

  -- Historial de facturas con pagos aplicados
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'folio', i.folio,
      'issue_date', i.issue_date,
      'due_date', i.due_date,
      'total', i.total,
      'paid_amount', COALESCE(i.paid_amount, 0),
      'remaining_amount', i.total - COALESCE(i.paid_amount, 0),
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

  -- Resumen financiero
  SELECT jsonb_build_object(
    'total_invoices', COUNT(*),
    'total_invoiced', COALESCE(SUM(i.total), 0),
    'total_paid', COALESCE(SUM(i.paid_amount), 0),
    'total_pending', COALESCE(SUM(i.total - COALESCE(i.paid_amount, 0)), 0),
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
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in get_client_payment_history: %', SQLERRM;
    RETURN jsonb_build_object(
      'error', true,
      'message', SQLERRM,
      'client_id', p_client_id
    );
END;
$$;