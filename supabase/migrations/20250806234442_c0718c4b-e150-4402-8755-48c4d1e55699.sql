-- Eliminar y recrear la función apply_payment_fifo con el tipo correcto
DROP FUNCTION IF EXISTS public.apply_payment_fifo(uuid, uuid);

-- Recrear la función con tipo de retorno correcto
CREATE OR REPLACE FUNCTION public.apply_payment_fifo(
    p_payment_id UUID,
    p_client_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
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
    WHERE id = p_payment_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pago no encontrado o ya aplicado';
    END IF;
    
    v_remaining_payment := v_payment.remaining_amount;
    
    -- Obtener facturas pendientes (FIFO por fecha de vencimiento)
    FOR v_invoice IN 
        SELECT id, total_amount, paid_amount, remaining_amount
        FROM invoices 
        WHERE (p_client_id IS NULL OR client_id = p_client_id)
          AND status IN ('sent', 'overdue', 'draft')
          AND remaining_amount > 0
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
            created_at
        ) VALUES (
            p_payment_id,
            v_invoice.id,
            v_application_amount,
            'fifo',
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
            updated_at = now()
        WHERE id = v_invoice.id;
        
        v_remaining_payment := v_remaining_payment - v_application_amount;
        v_applications_made := v_applications_made + 1;
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
        'applications_made', v_applications_made,
        'amount_applied', v_payment.amount - v_remaining_payment,
        'remaining_amount', v_remaining_payment
    );
    
    RETURN v_result;
END;
$$;