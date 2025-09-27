-- Update apply_payment_selective function to add apply_only_to_specified parameter
CREATE OR REPLACE FUNCTION public.apply_payment_selective(
  p_payment_id UUID,
  p_fiscal_numbers TEXT[],
  p_apply_only_to_specified BOOLEAN DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_payment RECORD;
  v_invoice RECORD;
  v_amount_to_apply DECIMAL;
  v_remaining_payment DECIMAL;
  v_applied_total DECIMAL := 0;
  v_applications_created INTEGER := 0;
  v_error_msg TEXT;
BEGIN
  -- Get payment information
  SELECT * INTO v_payment
  FROM payments 
  WHERE id = p_payment_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pago no encontrado'
    );
  END IF;
  
  -- Initialize remaining payment amount
  v_remaining_payment := v_payment.amount - COALESCE(v_payment.applied_amount, 0);
  
  IF v_remaining_payment <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'El pago ya está completamente aplicado'
    );
  END IF;
  
  -- First phase: Apply to specified invoices by fiscal number
  IF array_length(p_fiscal_numbers, 1) > 0 THEN
    FOR i IN 1..array_length(p_fiscal_numbers, 1) LOOP
      EXIT WHEN v_remaining_payment <= 0;
      
      -- Find invoice by fiscal number for this client
      SELECT * INTO v_invoice
      FROM invoices 
      WHERE numero_fiscal = p_fiscal_numbers[i]
        AND client_id = v_payment.client_id
        AND status IN ('sent', 'overdue', 'partial')
        AND (total - COALESCE(paid_amount, 0)) > 0;
      
      IF FOUND THEN
        -- Calculate amount to apply (minimum of remaining payment and remaining invoice)
        v_amount_to_apply := LEAST(
          v_remaining_payment,
          v_invoice.total - COALESCE(v_invoice.paid_amount, 0)
        );
        
        -- Create payment application
        INSERT INTO payment_applications (
          payment_id,
          invoice_id,
          applied_amount,
          application_method,
          created_by
        ) VALUES (
          p_payment_id,
          v_invoice.id,
          v_amount_to_apply,
          'manual',
          v_payment.created_by
        );
        
        v_applied_total := v_applied_total + v_amount_to_apply;
        v_remaining_payment := v_remaining_payment - v_amount_to_apply;
        v_applications_created := v_applications_created + 1;
        
        RAISE NOTICE 'Applied % to invoice % (%)', v_amount_to_apply, v_invoice.folio, v_invoice.numero_fiscal;
      ELSE
        RAISE NOTICE 'Invoice with fiscal number % not found or not applicable', p_fiscal_numbers[i];
      END IF;
    END LOOP;
  END IF;
  
  -- Second phase: Apply remaining amount using FIFO (only if apply_only_to_specified is FALSE)
  IF NOT p_apply_only_to_specified AND v_remaining_payment > 0 THEN
    FOR v_invoice IN 
      SELECT *
      FROM invoices
      WHERE client_id = v_payment.client_id
        AND status IN ('sent', 'overdue', 'partial')
        AND (total - COALESCE(paid_amount, 0)) > 0
        AND id NOT IN (
          SELECT invoice_id 
          FROM payment_applications 
          WHERE payment_id = p_payment_id
        )
      ORDER BY issue_date ASC
    LOOP
      EXIT WHEN v_remaining_payment <= 0;
      
      v_amount_to_apply := LEAST(
        v_remaining_payment,
        v_invoice.total - COALESCE(v_invoice.paid_amount, 0)
      );
      
      INSERT INTO payment_applications (
        payment_id,
        invoice_id,
        applied_amount,
        application_method,
        created_by
      ) VALUES (
        p_payment_id,
        v_invoice.id,
        v_amount_to_apply,
        'fifo',
        v_payment.created_by
      );
      
      v_applied_total := v_applied_total + v_amount_to_apply;
      v_remaining_payment := v_remaining_payment - v_amount_to_apply;
      v_applications_created := v_applications_created + 1;
      
      RAISE NOTICE 'Applied % to invoice % via FIFO', v_amount_to_apply, v_invoice.folio;
    END LOOP;
  END IF;
  
  -- Update payment status
  UPDATE payments 
  SET 
    applied_amount = COALESCE(applied_amount, 0) + v_applied_total,
    status = CASE 
      WHEN (COALESCE(applied_amount, 0) + v_applied_total) >= amount THEN 'applied'::payment_status
      WHEN (COALESCE(applied_amount, 0) + v_applied_total) > 0 THEN 'partial'::payment_status
      ELSE 'pending'::payment_status
    END,
    updated_at = NOW()
  WHERE id = p_payment_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'applied_amount', v_applied_total,
    'remaining_amount', v_remaining_payment,
    'applications_created', v_applications_created,
    'apply_only_to_specified', p_apply_only_to_specified,
    'message', format('Aplicado %s en %s aplicaciones. Saldo restante: %s', 
      v_applied_total, v_applications_created, v_remaining_payment)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$function$;