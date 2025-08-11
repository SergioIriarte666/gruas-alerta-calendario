-- Corregir la función de sincronización sin tocar remaining_amount si hay restricciones
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