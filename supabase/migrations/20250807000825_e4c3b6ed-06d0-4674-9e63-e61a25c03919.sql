-- ============================================================================
-- CORRECCIÓN DE DUPLICADOS DE PAGOS Y MEJORA DE SINCRONIZACIÓN
-- ============================================================================

-- Primero eliminar la función existente para cambiar el tipo de retorno
DROP FUNCTION IF EXISTS public.sync_paid_invoices_with_payments();

-- 1. Función para identificar y eliminar pagos duplicados
CREATE OR REPLACE FUNCTION public.cleanup_duplicate_payments()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    duplicate_record RECORD;
    cleanup_count INTEGER := 0;
    kept_payments UUID[] := '{}';
    removed_payments UUID[] := '{}';
BEGIN
    -- Verificar permisos de administrador
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'Solo los administradores pueden limpiar duplicados';
    END IF;

    -- Encontrar y limpiar pagos duplicados (mismo cliente, mismo monto, misma fecha)
    FOR duplicate_record IN 
        WITH duplicates AS (
            SELECT 
                client_id,
                amount,
                payment_date,
                COUNT(*) as count_duplicates,
                ARRAY_AGG(id ORDER BY created_at) as payment_ids,
                ARRAY_AGG(status ORDER BY created_at) as statuses
            FROM payments
            WHERE bank_reference LIKE 'SYNC-%'
            GROUP BY client_id, amount, payment_date
            HAVING COUNT(*) > 1
        )
        SELECT * FROM duplicates
    LOOP
        DECLARE
            keep_payment_id UUID;
            pending_payment_id UUID;
            i INTEGER;
        BEGIN
            -- Buscar si hay un pago 'pending' en los duplicados
            FOR i IN 1..array_length(duplicate_record.payment_ids, 1) LOOP
                IF duplicate_record.statuses[i] = 'pending' THEN
                    pending_payment_id := duplicate_record.payment_ids[i];
                    EXIT;
                END IF;
            END LOOP;

            -- Si hay un pending, mantenerlo; si no, mantener el primero
            keep_payment_id := COALESCE(pending_payment_id, duplicate_record.payment_ids[1]);
            kept_payments := kept_payments || keep_payment_id;

            -- Eliminar los otros pagos duplicados
            FOR i IN 1..array_length(duplicate_record.payment_ids, 1) LOOP
                IF duplicate_record.payment_ids[i] != keep_payment_id THEN
                    -- Primero eliminar aplicaciones del pago duplicado
                    DELETE FROM payment_applications 
                    WHERE payment_id = duplicate_record.payment_ids[i];
                    
                    -- Luego eliminar el pago duplicado
                    DELETE FROM payments 
                    WHERE id = duplicate_record.payment_ids[i];
                    
                    removed_payments := removed_payments || duplicate_record.payment_ids[i];
                    cleanup_count := cleanup_count + 1;
                END IF;
            END LOOP;

            RAISE NOTICE 'Limpiados % duplicados para cliente, manteniendo %', 
                array_length(duplicate_record.payment_ids, 1) - 1, keep_payment_id;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'removed_count', cleanup_count,
        'kept_payments', kept_payments,
        'removed_payments', removed_payments,
        'message', format('Eliminados %s pagos duplicados', cleanup_count)
    );
END;
$$;

-- 2. Función para aplicar pagos pending existentes a facturas
CREATE OR REPLACE FUNCTION public.apply_pending_payments_to_invoices()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    pending_payment RECORD;
    unpaid_invoice RECORD;
    application_amount NUMERIC;
    applied_count INTEGER := 0;
    applications_made JSONB := '[]'::jsonb;
