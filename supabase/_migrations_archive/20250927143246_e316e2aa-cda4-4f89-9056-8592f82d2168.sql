-- Create selective payment application function
CREATE OR REPLACE FUNCTION public.apply_payment_selective(
  p_payment_id UUID,
  p_fiscal_numbers TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payment_record RECORD;
  invoice_record RECORD;
  remaining_amount DECIMAL;
  applied_count INTEGER := 0;
  total_applied DECIMAL := 0;
  application_results JSONB := '[]'::jsonb;
  current_user_id UUID;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Get payment details
  SELECT * INTO payment_record
  FROM public.payments 
  WHERE id = p_payment_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pago no encontrado'
    );
  END IF;
  
  remaining_amount := payment_record.amount - COALESCE(payment_record.applied_amount, 0);
  
  IF remaining_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'El pago ya está completamente aplicado'
    );
  END IF;
  
  -- If fiscal numbers provided, apply to specific invoices
  IF p_fiscal_numbers IS NOT NULL AND array_length(p_fiscal_numbers, 1) > 0 THEN
    FOR invoice_record IN 
      SELECT i.id, i.folio, i.numero_fiscal, i.total, COALESCE(i.paid_amount, 0) as paid_amount
      FROM public.invoices i
      WHERE i.client_id = payment_record.client_id
        AND i.numero_fiscal = ANY(p_fiscal_numbers)
        AND i.status IN ('sent', 'overdue', 'partial')
        AND (i.total - COALESCE(i.paid_amount, 0)) > 0
      ORDER BY i.issue_date ASC
    LOOP
      DECLARE
        pending_amount DECIMAL;
        application_amount DECIMAL;
      BEGIN
        pending_amount := invoice_record.total - invoice_record.paid_amount;
        application_amount := LEAST(pending_amount, remaining_amount);
        
        IF application_amount > 0 THEN
          -- Insert payment application
          INSERT INTO public.payment_applications (
            payment_id,
            invoice_id,
            applied_amount,
            application_method,
            created_by
          ) VALUES (
            p_payment_id,
            invoice_record.id,
            application_amount,
            'selective'::application_method,
            current_user_id
          );
          
          remaining_amount := remaining_amount - application_amount;
          total_applied := total_applied + application_amount;
          applied_count := applied_count + 1;
          
          -- Add to results
          application_results := application_results || jsonb_build_object(
            'invoice_id', invoice_record.id,
            'folio', invoice_record.folio,
            'fiscal_number', invoice_record.numero_fiscal,
            'applied_amount', application_amount
          );
          
          -- If payment is fully applied, stop
          IF remaining_amount <= 0.01 THEN
            EXIT;
          END IF;
        END IF;
      END;
    END LOOP;
  ELSE
    -- Apply FIFO if no specific invoices provided
    FOR invoice_record IN 
      SELECT i.id, i.folio, i.numero_fiscal, i.total, COALESCE(i.paid_amount, 0) as paid_amount
      FROM public.invoices i
      WHERE i.client_id = payment_record.client_id
        AND i.status IN ('sent', 'overdue', 'partial')
        AND (i.total - COALESCE(i.paid_amount, 0)) > 0
      ORDER BY i.issue_date ASC
    LOOP
      DECLARE
        pending_amount DECIMAL;
        application_amount DECIMAL;
      BEGIN
        pending_amount := invoice_record.total - invoice_record.paid_amount;
        application_amount := LEAST(pending_amount, remaining_amount);
        
        IF application_amount > 0 THEN
          -- Insert payment application
          INSERT INTO public.payment_applications (
            payment_id,
            invoice_id,
            applied_amount,
            application_method,
            created_by
          ) VALUES (
            p_payment_id,
            invoice_record.id,
            application_amount,
            'fifo'::application_method,
            current_user_id
          );
          
          remaining_amount := remaining_amount - application_amount;
          total_applied := total_applied + application_amount;
          applied_count := applied_count + 1;
          
          -- Add to results
          application_results := application_results || jsonb_build_object(
            'invoice_id', invoice_record.id,
            'folio', invoice_record.folio,
            'fiscal_number', invoice_record.numero_fiscal,
            'applied_amount', application_amount
          );
          
          -- If payment is fully applied, stop
          IF remaining_amount <= 0.01 THEN
            EXIT;
          END IF;
        END IF;
      END;
    END LOOP;
  END IF;
  
  -- Update payment status
  UPDATE public.payments
  SET 
    applied_amount = COALESCE(applied_amount, 0) + total_applied,
    status = CASE 
      WHEN (COALESCE(applied_amount, 0) + total_applied) >= amount THEN 'applied'::payment_status
      WHEN total_applied > 0 THEN 'partial'::payment_status
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = p_payment_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'applied_invoices', applied_count,
    'total_applied', total_applied,
    'remaining_amount', remaining_amount,
    'applications', application_results,
    'message', format('Pago aplicado exitosamente a %s facturas por un total de $%s', applied_count, total_applied)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Error aplicando pago: ' || SQLERRM,
      'error_code', SQLSTATE
    );
END;
$function$;