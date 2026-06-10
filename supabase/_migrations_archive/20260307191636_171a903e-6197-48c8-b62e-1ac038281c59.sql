CREATE OR REPLACE FUNCTION public.apply_payment_fifo(p_payment_id uuid, p_client_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  payment_record RECORD;
  invoice_record RECORD;
  remaining_payment DECIMAL(10,2);
  amount_to_apply DECIMAL(10,2);
  applications_made INTEGER := 0;
  total_applied DECIMAL(10,2) := 0;
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'No tiene permisos para aplicar pagos';
  END IF;

  SELECT * INTO payment_record FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pago no encontrado'; END IF;

  IF p_client_id IS NULL THEN p_client_id := payment_record.client_id; END IF;
  remaining_payment := payment_record.amount - payment_record.applied_amount;

  FOR invoice_record IN 
    SELECT * FROM public.invoices 
    WHERE client_id = p_client_id 
      AND status IN ('sent', 'overdue', 'draft') 
      AND remaining_amount > 0
      AND folio NOT LIKE 'HIST-%'
    ORDER BY due_date ASC, created_at ASC
  LOOP
    EXIT WHEN remaining_payment <= 0;
    amount_to_apply := LEAST(remaining_payment, invoice_record.remaining_amount);
    
    INSERT INTO public.payment_applications (payment_id, invoice_id, applied_amount, application_method, created_by) 
    VALUES (p_payment_id, invoice_record.id, amount_to_apply, 'fifo', auth.uid());
    
    UPDATE public.invoices SET paid_amount = paid_amount + amount_to_apply, updated_at = NOW() WHERE id = invoice_record.id;
    
    remaining_payment := remaining_payment - amount_to_apply;
    total_applied := total_applied + amount_to_apply;
    applications_made := applications_made + 1;
  END LOOP;

  UPDATE public.invoices SET status = 'paid', payment_date = payment_record.payment_date
  WHERE client_id = p_client_id AND remaining_amount = 0 AND status != 'paid' AND folio NOT LIKE 'HIST-%';

  RETURN jsonb_build_object(
    'success', true, 
    'applications_made', applications_made, 
    'total_applied', total_applied, 
    'remaining_payment', remaining_payment
  );
END;
$function$;