-- CORRECCIÓN DE ERRORES DE TIPOS EN SISTEMA DE PAGOS - PARTE 2
-- Funciones de limpieza y estadísticas

-- 4. Función para limpiar pagos duplicados
CREATE OR REPLACE FUNCTION public.cleanup_duplicate_payments()
RETURNS TABLE(deleted_count INTEGER) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    -- Eliminar duplicados manteniendo el más reciente
    WITH duplicates AS (
        SELECT id, 
               ROW_NUMBER() OVER (
                   PARTITION BY client_id, amount, payment_date, 
                   COALESCE(bank_reference, ''), payment_method 
                   ORDER BY created_at DESC
               ) as rn
        FROM payments
    )
    DELETE FROM payments 
    WHERE id IN (
        SELECT id FROM duplicates WHERE rn > 1
    );
    
    GET DIAGNOSTICS duplicate_count = ROW_COUNT;
    RETURN QUERY SELECT duplicate_count;
END;
$$;

-- 5. Función para sincronizar facturas pagadas con pagos
CREATE OR REPLACE FUNCTION public.sync_paid_invoices_with_payments()
RETURNS TABLE(synced_count INTEGER) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    sync_count INTEGER := 0;
    invoice_record RECORD;
BEGIN
    -- Buscar facturas pagadas sin pagos asociados
    FOR invoice_record IN 
        SELECT i.id, i.client_id, i.total, COALESCE(i.paid_amount, 0) as paid_amount
        FROM invoices i
        WHERE i.status = 'paid'::invoice_status
        AND COALESCE(i.paid_amount, 0) > 0
        AND NOT EXISTS (
            SELECT 1 FROM payment_applications pa 
            JOIN payments p ON pa.payment_id = p.id 
            WHERE pa.invoice_id = i.id
        )
    LOOP
        -- Crear pago automático usando la función corregida
        PERFORM create_automatic_payment_for_invoice(
            invoice_record.id, 
            invoice_record.client_id, 
            invoice_record.paid_amount
        );
        
        sync_count := sync_count + 1;
    END LOOP;
    
    RETURN QUERY SELECT sync_count;
END;
$$;

-- 6. Función para obtener estadísticas de reconciliación
CREATE OR REPLACE FUNCTION public.get_payment_reconciliation_stats()
RETURNS TABLE(
    total_payments INTEGER,
    pending_payments INTEGER,
    applied_payments INTEGER,
    partial_payments INTEGER,
    total_pending_amount DECIMAL,
    invoices_without_payments INTEGER,
    payments_without_applications INTEGER
) 
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM payments) as total_payments,
        (SELECT COUNT(*)::INTEGER FROM payments WHERE status = 'pending') as pending_payments,
        (SELECT COUNT(*)::INTEGER FROM payments WHERE status = 'applied') as applied_payments,
        (SELECT COUNT(*)::INTEGER FROM payments WHERE status = 'partial') as partial_payments,
        (SELECT COALESCE(SUM(remaining_amount), 0) FROM payments WHERE remaining_amount > 0) as total_pending_amount,
        (SELECT COUNT(*)::INTEGER FROM invoices i 
         WHERE i.status = 'paid' 
         AND NOT EXISTS (SELECT 1 FROM payment_applications pa WHERE pa.invoice_id = i.id)
        ) as invoices_without_payments,
        (SELECT COUNT(*)::INTEGER FROM payments p 
         WHERE NOT EXISTS (SELECT 1 FROM payment_applications pa WHERE pa.payment_id = p.id)
         AND p.status != 'pending'
        ) as payments_without_applications;
END;
$$;