-- CORRECCIÓN DE ERRORES DE TIPOS EN SISTEMA DE PAGOS - PARTE 1
-- Primero eliminar funciones existentes para recrearlas con tipos corregidos

DROP FUNCTION IF EXISTS public.apply_payment_manual(uuid, jsonb);
DROP FUNCTION IF EXISTS public.apply_payment_fifo(uuid, uuid);  
DROP FUNCTION IF EXISTS public.create_automatic_payment_for_invoice(uuid, uuid, decimal);

-- Recrear funciones con casting explícito de tipos enum

-- 1. Función apply_payment_manual corregida
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

-- 2. Función apply_payment_fifo corregida
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

-- 3. Función create_automatic_payment_for_invoice corregida
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
        status,
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