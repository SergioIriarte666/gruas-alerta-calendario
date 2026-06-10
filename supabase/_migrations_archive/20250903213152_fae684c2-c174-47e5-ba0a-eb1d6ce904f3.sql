-- Mejorar diagnóstico para detectar pagos duplicados
CREATE OR REPLACE FUNCTION public.comprehensive_payment_diagnosis()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  diagnosis jsonb;
  inconsistent_payments INTEGER;
  inconsistent_invoices INTEGER;
  duplicate_applications INTEGER;
  orphaned_applications INTEGER;
  duplicate_payments INTEGER;
BEGIN
  -- Contar pagos inconsistentes
  SELECT COUNT(*) INTO inconsistent_payments
  FROM (
    SELECT 
      p.id,
      p.applied_amount,
      COALESCE(SUM(pa.applied_amount), 0) as calculated_applied
    FROM payments p
    LEFT JOIN payment_applications pa ON p.id = pa.payment_id
    GROUP BY p.id, p.applied_amount
    HAVING p.applied_amount != COALESCE(SUM(pa.applied_amount), 0)
       OR p.applied_amount > (SELECT amount FROM payments WHERE id = p.id)
  ) inconsistent;

  -- Contar facturas inconsistentes
  SELECT COUNT(*) INTO inconsistent_invoices
  FROM (
    SELECT 
      i.id,
      i.paid_amount,
      i.status,
      COALESCE(SUM(pa.applied_amount), 0) as calculated_paid
    FROM invoices i
    LEFT JOIN payment_applications pa ON i.id = pa.invoice_id
    GROUP BY i.id, i.paid_amount, i.status
    HAVING i.paid_amount != COALESCE(SUM(pa.applied_amount), 0)
       OR (i.status = 'paid' AND COALESCE(SUM(pa.applied_amount), 0) < i.total)
  ) inconsistent;

  -- Contar aplicaciones duplicadas
  SELECT COUNT(*) INTO duplicate_applications
  FROM (
    SELECT payment_id, invoice_id, COUNT(*) as duplicates
    FROM payment_applications
    GROUP BY payment_id, invoice_id
    HAVING COUNT(*) > 1
  ) duplicates;

  -- Contar aplicaciones huérfanas
  SELECT COUNT(*) INTO orphaned_applications
  FROM payment_applications pa
  WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.id = pa.payment_id)
     OR NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = pa.invoice_id);

  -- Contar pagos duplicados (NUEVA FUNCIONALIDAD)
  SELECT COUNT(*) INTO duplicate_payments
  FROM (
    SELECT 
      client_id, 
      amount, 
      payment_date::date,
      COUNT(*) as duplicates
    FROM payments 
    WHERE status IN ('pending', 'partial')  -- Solo pagos no completamente procesados
    GROUP BY client_id, amount, payment_date::date
    HAVING COUNT(*) > 1
  ) potential_duplicates;

  diagnosis := jsonb_build_object(
    'timestamp', NOW(),
    'system_health', CASE 
      WHEN inconsistent_payments = 0 AND inconsistent_invoices = 0 
           AND duplicate_applications = 0 AND orphaned_applications = 0 
           AND duplicate_payments = 0
      THEN 'HEALTHY' 
      ELSE 'NEEDS_REPAIR' 
    END,
    'issues', jsonb_build_object(
      'inconsistent_payments', inconsistent_payments,
      'inconsistent_invoices', inconsistent_invoices,
      'duplicate_applications', duplicate_applications,
      'orphaned_applications', orphaned_applications,
      'duplicate_payments', duplicate_payments
    ),
    'total_issues', inconsistent_payments + inconsistent_invoices + duplicate_applications + orphaned_applications + duplicate_payments
  );

  RETURN diagnosis;
END;
$function$;

-- Función para limpiar pagos duplicados
CREATE OR REPLACE FUNCTION public.cleanup_payment_duplicates()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  removed_count INTEGER := 0;
  duplicate_group RECORD;
  payment_to_keep UUID;
  payment_to_remove UUID;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden eliminar pagos duplicados';
  END IF;

  -- Buscar grupos de pagos duplicados
  FOR duplicate_group IN 
    SELECT 
      client_id, 
      amount, 
      payment_date::date as pay_date,
      array_agg(id ORDER BY 
        CASE status 
          WHEN 'applied' THEN 1
          WHEN 'partial' THEN 2  
          WHEN 'pending' THEN 3
          ELSE 4
        END, 
        created_at ASC
      ) as payment_ids
    FROM payments 
    GROUP BY client_id, amount, payment_date::date
    HAVING COUNT(*) > 1
  LOOP
    -- Mantener el primer pago (el más aplicado o el más antiguo)
    payment_to_keep := duplicate_group.payment_ids[1];
    
    -- Eliminar los pagos duplicados (del 2 en adelante)
    FOR i IN 2..array_length(duplicate_group.payment_ids, 1) LOOP
      payment_to_remove := duplicate_group.payment_ids[i];
      
      -- Solo eliminar si no tiene aplicaciones de pago
      IF NOT EXISTS (
        SELECT 1 FROM payment_applications 
        WHERE payment_id = payment_to_remove
      ) THEN
        DELETE FROM payments WHERE id = payment_to_remove;
        removed_count := removed_count + 1;
        
        RAISE NOTICE 'Eliminado pago duplicado: % (Cliente: %, Monto: %, Fecha: %)', 
          payment_to_remove, duplicate_group.client_id, duplicate_group.amount, duplicate_group.pay_date;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'removed_duplicates', removed_count,
    'message', format('Eliminados %s pagos duplicados', removed_count)
  );
END;
$function$;

-- Función para validar pagos antes de crearlos
CREATE OR REPLACE FUNCTION public.check_for_duplicate_payment(
  p_client_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_tolerance_days integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  similar_payments_count INTEGER;
  similar_payments jsonb;
BEGIN
  -- Buscar pagos similares en un rango de días
  SELECT 
    COUNT(*),
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'amount', amount,
        'payment_date', payment_date,
        'status', status,
        'bank_reference', bank_reference
      )
    )
  INTO similar_payments_count, similar_payments
  FROM payments 
  WHERE client_id = p_client_id
    AND amount = p_amount
    AND payment_date BETWEEN (p_payment_date - p_tolerance_days) AND (p_payment_date + p_tolerance_days)
    AND status IN ('pending', 'partial', 'applied');

  RETURN jsonb_build_object(
    'has_duplicates', similar_payments_count > 0,
    'duplicate_count', similar_payments_count,
    'similar_payments', COALESCE(similar_payments, '[]'::jsonb)
  );
END;
$function$;

-- Eliminar inmediatamente el pago duplicado específico de Geodatos
DELETE FROM payments 
WHERE id = '4104000a-c85d-4a03-947e-e809b3a8da45'
  AND status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM payment_applications WHERE payment_id = '4104000a-c85d-4a03-947e-e809b3a8da45'
  );