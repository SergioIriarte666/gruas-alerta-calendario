-- Fix apply_payment_fifo function to handle duplicates properly
CREATE OR REPLACE FUNCTION public.apply_payment_fifo(p_payment_id uuid, p_client_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_payment RECORD;
  v_invoice RECORD;
  v_applied_amount DECIMAL;
  v_remaining_payment DECIMAL;
  v_application_count INTEGER := 0;
  v_total_applied DECIMAL := 0;
  v_existing_application RECORD;
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
  
  -- Check if payment is already fully applied
  IF v_payment.applied_amount >= v_payment.amount THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'El pago ya está completamente aplicado',
      'payment_id', p_payment_id,
      'applied_amount', v_payment.applied_amount,
      'total_applications', 0
    );
  END IF;
  
  -- Calculate remaining amount to apply
  v_remaining_payment := v_payment.amount - COALESCE(v_payment.applied_amount, 0);
  
  -- Get unpaid invoices for the client (FIFO order)
  FOR v_invoice IN
    SELECT i.* 
    FROM invoices i
    WHERE i.client_id = COALESCE(p_client_id, v_payment.client_id)
      AND i.status IN ('sent', 'overdue', 'partial')
      AND (i.total - COALESCE(i.paid_amount, 0)) > 0
    ORDER BY i.issue_date ASC, i.created_at ASC
  LOOP
    -- Exit if no remaining payment amount
    EXIT WHEN v_remaining_payment <= 0;
    
    -- Check if application already exists for this payment-invoice pair
    SELECT * INTO v_existing_application
    FROM payment_applications 
    WHERE payment_id = p_payment_id AND invoice_id = v_invoice.id;
    
    IF FOUND THEN
      RAISE NOTICE 'Aplicación ya existe para pago % e factura %', p_payment_id, v_invoice.id;
      CONTINUE; -- Skip this invoice
    END IF;
    
    -- Calculate how much can be applied to this invoice
    v_applied_amount := LEAST(
      v_remaining_payment, 
      v_invoice.total - COALESCE(v_invoice.paid_amount, 0)
    );
    
    -- Only create application if amount > 0
    IF v_applied_amount > 0 THEN
      -- Insert payment application with conflict handling
      INSERT INTO payment_applications (
        payment_id, 
        invoice_id, 
        applied_amount, 
        application_method,
        notes,
        created_by
      ) 
      VALUES (
        p_payment_id, 
        v_invoice.id, 
        v_applied_amount, 
        'fifo',
        'Aplicación automática FIFO',
        auth.uid()
      )
      ON CONFLICT (payment_id, invoice_id) DO NOTHING;
      
      -- Check if the insert was successful
      GET DIAGNOSTICS v_application_count = ROW_COUNT;
      
      IF v_application_count > 0 THEN
        v_total_applied := v_total_applied + v_applied_amount;
        v_remaining_payment := v_remaining_payment - v_applied_amount;
        
        RAISE NOTICE 'Aplicado $% a factura %', v_applied_amount, v_invoice.folio;
      ELSE
        RAISE NOTICE 'No se pudo aplicar a factura % (posible duplicado)', v_invoice.folio;
      END IF;
    END IF;
  END LOOP;
  
  -- Update payment status
  UPDATE payments 
  SET 
    applied_amount = COALESCE(applied_amount, 0) + v_total_applied,
    status = CASE 
      WHEN COALESCE(applied_amount, 0) + v_total_applied >= amount THEN 'applied'::payment_status
      WHEN COALESCE(applied_amount, 0) + v_total_applied > 0 THEN 'partial'::payment_status
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = p_payment_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'total_applied', v_total_applied,
    'remaining_amount', v_payment.amount - (COALESCE(v_payment.applied_amount, 0) + v_total_applied),
    'applications_created', CASE WHEN v_total_applied > 0 THEN 1 ELSE 0 END,
    'message', CASE 
      WHEN v_total_applied > 0 THEN format('Aplicados $%s mediante FIFO', v_total_applied)
      ELSE 'No se aplicó ningún monto (posibles aplicaciones duplicadas o facturas ya pagadas)'
    END
  );
END;
$function$;

