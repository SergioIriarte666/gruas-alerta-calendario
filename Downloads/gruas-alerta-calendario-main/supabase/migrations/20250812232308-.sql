-- CORRECCIÓN DE ERRORES DE TIPOS EN SISTEMA DE PAGOS
-- Migración para resolver problemas de reconciliación entre pagos y facturas

-- 1. Corregir función apply_payment_manual con casting explícito de tipos enum
CREATE OR REPLACE FUNCTION public.apply_payment_manual(
    p_payment_id UUID,
    p_applications JSONB
) RETURNS VOID 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    app JSONB;
    total_applied DECIMAL := 0;
    payment_amount DECIMAL;
BEGIN
    -- Obtener el monto del pago
    SELECT amount INTO payment_amount FROM payments WHERE id = p_payment_id;
    
    IF payment_amount IS NULL THEN
        RAISE EXCEPTION 'Payment not found: %', p_payment_id;
    END IF;
    
    -- Procesar cada aplicación
    FOR app IN SELECT * FROM jsonb_array_elements(p_applications)
    LOOP
        -- Insertar en payment_applications con cast explícito
        INSERT INTO payment_applications (
            payment_id, 
            invoice_id, 
            applied_amount, 
            application_method, 
            notes
        ) VALUES (
            p_payment_id,
            (app->>'invoice_id')::UUID,
            (app->>'amount')::DECIMAL,
            'manual'::application_method,  -- CAST EXPLÍCITO
            app->>'notes'
        );
        
        -- Actualizar factura con cast explícito
        UPDATE invoices 
        SET 
            paid_amount = COALESCE(paid_amount, 0) + (app->>'amount')::DECIMAL,
            status = CASE 
                WHEN COALESCE(paid_amount, 0) + (app->>'amount')::DECIMAL >= total 
                THEN 'paid'::invoice_status  -- CAST EXPLÍCITO
                ELSE status 
            END,
            updated_at = NOW()
        WHERE id = (app->>'invoice_id')::UUID;
        
        total_applied := total_applied + (app->>'amount')::DECIMAL;
    END LOOP;
    
    -- Actualizar pago con cast explícito
    UPDATE payments 
    SET 
        applied_amount = COALESCE(applied_amount, 0) + total_applied,
        remaining_amount = amount - (COALESCE(applied_amount, 0) + total_applied),
        status = CASE 
            WHEN (COALESCE(applied_amount, 0) + total_applied) >= amount 
            THEN 'applied'::payment_status  -- CAST EXPLÍCITO
            ELSE 'partial'::payment_status  -- CAST EXPLÍCITO
        END,
        updated_at = NOW()
    WHERE id = p_payment_id;
END;
$$;

-- 2. Corregir función apply_payment_fifo
CREATE OR REPLACE FUNCTION public.apply_payment_fifo(
    p_payment_id UUID,
    p_client_id UUID
) RETURNS VOID 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    payment_remaining DECIMAL;
    invoice_record RECORD;
    amount_to_apply DECIMAL;
BEGIN
    -- Obtener monto restante del pago
    SELECT remaining_amount INTO payment_remaining 
    FROM payments 
    WHERE id = p_payment_id;
    
    IF payment_remaining IS NULL OR payment_remaining <= 0 THEN
        RETURN;
    END IF;
    
    -- Obtener facturas pendientes ordenadas por fecha (FIFO)
    FOR invoice_record IN 
        SELECT id, total - COALESCE(paid_amount, 0) as remaining_amount
        FROM invoices 
        WHERE client_id = p_client_id 
        AND status NOT IN ('paid'::invoice_status, 'cancelled'::invoice_status)
        AND total > COALESCE(paid_amount, 0)
        ORDER BY issue_date ASC
    LOOP
        -- Calcular monto a aplicar
        amount_to_apply := LEAST(payment_remaining, invoice_record.remaining_amount);
        
        IF amount_to_apply > 0 THEN
            -- Crear aplicación de pago
            INSERT INTO payment_applications (
                payment_id, 
                invoice_id, 
                applied_amount, 
                application_method
            ) VALUES (
                p_payment_id,
                invoice_record.id,
                amount_to_apply,
                'fifo'::application_method  -- CAST EXPLÍCITO
            );
            
            -- Actualizar factura
            UPDATE invoices 
            SET 
                paid_amount = COALESCE(paid_amount, 0) + amount_to_apply,
                status = CASE 
                    WHEN COALESCE(paid_amount, 0) + amount_to_apply >= total 
                    THEN 'paid'::invoice_status  -- CAST EXPLÍCITO
                    ELSE status 
                END,
                updated_at = NOW()
            WHERE id = invoice_record.id;
            
            -- Actualizar pago
            UPDATE payments 
            SET 
                applied_amount = COALESCE(applied_amount, 0) + amount_to_apply,
                remaining_amount = remaining_amount - amount_to_apply,
                updated_at = NOW()
            WHERE id = p_payment_id;
            
            payment_remaining := payment_remaining - amount_to_apply;
            
            EXIT WHEN payment_remaining <= 0;
        END IF;
    END LOOP;
    
    -- Actualizar estado final del pago
    UPDATE payments 
    SET status = CASE 
        WHEN remaining_amount <= 0 THEN 'applied'::payment_status
        WHEN applied_amount > 0 THEN 'partial'::payment_status
        ELSE 'pending'::payment_status
    END
    WHERE id = p_payment_id;
END;
$$;

-- 3. Corregir función create_automatic_payment_for_invoice
CREATE OR REPLACE FUNCTION public.create_automatic_payment_for_invoice(
    p_invoice_id UUID,
    p_client_id UUID,
    p_amount DECIMAL
) RETURNS UUID 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    new_payment_id UUID;
BEGIN
    -- Crear pago automático
    INSERT INTO payments (
        client_id,
        amount,
        payment_date,
        payment_method,
        status,  -- Ya es de tipo payment_status por defecto
        applied_amount,
        remaining_amount,
        notes
    ) VALUES (
        p_client_id,
        p_amount,
        CURRENT_DATE,
        'transferencia',
        'applied'::payment_status,  -- CAST EXPLÍCITO
        p_amount,
        0,
        'Pago automático generado para sincronización'
    )
    RETURNING id INTO new_payment_id;
    
    -- Crear aplicación de pago
    INSERT INTO payment_applications (
        payment_id,
        invoice_id,
        applied_amount,
        application_method,
        notes
    ) VALUES (
        new_payment_id,
        p_invoice_id,
        p_amount,
        'manual'::application_method,  -- CAST EXPLÍCITO
        'Aplicación automática para sincronización'
    );
    
    RETURN new_payment_id;
END;
$$;

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