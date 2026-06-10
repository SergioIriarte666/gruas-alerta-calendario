-- Create a function to fix the specific payment issue from the screenshots
CREATE OR REPLACE FUNCTION public.fix_specific_payment_issue(
  p_payment_id UUID DEFAULT '019354ad-1fc6-7a97-9faa-f48fa2cb6abc'::UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  correct_fiscal_numbers TEXT[] := ARRAY['3779', '3781', '3782', '3783', '3784'];
  unwanted_fiscal_numbers TEXT[] := ARRAY['3772', '3794', '3795', '3798'];
  v_removed_count INTEGER := 0;
  v_kept_count INTEGER := 0;
  v_payment_amount DECIMAL;
  v_remaining_applied DECIMAL;
BEGIN
  -- Get payment amount
  SELECT amount INTO v_payment_amount
  FROM payments 
  WHERE id = p_payment_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pago no encontrado'
    );
  END IF;
  
  -- Remove unwanted applications
  DELETE FROM payment_applications 
  WHERE payment_id = p_payment_id
    AND invoice_id IN (
      SELECT id FROM invoices 
      WHERE numero_fiscal = ANY(unwanted_fiscal_numbers)
    );
  
  GET DIAGNOSTICS v_removed_count = ROW_COUNT;
  
  -- Count remaining applications
  SELECT COUNT(*) INTO v_kept_count
  FROM payment_applications pa
  JOIN invoices i ON pa.invoice_id = i.id
  WHERE pa.payment_id = p_payment_id
    AND i.numero_fiscal = ANY(correct_fiscal_numbers);
  
  -- Calculate remaining applied amount
  SELECT COALESCE(SUM(applied_amount), 0) INTO v_remaining_applied
  FROM payment_applications
  WHERE payment_id = p_payment_id;
  
  -- Update payment status
  UPDATE payments 
  SET 
    applied_amount = v_remaining_applied,
    status = CASE 
      WHEN v_remaining_applied >= amount THEN 'applied'::payment_status
      WHEN v_remaining_applied > 0 THEN 'partial'::payment_status
      ELSE 'pending'::payment_status
    END,
    updated_at = NOW()
  WHERE id = p_payment_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'payment_amount', v_payment_amount,
    'removed_applications', v_removed_count,
    'kept_applications', v_kept_count,
    'remaining_applied_amount', v_remaining_applied,
    'message', format('Corregido pago: eliminadas %s aplicaciones incorrectas, mantenidas %s correctas', 
      v_removed_count, v_kept_count)
  );
END;
$function$;