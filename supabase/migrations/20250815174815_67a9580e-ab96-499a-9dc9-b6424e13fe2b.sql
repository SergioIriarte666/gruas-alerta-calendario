-- Función para validar consistencia de montos de pagos
CREATE OR REPLACE FUNCTION public.validate_payment_amounts()
RETURNS TABLE(payment_id uuid, folio text, amount numeric, applied_amount numeric, calculated_applied numeric, remaining_amount numeric, is_inconsistent boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as payment_id,
    COALESCE(p.bank_reference, 'Sin referencia') as folio,
    p.amount,
    p.applied_amount,
    COALESCE((
      SELECT SUM(pa.applied_amount) 
      FROM public.payment_applications pa 
      WHERE pa.payment_id = p.id
    ), 0) as calculated_applied,
    p.remaining_amount,
    (p.applied_amount > p.amount OR p.remaining_amount < 0 OR 
     p.applied_amount != COALESCE((
       SELECT SUM(pa.applied_amount) 
       FROM public.payment_applications pa 
       WHERE pa.payment_id = p.id
     ), 0)) as is_inconsistent
  FROM public.payments p
  ORDER BY p.created_at DESC;
END;
$function$