BEGIN
    -- Buscar pagos pending que puedan ser aplicados
    FOR pending_payment IN 
        SELECT p.*, c.name as client_name
        FROM payments p
        JOIN clients c ON p.client_id = c.id
        WHERE p.status = 'pending' 
        AND p.remaining_amount > 0
        ORDER BY p.payment_date ASC
    LOOP
        -- Buscar facturas no pagadas del mismo cliente
        FOR unpaid_invoice IN 
            SELECT i.*
            FROM invoices i
            WHERE i.client_id = pending_payment.client_id
            AND i.status IN ('sent', 'overdue')
            AND i.remaining_amount > 0
            ORDER BY i.due_date ASC
        LOOP
            -- Calcular cuánto aplicar
            application_amount := LEAST(pending_payment.remaining_amount, unpaid_invoice.remaining_amount);
            
            IF application_amount > 0 THEN
                -- Crear aplicación del pago
                INSERT INTO payment_applications (
                    payment_id,
                    invoice_id,
                    applied_amount,
                    application_method,
                    notes,
                    created_by
                ) VALUES (
                    pending_payment.id,
                    unpaid_invoice.id,
                    application_amount,
                    'fifo',
                    format('Aplicación automática de pago pending: %s a factura %s', 
                           pending_payment.bank_reference, unpaid_invoice.folio),
                    auth.uid()
                );

                -- Actualizar el pago
                UPDATE payments 
                SET 
                    applied_amount = applied_amount + application_amount,
                    remaining_amount = remaining_amount - application_amount,
                    status = CASE 
                        WHEN remaining_amount - application_amount <= 0 THEN 'applied'
                        ELSE 'partial'
                    END,
                    updated_at = now()
                WHERE id = pending_payment.id;

                -- Actualizar la factura
                UPDATE invoices 
                SET 
                    paid_amount = paid_amount + application_amount,
                    remaining_amount = remaining_amount - application_amount,
                    status = CASE 
                        WHEN remaining_amount - application_amount <= 0 THEN 'paid'
                        ELSE status
                    END,
                    payment_date = CASE 
                        WHEN remaining_amount - application_amount <= 0 THEN pending_payment.payment_date
                        ELSE payment_date
                    END,
                    updated_at = now()
                WHERE id = unpaid_invoice.id;

                -- Actualizar datos locales para siguiente iteración
                pending_payment.remaining_amount := pending_payment.remaining_amount - application_amount;
                
                applications_made := applications_made || jsonb_build_object(
                    'payment_id', pending_payment.id,
                    'invoice_id', unpaid_invoice.id,
                    'amount', application_amount,
                    'client_name', pending_payment.client_name,
                    'invoice_folio', unpaid_invoice.folio
                );
                
                applied_count := applied_count + 1;

                RAISE NOTICE 'Aplicados $% del pago % a factura %', 
                    application_amount, pending_payment.bank_reference, unpaid_invoice.folio;

                -- Si el pago se agotó, salir del loop de facturas
                EXIT WHEN pending_payment.remaining_amount <= 0;
            END IF;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'applied_count', applied_count,
        'applications', applications_made,
        'message', format('Aplicados %s pagos pending a facturas pendientes', applied_count)
    );
END;
$$;

-- 3. Función mejorada de sincronización que evita duplicados
CREATE OR REPLACE FUNCTION public.sync_paid_invoices_with_payments()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_invoice RECORD;
    v_payment_id UUID;
    v_synced_count INTEGER := 0;
    v_applied_count INTEGER := 0;
    v_errors JSONB := '[]'::jsonb;
    result JSONB;
    pending_result JSONB;
BEGIN
    RAISE NOTICE 'Iniciando sincronización mejorada de facturas pagadas...';
    
    -- PASO 1: Primero intentar aplicar pagos pending existentes
    SELECT public.apply_pending_payments_to_invoices() INTO pending_result;
    v_applied_count := (pending_result->>'applied_count')::INTEGER;
    
    RAISE NOTICE 'Aplicados % pagos pending existentes', v_applied_count;

    -- PASO 2: Crear pagos automáticos solo para facturas que NO tienen pagos
    FOR v_invoice IN 
        SELECT i.id, i.client_id, i.total, i.paid_amount, i.remaining_amount, i.folio, i.payment_date
        FROM invoices i
        WHERE i.status = 'paid'
        AND NOT EXISTS (
            SELECT 1 FROM payment_applications pa 
            WHERE pa.invoice_id = i.id
        )
        AND NOT EXISTS (
            -- Evitar crear si ya existe un pago automático para esta factura
            SELECT 1 FROM payments p
            WHERE p.client_id = i.client_id
            AND p.amount = i.total
            AND p.bank_reference = 'SYNC-' || i.folio
        )
    LOOP
        BEGIN
            -- Crear pago automático solo si no existe
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
                'Pago sincronizado automáticamente para factura: ' || v_invoice.folio,
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
                created_by
            ) VALUES (
                v_payment_id,
                v_invoice.id,
                v_invoice.total,
                'manual',
                'Sincronización automática para factura: ' || v_invoice.folio,
                auth.uid()
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
    
    result := jsonb_build_object(
        'success', true,
        'synced_count', v_synced_count,
        'applied_pending_count', v_applied_count,
        'errors', v_errors,
        'pending_applications', pending_result->'applications',
        'message', format('Sincronización completada: %s facturas nuevas, %s pagos pending aplicados', 
                         v_synced_count, v_applied_count)
    );
    
    RETURN result;
END;
$$;

-- 4. Función maestra para limpieza completa
CREATE OR REPLACE FUNCTION public.full_payment_cleanup_and_sync()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    cleanup_result JSONB;
    sync_result JSONB;
    final_result JSONB;
BEGIN
    -- Verificar permisos de administrador
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'Solo los administradores pueden ejecutar la limpieza completa';
    END IF;

    RAISE NOTICE 'Iniciando limpieza completa de pagos...';
    
    -- PASO 1: Limpiar duplicados
    SELECT public.cleanup_duplicate_payments() INTO cleanup_result;
    
    -- PASO 2: Sincronizar con lógica mejorada
    SELECT public.sync_paid_invoices_with_payments() INTO sync_result;
    
    final_result := jsonb_build_object(
        'success', true,
        'cleanup', cleanup_result,
        'sync', sync_result,
        'summary', jsonb_build_object(
            'duplicates_removed', cleanup_result->>'removed_count',
            'new_synced', sync_result->>'synced_count',
            'pending_applied', sync_result->>'applied_pending_count'
        ),
        'message', 'Limpieza y sincronización completada exitosamente'
    );
    
    RETURN final_result;
END;
$$;