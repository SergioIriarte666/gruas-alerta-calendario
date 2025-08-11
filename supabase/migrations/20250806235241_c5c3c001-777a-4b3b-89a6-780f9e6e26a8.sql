-- 1. Corregir create_automatic_payment_for_invoice para crear y aplicar pagos directamente
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
    -- Obtener datos de la factura
    SELECT id, client_id, total, paid_amount, remaining_amount, folio, status
    INTO v_invoice
    FROM invoices 
    WHERE id = p_invoice_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Factura no encontrada: %', p_invoice_id;
    END IF;
    
    -- Calcular cuánto falta por pagar
    v_application_amount := COALESCE(v_invoice.remaining_amount, v_invoice.total);
    
    IF v_application_amount <= 0 THEN
        RAISE EXCEPTION 'La factura ya está completamente pagada';
    END IF;
    
    -- Crear el pago automático
    INSERT INTO payments (
        client_id,
        amount,
        payment_date,
        payment_method,
        bank_reference,
        notes,
        status,
        applied_amount,
        remaining_amount,
        created_by
    ) VALUES (
        v_invoice.client_id,
        v_application_amount,
        CURRENT_DATE,
        'automatico',
        'PAGO-AUTO-' || v_invoice.folio,
        'Pago automático generado al marcar factura como pagada: ' || v_invoice.folio,
        'applied',
        v_application_amount,
        0,
        auth.uid()
    )
    RETURNING id INTO v_payment_id;
    
    -- Crear la aplicación del pago directamente a esta factura
    INSERT INTO payment_applications (
        payment_id,
        invoice_id,
        applied_amount,
        application_method,
        notes,
        created_at
    ) VALUES (
        v_payment_id,
        p_invoice_id,
        v_application_amount,
        'manual',
        'Aplicación automática para factura: ' || v_invoice.folio,
        now()
    );
    
    -- Actualizar la factura con los campos calculados correctos
    UPDATE invoices 
    SET 
        paid_amount = COALESCE(paid_amount, 0) + v_application_amount,
        remaining_amount = total - (COALESCE(paid_amount, 0) + v_application_amount),
        status = 'paid',
        payment_date = CURRENT_DATE,
        updated_at = now()
    WHERE id = p_invoice_id;
    
    result := json_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'invoice_id', p_invoice_id,
        'amount_paid', v_application_amount,
        'message', 'Pago automático creado y aplicado exitosamente'
    );
    
    RETURN result;
END;
$$;

-- 2. Crear función de sincronización para facturas pagadas inconsistentes
CREATE OR REPLACE FUNCTION public.sync_paid_invoices_with_payments()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_invoice RECORD;
    v_payment_id UUID;
    v_synced_count INTEGER := 0;
    v_errors JSONB := '[]'::jsonb;
    result JSON;
BEGIN
    -- Buscar facturas marcadas como "paid" que no tienen pagos correspondientes
    FOR v_invoice IN 
        SELECT i.id, i.client_id, i.total, i.paid_amount, i.remaining_amount, i.folio, i.payment_date
        FROM invoices i
        WHERE i.status = 'paid'
        AND NOT EXISTS (
            SELECT 1 FROM payment_applications pa 
            WHERE pa.invoice_id = i.id
        )
    LOOP
        BEGIN
            -- Crear pago automático para esta factura
            INSERT INTO payments (
                client_id,
                amount,
                payment_date,
                payment_method,
                bank_reference,
                notes,
                status,
                applied_amount,
                remaining_amount,
                created_by
            ) VALUES (
                v_invoice.client_id,
                v_invoice.total,
                COALESCE(v_invoice.payment_date, CURRENT_DATE),
                'automatico',
                'SYNC-' || v_invoice.folio,
                'Pago sincronizado automáticamente para factura existente: ' || v_invoice.folio,
                'applied',
                v_invoice.total,
                0,
                auth.uid()
            )
            RETURNING id INTO v_payment_id;
            
            -- Crear la aplicación del pago
            INSERT INTO payment_applications (
                payment_id,
                invoice_id,
                applied_amount,
                application_method,
                notes,
                created_at
            ) VALUES (
                v_payment_id,
                v_invoice.id,
                v_invoice.total,
                'manual',
                'Sincronización automática para factura: ' || v_invoice.folio,
                now()
            );
            
            -- Corregir los campos calculados de la factura
            UPDATE invoices 
            SET 
                paid_amount = total,
                remaining_amount = 0,
                payment_date = COALESCE(payment_date, CURRENT_DATE),
                updated_at = now()
            WHERE id = v_invoice.id;
            
            v_synced_count := v_synced_count + 1;
            
            RAISE NOTICE 'Sincronizada factura %: pago_id=%', v_invoice.folio, v_payment_id;
            
        EXCEPTION
            WHEN OTHERS THEN
                v_errors := v_errors || jsonb_build_object(
                    'invoice_id', v_invoice.id,
                    'invoice_folio', v_invoice.folio,
                    'error', SQLERRM
                );
                RAISE WARNING 'Error sincronizando factura %: %', v_invoice.folio, SQLERRM;
        END;
    END LOOP;
    
    result := json_build_object(
        'success', true,
        'synced_count', v_synced_count,
        'errors', v_errors,
        'message', format('Sincronizadas %s facturas pagadas', v_synced_count)
    );
    
    RETURN result;