-- Create function to diagnose payment application conflicts
CREATE OR REPLACE FUNCTION public.diagnose_payment_application_conflicts(p_payment_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  conflict_data jsonb;
  payment_summary jsonb;
BEGIN
  -- If specific payment provided, focus on that
  IF p_payment_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'payment_id', p.id,
      'client_id', p.client_id,
      'amount', p.amount,
      'applied_amount', p.applied_amount,
      'status', p.status,
      'payment_date', p.payment_date,
      'bank_reference', p.bank_reference,
      'applications', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'application_id', pa.id,
            'invoice_id', pa.invoice_id,
            'invoice_folio', i.folio,
            'applied_amount', pa.applied_amount,
            'application_method', pa.application_method,
            'created_at', pa.created_at
          ) ORDER BY pa.created_at
        )
        FROM payment_applications pa
        JOIN invoices i ON pa.invoice_id = i.id
        WHERE pa.payment_id = p.id
      ),
      'calculated_applied', (
        SELECT COALESCE(SUM(pa.applied_amount), 0)
        FROM payment_applications pa
        WHERE pa.payment_id = p.id
      )
    ) INTO payment_summary
    FROM payments p
    WHERE p.id = p_payment_id;
    
    RETURN jsonb_build_object(
      'timestamp', NOW(),
      'payment_analysis', payment_summary,
      'has_conflicts', payment_summary->'applied_amount' != payment_summary->'calculated_applied'
    );
  END IF;
  
  -- General conflict analysis
  SELECT jsonb_agg(
    jsonb_build_object(
      'payment_id', p.id,
      'client_name', c.name,
      'amount', p.amount,
      'recorded_applied', p.applied_amount,
      'calculated_applied', calculated_applied,
      'difference', p.applied_amount - calculated_applied,
      'applications_count', applications_count,
      'status', p.status,
      'bank_reference', p.bank_reference
    )
  ) INTO conflict_data
  FROM payments p
  JOIN clients c ON p.client_id = c.id
  CROSS JOIN LATERAL (
    SELECT 
      COALESCE(SUM(pa.applied_amount), 0) as calculated_applied,
      COUNT(*) as applications_count
    FROM payment_applications pa
    WHERE pa.payment_id = p.id
  ) calc
  WHERE ABS(p.applied_amount - calculated_applied) > 0.01
     OR (p.status = 'applied' AND calculated_applied < p.amount)
     OR (p.status = 'pending' AND calculated_applied > 0);
  
  RETURN jsonb_build_object(
    'timestamp', NOW(),
    'conflicts_found', jsonb_array_length(COALESCE(conflict_data, '[]'::jsonb)),
    'conflicted_payments', COALESCE(conflict_data, '[]'::jsonb),
    'system_health', CASE 
      WHEN conflict_data IS NULL THEN 'HEALTHY'
      ELSE 'NEEDS_ATTENTION'
    END
  );
END;
$function$;

-- Create function to resolve payment application conflicts
CREATE OR REPLACE FUNCTION public.resolve_payment_application_conflicts(p_payment_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payment_record RECORD;
  resolved_count INTEGER := 0;
  total_calculated DECIMAL;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden resolver conflictos de aplicación de pagos';
  END IF;
  
  -- If specific payment provided
  IF p_payment_id IS NOT NULL THEN
    -- Calculate correct applied amount
    SELECT 
      p.*,
      COALESCE(SUM(pa.applied_amount), 0) as calculated_applied
    INTO payment_record
    FROM payments p
    LEFT JOIN payment_applications pa ON p.id = pa.payment_id
    WHERE p.id = p_payment_id
    GROUP BY p.id, p.client_id, p.amount, p.applied_amount, p.status, p.payment_date, p.bank_reference, p.payment_method, p.notes, p.created_at, p.updated_at, p.created_by;
    
    IF FOUND AND ABS(payment_record.applied_amount - payment_record.calculated_applied) > 0.01 THEN
      -- Update payment with correct applied amount
      UPDATE payments 
      SET 
        applied_amount = payment_record.calculated_applied,
        status = CASE 
          WHEN payment_record.calculated_applied >= amount THEN 'applied'::payment_status
          WHEN payment_record.calculated_applied > 0 THEN 'partial'::payment_status
          ELSE 'pending'::payment_status
        END,
        updated_at = NOW()
      WHERE id = p_payment_id;
      
      resolved_count := 1;
    END IF;
  ELSE
    -- Resolve all conflicts
    FOR payment_record IN 
      SELECT 
        p.id,
        p.amount,
        p.applied_amount,
        COALESCE(SUM(pa.applied_amount), 0) as calculated_applied
      FROM payments p
      LEFT JOIN payment_applications pa ON p.id = pa.payment_id
      GROUP BY p.id, p.amount, p.applied_amount
      HAVING ABS(p.applied_amount - COALESCE(SUM(pa.applied_amount), 0)) > 0.01
    LOOP
      UPDATE payments 
      SET 
        applied_amount = payment_record.calculated_applied,
        status = CASE 
          WHEN payment_record.calculated_applied >= payment_record.amount THEN 'applied'::payment_status
          WHEN payment_record.calculated_applied > 0 THEN 'partial'::payment_status
          ELSE 'pending'::payment_status
        END,
        updated_at = NOW()
      WHERE id = payment_record.id;
      
      resolved_count := resolved_count + 1;
    END LOOP;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'resolved_payments', resolved_count,
    'message', format('Resueltos conflictos en %s pagos', resolved_count),
    'timestamp', NOW()
  );
END;
$function$;