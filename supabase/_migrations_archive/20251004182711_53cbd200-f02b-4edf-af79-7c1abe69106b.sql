-- Corregir funciones de aplicación de pagos para evitar duplicación
-- Primero hacemos DROP y luego recreamos las funciones

-- 1. Drop de funciones existentes
DROP FUNCTION IF EXISTS public.apply_payment_fifo(uuid, uuid);
DROP FUNCTION IF EXISTS public.apply_payment_manual(uuid, jsonb);

-- 2. Recrear apply_payment_fifo sin actualización manual de payments
CREATE OR REPLACE FUNCTION public.apply_payment_fifo(p_payment_id uuid, p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payment_record RECORD;
  invoice_record RECORD;
  amount_to_apply DECIMAL;
  remaining_payment DECIMAL;
  total_applied DECIMAL := 0;
  applications_count INTEGER := 0;
BEGIN
  -- Verificar permisos
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'No tienes permisos para aplicar pagos';
  END IF;

  -- Obtener datos del pago
  SELECT * INTO payment_record
  FROM public.payments 
  WHERE id = p_payment_id AND client_id = p_client_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pago no encontrado';
  END IF;

  remaining_payment := payment_record.amount - COALESCE(payment_record.applied_amount, 0);
  
  IF remaining_payment <= 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'El pago ya está completamente aplicado',
      'applications_created', 0
    );
  END IF;

  -- Aplicar pago a facturas pendientes usando FIFO
  FOR invoice_record IN 
    SELECT 
      i.id,
      i.folio,
      i.total,
      COALESCE(i.paid_amount, 0) as paid_amount,
      (i.total - COALESCE(i.paid_amount, 0)) as remaining_amount
    FROM public.invoices i
    WHERE i.client_id = p_client_id
      AND i.status IN ('sent', 'overdue', 'partial')
      AND (i.total - COALESCE(i.paid_amount, 0)) > 0
    ORDER BY i.issue_date ASC, i.created_at ASC
  LOOP
    EXIT WHEN remaining_payment <= 0;
    
    -- Calcular monto a aplicar
    amount_to_apply := LEAST(remaining_payment, invoice_record.remaining_amount);
    
    -- Insertar aplicación de pago (el trigger actualizará payments automáticamente)
    INSERT INTO public.payment_applications (
      payment_id,
      invoice_id,
      applied_amount,
      application_method,
      created_by
    ) VALUES (
      p_payment_id,
      invoice_record.id,
      amount_to_apply,
      'fifo',
      auth.uid()
    );
    
    remaining_payment := remaining_payment - amount_to_apply;
    total_applied := total_applied + amount_to_apply;
    applications_count := applications_count + 1;
    
    RAISE NOTICE 'Aplicados $% a factura % (Folio: %)', 
      amount_to_apply, invoice_record.id, invoice_record.folio;
  END LOOP;

  -- NO actualizamos payments manualmente - el trigger lo hace automáticamente
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'total_applied', total_applied,
    'applications_created', applications_count,
    'message', format('Aplicados $%s en %s facturas usando FIFO', total_applied, applications_count)
  );
END;
$function$;

-- 3. Recrear apply_payment_manual sin actualizaciones manuales
CREATE OR REPLACE FUNCTION public.apply_payment_manual(
  p_payment_id uuid,
  p_applications jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payment_record RECORD;
  application JSONB;
  invoice_id_to_apply UUID;
  amount_to_apply DECIMAL;
  total_applied DECIMAL := 0;
  applications_count INTEGER := 0;
  available_amount DECIMAL;
BEGIN
  -- Verificar permisos
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'No tienes permisos para aplicar pagos manualmente';
  END IF;

  -- Obtener información del pago
  SELECT * INTO payment_record
  FROM public.payments 
  WHERE id = p_payment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pago no encontrado';
  END IF;

  available_amount := payment_record.amount - COALESCE(payment_record.applied_amount, 0);

  -- Procesar cada aplicación manual
  FOR application IN SELECT * FROM jsonb_array_elements(p_applications)
  LOOP
    invoice_id_to_apply := (application->>'invoice_id')::UUID;
    amount_to_apply := (application->>'amount')::DECIMAL;
    
    -- Validar que hay monto disponible
    IF total_applied + amount_to_apply > available_amount THEN
      RAISE EXCEPTION 'Monto total a aplicar ($%) excede el disponible ($%)', 
        total_applied + amount_to_apply, available_amount;
    END IF;
    
    -- Validar que la factura existe y pertenece al mismo cliente
    IF NOT EXISTS (
      SELECT 1 FROM public.invoices 
      WHERE id = invoice_id_to_apply 
        AND client_id = payment_record.client_id
    ) THEN
      RAISE EXCEPTION 'Factura no válida o no pertenece al mismo cliente';
    END IF;
    
    -- Insertar aplicación (el trigger actualizará automáticamente payments e invoices)
    INSERT INTO public.payment_applications (
      payment_id,
      invoice_id,
      applied_amount,
      application_method,
      created_by
    ) VALUES (
      p_payment_id,
      invoice_id_to_apply,
      amount_to_apply,
      'manual',
      auth.uid()
    );
    
    total_applied := total_applied + amount_to_apply;
    applications_count := applications_count + 1;
  END LOOP;

  -- NO actualizamos payments ni invoices manualmente - los triggers lo hacen automáticamente

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'total_applied', total_applied,
    'applications_created', applications_count,
    'message', format('Aplicación manual exitosa: $%s en %s facturas', total_applied, applications_count)
  );
END;
$function$;

-- 4. Ejecutar limpieza de datos existentes
SELECT fix_applied_amount_duplications();