END;
$$;

-- 3. Actualizar apply_payment_fifo para considerar facturas "paid" con remaining_amount > 0
DROP FUNCTION IF EXISTS public.apply_payment_fifo(uuid, uuid);

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
    v_remaining_payment DECIMAL;
    v_application_amount DECIMAL;
    v_applications_made INTEGER := 0;
    v_result JSON;
BEGIN
    -- Obtener el pago
    SELECT * INTO v_payment 
    FROM payments 
    WHERE id = p_payment_id AND status IN ('pending', 'partial');
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pago no encontrado o ya completamente aplicado';
    END IF;
    
    v_remaining_payment := v_payment.remaining_amount;
    
    -- Obtener facturas pendientes O facturas "paid" con remaining_amount > 0 (inconsistentes)
    FOR v_invoice IN 
        SELECT id, total, paid_amount, remaining_amount, folio
        FROM invoices 
        WHERE (p_client_id IS NULL OR client_id = p_client_id OR client_id = v_payment.client_id)
          AND (
            (status IN ('sent', 'overdue', 'draft') AND remaining_amount > 0)
            OR 
            (status = 'paid' AND remaining_amount > 0)
          )
        ORDER BY due_date ASC, created_at ASC
    LOOP
        EXIT WHEN v_remaining_payment <= 0;
        
        -- Calcular cuánto aplicar a esta factura
        v_application_amount := LEAST(v_remaining_payment, v_invoice.remaining_amount);
        
        -- Crear la aplicación del pago
        INSERT INTO payment_applications (
            payment_id,
            invoice_id,
            applied_amount,
            application_method,
            notes,
            created_at
        ) VALUES (
            p_payment_id,
            v_invoice.id,
            v_application_amount,
            'fifo',
            'Aplicación FIFO a factura: ' || v_invoice.folio,
            now()
        );
        
        -- Actualizar la factura
        UPDATE invoices 
        SET 
            paid_amount = paid_amount + v_application_amount,
            remaining_amount = remaining_amount - v_application_amount,
            status = CASE 
                WHEN remaining_amount - v_application_amount <= 0 THEN 'paid'
                ELSE status 
            END,
            payment_date = CASE 
                WHEN remaining_amount - v_application_amount <= 0 THEN CURRENT_DATE
                ELSE payment_date
            END,
            updated_at = now()
        WHERE id = v_invoice.id;
        
        v_remaining_payment := v_remaining_payment - v_application_amount;
        v_applications_made := v_applications_made + 1;
        
        RAISE NOTICE 'Aplicado % a factura %', v_application_amount, v_invoice.folio;
    END LOOP;
    
    -- Actualizar el pago
    UPDATE payments 
    SET 
        applied_amount = amount - v_remaining_payment,
        remaining_amount = v_remaining_payment,
        status = CASE 
            WHEN v_remaining_payment <= 0 THEN 'applied'
            ELSE 'partial'
        END,
        updated_at = now()
    WHERE id = p_payment_id;
    
    v_result := json_build_object(
        'success', true,
        'applications_made', v_applications_made,
        'amount_applied', v_payment.amount - v_remaining_payment,
        'remaining_amount', v_remaining_payment,
        'message', format('Aplicadas %s facturas por un total de %s', v_applications_made, v_payment.amount - v_remaining_payment)
    );
    
    RETURN v_result;
END;
$$;