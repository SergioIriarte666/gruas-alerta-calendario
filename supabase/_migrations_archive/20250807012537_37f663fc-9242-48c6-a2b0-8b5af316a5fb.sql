-- Eliminar funciones duplicadas que causan conflictos
DROP FUNCTION IF EXISTS public.create_automatic_payment_for_invoice(uuid, date);
DROP FUNCTION IF EXISTS public.create_automatic_payment_for_invoice(uuid);
DROP FUNCTION IF EXISTS public.apply_payment_manual(uuid, jsonb);
DROP FUNCTION IF EXISTS public.apply_payment_fifo(uuid, uuid);

-- Recrear función de pago automático (sin tocar remaining_amount generado)
CREATE OR REPLACE FUNCTION public.create_automatic_payment_for_invoice(
    p_invoice_id UUID
) 
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_invoice RECORD;
    v_payment_id UUID;
    v_application_amount DECIMAL;
    result JSON;
BEGIN
    SELECT id, client_id, total, paid_amount, folio, status
    INTO v_invoice
    FROM invoices 
    WHERE id = p_invoice_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Factura no encontrada: %', p_invoice_id;
    END IF;
    
    v_application_amount := v_invoice.total - COALESCE(v_invoice.paid_amount, 0);
    
    IF v_application_amount <= 0 THEN
        RAISE EXCEPTION 'La factura ya está completamente pagada';
    END IF;
    
    INSERT INTO payments (
        client_id, amount, payment_date, payment_method, bank_reference,
        notes, status, applied_amount, created_by
    ) VALUES (
        v_invoice.client_id, v_application_amount, CURRENT_DATE, 'automatico',
        'PAGO-AUTO-' || v_invoice.folio,
        'Pago automático generado al marcar factura como pagada: ' || v_invoice.folio,
        'applied', v_application_amount, auth.uid()
    ) RETURNING id INTO v_payment_id;
    
    INSERT INTO payment_applications (
        payment_id, invoice_id, applied_amount, application_method,
        notes, created_at
    ) VALUES (
        v_payment_id, p_invoice_id, v_application_amount, 'manual',
        'Aplicación automática para factura: ' || v_invoice.folio, now()
    );
    
    UPDATE invoices 
    SET paid_amount = COALESCE(paid_amount, 0) + v_application_amount,
        status = 'paid', payment_date = CURRENT_DATE, updated_at = now()
    WHERE id = p_invoice_id;
    
    RETURN json_build_object(
        'success', true, 'payment_id', v_payment_id,
        'invoice_id', p_invoice_id, 'amount_paid', v_application_amount
    );
END;
$$;

-- Recrear función de aplicación manual (sin tocar remaining_amount generado)
CREATE OR REPLACE FUNCTION public.apply_payment_manual(
    p_payment_id UUID,
    p_applications JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_payment RECORD;
    v_application JSONB;
    v_total_applied DECIMAL := 0;
    v_invoice_id UUID;
    v_amount DECIMAL;
BEGIN
    SELECT id, amount, applied_amount FROM payments 
    WHERE id = p_payment_id INTO v_payment;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pago no encontrado';
    END IF;
    
    FOR v_application IN SELECT * FROM jsonb_array_elements(p_applications)
    LOOP
        v_invoice_id := (v_application->>'invoice_id')::UUID;
        v_amount := (v_application->>'amount')::DECIMAL;
        v_total_applied := v_total_applied + v_amount;
        
        INSERT INTO payment_applications (
            payment_id, invoice_id, applied_amount, application_method, created_at
        ) VALUES (
            p_payment_id, v_invoice_id, v_amount, 'manual', now()
        );
        
        UPDATE invoices 
        SET paid_amount = COALESCE(paid_amount, 0) + v_amount,
            status = CASE 
                WHEN (COALESCE(paid_amount, 0) + v_amount) >= total THEN 'paid'
                ELSE status 
            END,
            updated_at = now()
        WHERE id = v_invoice_id;
    END LOOP;
    
    UPDATE payments 
    SET applied_amount = COALESCE(applied_amount, 0) + v_total_applied,
        status = CASE 
            WHEN (COALESCE(applied_amount, 0) + v_total_applied) >= amount THEN 'applied'
            ELSE 'partial'
        END,
        updated_at = now()
    WHERE id = p_payment_id;
    
    RETURN json_build_object('success', true, 'total_applied', v_total_applied);
END;
$$;

-- Recrear función FIFO (sin tocar remaining_amount generado)
CREATE OR REPLACE FUNCTION public.apply_payment_fifo(
    p_payment_id UUID,
    p_client_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_payment RECORD;
    v_invoice RECORD;
    v_available_amount DECIMAL;
    v_application_amount DECIMAL;
    v_total_applied DECIMAL := 0;
BEGIN
    SELECT id, client_id, amount, applied_amount FROM payments 
    WHERE id = p_payment_id INTO v_payment;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pago no encontrado';
    END IF;
    
    v_available_amount := v_payment.amount - COALESCE(v_payment.applied_amount, 0);
    
    FOR v_invoice IN 
        SELECT id, total, paid_amount
        FROM invoices 
        WHERE client_id = COALESCE(p_client_id, v_payment.client_id)
        AND status IN ('sent', 'overdue')
        AND (total - COALESCE(paid_amount, 0)) > 0
        ORDER BY due_date ASC
    LOOP
        EXIT WHEN v_available_amount <= 0;
        
        v_application_amount := LEAST(
            v_available_amount,
            v_invoice.total - COALESCE(v_invoice.paid_amount, 0)
        );
        
        INSERT INTO payment_applications (
            payment_id, invoice_id, applied_amount, application_method, created_at
        ) VALUES (
            p_payment_id, v_invoice.id, v_application_amount, 'fifo', now()
        );
        
        UPDATE invoices 
        SET paid_amount = COALESCE(paid_amount, 0) + v_application_amount,
            status = CASE 
                WHEN (COALESCE(paid_amount, 0) + v_application_amount) >= total THEN 'paid'
                ELSE status 
            END,
            updated_at = now()
        WHERE id = v_invoice.id;
        
        v_available_amount := v_available_amount - v_application_amount;
        v_total_applied := v_total_applied + v_application_amount;
    END LOOP;
    
    UPDATE payments 
    SET applied_amount = COALESCE(applied_amount, 0) + v_total_applied,
        status = CASE 
            WHEN (COALESCE(applied_amount, 0) + v_total_applied) >= amount THEN 'applied'
            ELSE 'partial'
        END,
        updated_at = now()
    WHERE id = p_payment_id;
    
    RETURN json_build_object('success', true, 'total_applied', v_total_applied);
END;
$$;