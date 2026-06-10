-- Función para crear automáticamente un pago cuando se marca una factura como pagada
CREATE OR REPLACE FUNCTION public.create_automatic_payment_for_invoice(
  p_invoice_id uuid,
  p_payment_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invoice_record record;
  new_payment_id uuid;
  result jsonb;
BEGIN
  -- Obtener datos de la factura
  SELECT id, client_id, total, folio, status, paid_amount
  INTO invoice_record
  FROM public.invoices
  WHERE id = p_invoice_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Factura no encontrada'
    );
  END IF;
  
  -- Verificar si ya tiene un pago asociado
  IF EXISTS (
    SELECT 1 FROM public.payment_applications pa
    JOIN public.payments p ON pa.payment_id = p.id
    WHERE pa.invoice_id = p_invoice_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'La factura ya tiene pagos asociados'
    );
  END IF;
  
  -- Crear el pago automático
  INSERT INTO public.payments (
    client_id,
    amount,
    payment_date,
    payment_method,
    notes,
    status,
    applied_amount,
    remaining_amount,
    created_by
  ) VALUES (
    invoice_record.client_id,
    invoice_record.total,
    p_payment_date,
    'transferencia',
    'Pago automático generado al marcar factura ' || invoice_record.folio || ' como pagada',
    'applied',
    invoice_record.total,
    0,
    auth.uid()
  ) RETURNING id INTO new_payment_id;
  
  -- Crear la aplicación del pago
  INSERT INTO public.payment_applications (
    payment_id,
    invoice_id,
    applied_amount,
    application_method,
    notes,
    created_by
  ) VALUES (
    new_payment_id,
    p_invoice_id,
    invoice_record.total,
    'manual',
    'Aplicación automática al marcar como pagada',
    auth.uid()
  );
  
  -- Actualizar la factura con los montos
  UPDATE public.invoices
  SET 
    paid_amount = invoice_record.total,
    remaining_amount = 0,
    updated_at = now()
  WHERE id = p_invoice_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', new_payment_id,
    'invoice_id', p_invoice_id,
    'amount', invoice_record.total
  );
END;
$$;