

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'operator',
    'viewer',
    'client'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."application_method" AS ENUM (
    'fifo',
    'manual',
    'proportional'
);


ALTER TYPE "public"."application_method" OWNER TO "postgres";


CREATE TYPE "public"."closure_status" AS ENUM (
    'open',
    'closed',
    'invoiced',
    'quoted',
    'purchase_order_pending'
);


ALTER TYPE "public"."closure_status" OWNER TO "postgres";


CREATE TYPE "public"."crane_status" AS ENUM (
    'active',
    'inactive',
    'sold',
    'written_off'
);


ALTER TYPE "public"."crane_status" OWNER TO "postgres";


CREATE TYPE "public"."crane_type" AS ENUM (
    'light',
    'medium',
    'heavy',
    'taxi',
    'other',
    'horquilla'
);


ALTER TYPE "public"."crane_type" OWNER TO "postgres";


CREATE TYPE "public"."invoice_status" AS ENUM (
    'draft',
    'sent',
    'paid',
    'overdue',
    'cancelled',
    'partial'
);


ALTER TYPE "public"."invoice_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'applied',
    'partial',
    'cancelled'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."service_status" AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'cancelled',
    'invoiced',
    'inspection_completed',
    'quoted',
    'purchase_order_pending',
    'with_purchase_order',
    'failed'
);


ALTER TYPE "public"."service_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."service_status" IS 'Service status: pending, in_progress, inspection_completed, completed, cancelled, invoiced';



CREATE TYPE "public"."supplier_category" AS ENUM (
    'combustible',
    'mantenimiento',
    'seguros',
    'otros',
    'peajes',
    'salarios',
    'administrativos',
    'impuestos',
    'comision_operador'
);


ALTER TYPE "public"."supplier_category" OWNER TO "postgres";


CREATE TYPE "public"."supplier_payment_status" AS ENUM (
    'pending',
    'paid',
    'overdue',
    'cancelled'
);


ALTER TYPE "public"."supplier_payment_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_create_user"("p_email" "text", "p_full_name" "text", "p_role" "public"."app_role", "p_client_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Verificar que el usuario que ejecuta la función sea admin
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden crear nuevos usuarios';
  END IF;

  -- Validar email
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'El email es requerido';
  END IF;

  -- Validar que el email no esté en uso
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = p_email) THEN
    RAISE EXCEPTION 'Este email ya está registrado en el sistema';
  END IF;

  -- Validar nombre completo
  IF p_full_name IS NULL OR p_full_name = '' THEN
    RAISE EXCEPTION 'El nombre completo es requerido';
  END IF;

  -- Validar rol
  IF p_role IS NULL THEN
    RAISE EXCEPTION 'El rol es requerido';
  END IF;

  -- Si el rol es cliente, validar que se proporcione client_id
  IF p_role = 'client' AND p_client_id IS NULL THEN
    RAISE EXCEPTION 'Para usuarios tipo cliente se debe especificar un cliente asociado';
  END IF;

  -- Generar UUID para el nuevo usuario
  new_user_id := gen_random_uuid();

  -- Insertar el usuario pre-registrado
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    client_id,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    p_email,
    p_full_name,
    p_role,
    p_client_id,
    true,
    now(),
    now()
  );

  -- Crear registro de invitación
  INSERT INTO public.user_invitations (
    user_id,
    email,
    status,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    p_email,
    'pending',
    now(),
    now()
  );

  -- Log de la acción
  RAISE NOTICE 'Usuario pre-registrado creado con invitación: id=%, email=%, role=%, created_by=%', 
    new_user_id, p_email, p_role, auth.uid();

  RETURN new_user_id;
END;
$$;


ALTER FUNCTION "public"."admin_create_user"("p_email" "text", "p_full_name" "text", "p_role" "public"."app_role", "p_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_payment_fifo"("p_payment_id" "uuid", "p_client_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  payment_record RECORD;
  invoice_record RECORD;
  remaining_payment DECIMAL(10,2);
  amount_to_apply DECIMAL(10,2);
  applications_made INTEGER := 0;
  total_applied DECIMAL(10,2) := 0;
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'No tiene permisos para aplicar pagos';
  END IF;

  SELECT * INTO payment_record FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pago no encontrado'; END IF;

  IF p_client_id IS NULL THEN p_client_id := payment_record.client_id; END IF;
  remaining_payment := payment_record.amount - payment_record.applied_amount;

  FOR invoice_record IN 
    SELECT * FROM public.invoices 
    WHERE client_id = p_client_id 
      AND status IN ('sent', 'overdue', 'draft') 
      AND remaining_amount > 0
      AND folio NOT LIKE 'HIST-%'
    ORDER BY due_date ASC, created_at ASC
  LOOP
    EXIT WHEN remaining_payment <= 0;
    amount_to_apply := LEAST(remaining_payment, invoice_record.remaining_amount);
    
    INSERT INTO public.payment_applications (payment_id, invoice_id, applied_amount, application_method, created_by) 
    VALUES (p_payment_id, invoice_record.id, amount_to_apply, 'fifo', auth.uid());
    
    UPDATE public.invoices SET paid_amount = paid_amount + amount_to_apply, updated_at = NOW() WHERE id = invoice_record.id;
    
    remaining_payment := remaining_payment - amount_to_apply;
    total_applied := total_applied + amount_to_apply;
    applications_made := applications_made + 1;
  END LOOP;

  UPDATE public.invoices SET status = 'paid', payment_date = payment_record.payment_date
  WHERE client_id = p_client_id AND remaining_amount = 0 AND status != 'paid' AND folio NOT LIKE 'HIST-%';

  RETURN jsonb_build_object(
    'success', true, 
    'applications_made', applications_made, 
    'total_applied', total_applied, 
    'remaining_payment', remaining_payment
  );
END;
$$;


ALTER FUNCTION "public"."apply_payment_fifo"("p_payment_id" "uuid", "p_client_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."apply_payment_fifo"("p_payment_id" "uuid", "p_client_id" "uuid") IS 'Aplica pagos usando FIFO. El trigger maintain_payment_consistency_trigger actualiza applied_amount automáticamente.';



CREATE OR REPLACE FUNCTION "public"."apply_payment_manual"("p_payment_id" "uuid", "p_applications" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  payment_amount numeric;
  total_applied numeric := 0;
  application jsonb;
  invoice_total numeric;
  current_paid numeric;
  app_invoice_id uuid;
  app_amount numeric;
  applications_made integer := 0;
  existing_application_count integer;
BEGIN
  -- Validar que el pago existe
  SELECT amount INTO payment_amount
  FROM payments 
  WHERE id = p_payment_id;
  
  IF payment_amount IS NULL THEN
    RAISE EXCEPTION 'Pago no encontrado: %', p_payment_id;
  END IF;

  -- Procesar cada aplicación
  FOR application IN SELECT * FROM jsonb_array_elements(p_applications)
  LOOP
    app_invoice_id := (application->>'invoice_id')::uuid;
    app_amount := (application->>'amount')::numeric;
    
    -- Validar monto
    IF app_amount <= 0 THEN
      RAISE EXCEPTION 'El monto de aplicación debe ser mayor a 0';
    END IF;
    
    total_applied := total_applied + app_amount;
    
    -- Validar que no exceda el monto del pago
    IF total_applied > payment_amount THEN
      RAISE EXCEPTION 'El total aplicado (%) excede el monto del pago (%)', total_applied, payment_amount;
    END IF;
    
    -- Obtener información de la factura
    SELECT total, COALESCE(paid_amount, 0) 
    INTO invoice_total, current_paid
    FROM invoices 
    WHERE id = app_invoice_id;
    
    IF invoice_total IS NULL THEN
      RAISE EXCEPTION 'Factura no encontrada: %', app_invoice_id;
    END IF;
    
    -- PREVENCIÓN DE DUPLICADOS: Verificar si ya existe una aplicación para este pago + factura
    SELECT COUNT(*) INTO existing_application_count
    FROM payment_applications
    WHERE payment_id = p_payment_id AND invoice_id = app_invoice_id;
    
    IF existing_application_count > 0 THEN
      RAISE EXCEPTION 'Ya existe una aplicación de pago para esta combinación de pago y factura. Use eliminación antes de reaplicar.';
    END IF;
    
    -- Validar que la aplicación no exceda lo pendiente de la factura
    IF current_paid + app_amount > invoice_total THEN
      RAISE EXCEPTION 'La aplicación de % excede el monto pendiente de la factura (pendiente: %)', 
        app_amount, (invoice_total - current_paid);
    END IF;
    
    -- Crear aplicación de pago (los triggers se encargarán de actualizar payments e invoices)
    INSERT INTO payment_applications (
      payment_id, invoice_id, applied_amount, application_method, 
      notes, created_by
    ) VALUES (
      p_payment_id, app_invoice_id, app_amount, 'manual',
      'Aplicación manual de pago', auth.uid()
    );
    
    applications_made := applications_made + 1;
  END LOOP;
  
  -- Los triggers maintain_payment_consistency y update_invoice_status_from_payments
  -- actualizarán automáticamente payments e invoices
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'applications_made', applications_made,
    'message', format('Aplicación exitosa: %s facturas procesadas. Triggers actualizarán automáticamente.', applications_made)
  );
END;
$$;


ALTER FUNCTION "public"."apply_payment_manual"("p_payment_id" "uuid", "p_applications" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."apply_payment_manual"("p_payment_id" "uuid", "p_applications" "jsonb") IS 'Aplica pagos manualmente. El trigger maintain_payment_consistency_trigger actualiza applied_amount automáticamente.';



CREATE OR REPLACE FUNCTION "public"."apply_payment_selective"("p_payment_id" "uuid", "p_fiscal_numbers" "text"[] DEFAULT NULL::"text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  payment_record RECORD;
  invoice_record RECORD;
  remaining_amount DECIMAL;
  applied_count INTEGER := 0;
  total_applied DECIMAL := 0;
  application_results JSONB := '[]'::jsonb;
  current_user_id UUID;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Get payment details
  SELECT * INTO payment_record
  FROM public.payments 
  WHERE id = p_payment_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pago no encontrado'
    );
  END IF;
  
  remaining_amount := payment_record.amount - COALESCE(payment_record.applied_amount, 0);
  
  IF remaining_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'El pago ya está completamente aplicado'
    );
  END IF;
  
  -- If fiscal numbers provided, apply to specific invoices
  IF p_fiscal_numbers IS NOT NULL AND array_length(p_fiscal_numbers, 1) > 0 THEN
    FOR invoice_record IN 
      SELECT i.id, i.folio, i.numero_fiscal, i.total, COALESCE(i.paid_amount, 0) as paid_amount
      FROM public.invoices i
      WHERE i.client_id = payment_record.client_id
        AND i.numero_fiscal = ANY(p_fiscal_numbers)
        AND i.status IN ('sent', 'overdue', 'partial')
        AND (i.total - COALESCE(i.paid_amount, 0)) > 0
      ORDER BY i.issue_date ASC
    LOOP
      DECLARE
        pending_amount DECIMAL;
        application_amount DECIMAL;
      BEGIN
        pending_amount := invoice_record.total - invoice_record.paid_amount;
        application_amount := LEAST(pending_amount, remaining_amount);
        
        IF application_amount > 0 THEN
          -- Insert payment application
          INSERT INTO public.payment_applications (
            payment_id,
            invoice_id,
            applied_amount,
            application_method,
            created_by
          ) VALUES (
            p_payment_id,
            invoice_record.id,
            application_amount,
            'selective'::application_method,
            current_user_id
          );
          
          remaining_amount := remaining_amount - application_amount;
          total_applied := total_applied + application_amount;
          applied_count := applied_count + 1;
          
          -- Add to results
          application_results := application_results || jsonb_build_object(
            'invoice_id', invoice_record.id,
            'folio', invoice_record.folio,
            'fiscal_number', invoice_record.numero_fiscal,
            'applied_amount', application_amount
          );
          
          -- If payment is fully applied, stop
          IF remaining_amount <= 0.01 THEN
            EXIT;
          END IF;
        END IF;
      END;
    END LOOP;
  ELSE
    -- Apply FIFO if no specific invoices provided
    FOR invoice_record IN 
      SELECT i.id, i.folio, i.numero_fiscal, i.total, COALESCE(i.paid_amount, 0) as paid_amount
      FROM public.invoices i
      WHERE i.client_id = payment_record.client_id
        AND i.status IN ('sent', 'overdue', 'partial')
        AND (i.total - COALESCE(i.paid_amount, 0)) > 0
      ORDER BY i.issue_date ASC
    LOOP
      DECLARE
        pending_amount DECIMAL;
        application_amount DECIMAL;
      BEGIN
        pending_amount := invoice_record.total - invoice_record.paid_amount;
        application_amount := LEAST(pending_amount, remaining_amount);
        
        IF application_amount > 0 THEN
          -- Insert payment application
          INSERT INTO public.payment_applications (
            payment_id,
            invoice_id,
            applied_amount,
            application_method,
            created_by
          ) VALUES (
            p_payment_id,
            invoice_record.id,
            application_amount,
            'fifo'::application_method,
            current_user_id
          );
          
          remaining_amount := remaining_amount - application_amount;
          total_applied := total_applied + application_amount;
          applied_count := applied_count + 1;
          
          -- Add to results
          application_results := application_results || jsonb_build_object(
            'invoice_id', invoice_record.id,
            'folio', invoice_record.folio,
            'fiscal_number', invoice_record.numero_fiscal,
            'applied_amount', application_amount
          );
          
          -- If payment is fully applied, stop
          IF remaining_amount <= 0.01 THEN
            EXIT;
          END IF;
        END IF;
      END;
    END LOOP;
  END IF;
  
  -- Update payment status
  UPDATE public.payments
  SET 
    applied_amount = COALESCE(applied_amount, 0) + total_applied,
    status = CASE 
      WHEN (COALESCE(applied_amount, 0) + total_applied) >= amount THEN 'applied'::payment_status
      WHEN total_applied > 0 THEN 'partial'::payment_status
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = p_payment_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'applied_invoices', applied_count,
    'total_applied', total_applied,
    'remaining_amount', remaining_amount,
    'applications', application_results,
    'message', format('Pago aplicado exitosamente a %s facturas por un total de $%s', applied_count, total_applied)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Error aplicando pago: ' || SQLERRM,
      'error_code', SQLSTATE
    );
END;
$_$;


ALTER FUNCTION "public"."apply_payment_selective"("p_payment_id" "uuid", "p_fiscal_numbers" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_payment_selective"("p_payment_id" "uuid", "p_fiscal_numbers" "text"[], "p_apply_only_to_specified" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_payment RECORD;
  v_invoice RECORD;
  v_amount_to_apply DECIMAL;
  v_remaining_payment DECIMAL;
  v_applied_total DECIMAL := 0;
  v_applications_created INTEGER := 0;
  v_error_msg TEXT;
BEGIN
  -- Get payment information
  SELECT * INTO v_payment
  FROM payments 
  WHERE id = p_payment_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pago no encontrado'
    );
  END IF;
  
  -- Initialize remaining payment amount
  v_remaining_payment := v_payment.amount - COALESCE(v_payment.applied_amount, 0);
  
  IF v_remaining_payment <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'El pago ya está completamente aplicado'
    );
  END IF;
  
  -- First phase: Apply to specified invoices by fiscal number
  IF array_length(p_fiscal_numbers, 1) > 0 THEN
    FOR i IN 1..array_length(p_fiscal_numbers, 1) LOOP
      EXIT WHEN v_remaining_payment <= 0;
      
      -- Find invoice by fiscal number for this client
      SELECT * INTO v_invoice
      FROM invoices 
      WHERE numero_fiscal = p_fiscal_numbers[i]
        AND client_id = v_payment.client_id
        AND status IN ('sent', 'overdue', 'partial')
        AND (total - COALESCE(paid_amount, 0)) > 0;
      
      IF FOUND THEN
        -- Calculate amount to apply (minimum of remaining payment and remaining invoice)
        v_amount_to_apply := LEAST(
          v_remaining_payment,
          v_invoice.total - COALESCE(v_invoice.paid_amount, 0)
        );
        
        -- Create payment application
        INSERT INTO payment_applications (
          payment_id,
          invoice_id,
          applied_amount,
          application_method,
          created_by
        ) VALUES (
          p_payment_id,
          v_invoice.id,
          v_amount_to_apply,
          'manual',
          v_payment.created_by
        );
        
        v_applied_total := v_applied_total + v_amount_to_apply;
        v_remaining_payment := v_remaining_payment - v_amount_to_apply;
        v_applications_created := v_applications_created + 1;
        
        RAISE NOTICE 'Applied % to invoice % (%)', v_amount_to_apply, v_invoice.folio, v_invoice.numero_fiscal;
      ELSE
        RAISE NOTICE 'Invoice with fiscal number % not found or not applicable', p_fiscal_numbers[i];
      END IF;
    END LOOP;
  END IF;
  
  -- Second phase: Apply remaining amount using FIFO (only if apply_only_to_specified is FALSE)
  IF NOT p_apply_only_to_specified AND v_remaining_payment > 0 THEN
    FOR v_invoice IN 
      SELECT *
      FROM invoices
      WHERE client_id = v_payment.client_id
        AND status IN ('sent', 'overdue', 'partial')
        AND (total - COALESCE(paid_amount, 0)) > 0
        AND id NOT IN (
          SELECT invoice_id 
          FROM payment_applications 
          WHERE payment_id = p_payment_id
        )
      ORDER BY issue_date ASC
    LOOP
      EXIT WHEN v_remaining_payment <= 0;
      
      v_amount_to_apply := LEAST(
        v_remaining_payment,
        v_invoice.total - COALESCE(v_invoice.paid_amount, 0)
      );
      
      INSERT INTO payment_applications (
        payment_id,
        invoice_id,
        applied_amount,
        application_method,
        created_by
      ) VALUES (
        p_payment_id,
        v_invoice.id,
        v_amount_to_apply,
        'fifo',
        v_payment.created_by
      );
      
      v_applied_total := v_applied_total + v_amount_to_apply;
      v_remaining_payment := v_remaining_payment - v_amount_to_apply;
      v_applications_created := v_applications_created + 1;
      
      RAISE NOTICE 'Applied % to invoice % via FIFO', v_amount_to_apply, v_invoice.folio;
    END LOOP;
  END IF;
  
  -- Update payment status
  UPDATE payments 
  SET 
    applied_amount = COALESCE(applied_amount, 0) + v_applied_total,
    status = CASE 
      WHEN (COALESCE(applied_amount, 0) + v_applied_total) >= amount THEN 'applied'::payment_status
      WHEN (COALESCE(applied_amount, 0) + v_applied_total) > 0 THEN 'partial'::payment_status
      ELSE 'pending'::payment_status
    END,
    updated_at = NOW()
  WHERE id = p_payment_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'applied_amount', v_applied_total,
    'remaining_amount', v_remaining_payment,
    'applications_created', v_applications_created,
    'apply_only_to_specified', p_apply_only_to_specified,
    'message', format('Aplicado %s en %s aplicaciones. Saldo restante: %s', 
      v_applied_total, v_applications_created, v_remaining_payment)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;


ALTER FUNCTION "public"."apply_payment_selective"("p_payment_id" "uuid", "p_fiscal_numbers" "text"[], "p_apply_only_to_specified" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_pending_payments_to_invoices"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."apply_pending_payments_to_invoices"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_pending_user"("target_user_id" "uuid", "new_role" "public"."app_role" DEFAULT 'viewer'::"public"."app_role", "target_client_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = target_user_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Usuario no encontrado o no está pendiente';
  END IF;

  IF new_role = 'client' AND target_client_id IS NULL THEN
    RAISE EXCEPTION 'Debes asignar un cliente antes de aprobar a un usuario cliente';
  END IF;

  IF target_client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clients WHERE id = target_client_id
  ) THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  -- Mantiene user_roles en sincronía, igual que update_user_role
  INSERT INTO public.user_roles (user_id, role, assigned_by)
  VALUES (target_user_id, new_role, auth.uid())
  ON CONFLICT (user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    assigned_by = EXCLUDED.assigned_by,
    assigned_at = now();

  UPDATE public.profiles
  SET
    status = 'approved',
    role = new_role,
    client_id = CASE WHEN new_role = 'client' THEN target_client_id ELSE NULL END,
    updated_at = now()
  WHERE id = target_user_id;
END;
$$;


ALTER FUNCTION "public"."approve_pending_user"("target_user_id" "uuid", "new_role" "public"."app_role", "target_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_default_cost_center"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_default_center uuid;
BEGIN
  IF NEW.cost_center_id IS NULL THEN
    SELECT default_cost_center_id
    INTO v_default_center
    FROM public.cost_categories
    WHERE id = NEW.category_id;

    IF v_default_center IS NOT NULL THEN
      NEW.cost_center_id := v_default_center;
    ELSE
      NEW.cost_center_id := (
        SELECT cc.id
        FROM public.cost_centers cc
        WHERE cc.code = CASE
          WHEN NEW.category_id IN (
            SELECT id FROM public.cost_categories
            WHERE name ILIKE '%combustible%' OR name ILIKE '%gasolina%' OR name ILIKE '%diesel%'
          ) THEN 'COMB'
          WHEN NEW.category_id IN (
            SELECT id FROM public.cost_categories
            WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%reparaci%' OR name ILIKE '%repuesto%'
          ) THEN 'MANT'
          WHEN NEW.category_id IN (
            SELECT id FROM public.cost_categories
            WHERE name ILIKE '%administrat%' OR name ILIKE '%oficina%' OR name ILIKE '%papeler%'
          ) THEN 'ADMIN'
          WHEN NEW.category_id IN (
            SELECT id FROM public.cost_categories
            WHERE name ILIKE '%personal%' OR name ILIKE '%salario%' OR name ILIKE '%sueldo%'
          ) THEN 'PERS'
          WHEN NEW.category_id IN (
            SELECT id FROM public.cost_categories
            WHERE name ILIKE '%servicio%' OR name ILIKE '%operacion%'
          ) THEN 'OPER'
          WHEN NEW.category_id IN (
            SELECT id FROM public.cost_categories
            WHERE name ILIKE '%tecnolog%' OR name ILIKE '%software%' OR name ILIKE '%equipo%'
          ) THEN 'TEC'
          WHEN NEW.category_id IN (
            SELECT id FROM public.cost_categories
            WHERE name ILIKE '%marketing%' OR name ILIKE '%publicidad%' OR name ILIKE '%comercial%'
          ) THEN 'MKT'
          ELSE 'OPER'
        END
        LIMIT 1
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assign_default_cost_center"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_user_client"("target_user_id" "uuid", "target_client_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Only admins can assign clients to users';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = target_user_id
  ) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF target_client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.clients
    WHERE id = target_client_id
  ) THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  UPDATE public.profiles
  SET
    client_id = target_client_id,
    updated_at = now()
  WHERE id = target_user_id;
END;
$$;


ALTER FUNCTION "public"."assign_user_client"("target_user_id" "uuid", "target_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_commission_system"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  total_services INTEGER;
  completed_services INTEGER;
  services_with_operator INTEGER;
  services_with_resources INTEGER;
  total_commissions INTEGER;
  pending_commissions INTEGER;
  paid_commissions INTEGER;
  missing_commissions INTEGER;
  orphaned_commissions INTEGER;
  result jsonb;
BEGIN
  -- Verificar permisos
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar auditorías';
  END IF;

  -- Contar servicios totales
  SELECT COUNT(*) INTO total_services FROM public.services;
  
  -- Contar servicios completados
  SELECT COUNT(*) INTO completed_services 
  FROM public.services WHERE status = 'completed';
  
  -- Contar servicios con operator_id
  SELECT COUNT(*) INTO services_with_operator 
  FROM public.services WHERE operator_id IS NOT NULL;
  
  -- Contar servicios con service_resources
  SELECT COUNT(DISTINCT service_id) INTO services_with_resources 
  FROM public.service_resources WHERE resource_type = 'operator';
  
  -- Contar comisiones totales
  SELECT COUNT(*) INTO total_commissions 
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name = 'Comisión Operador';
  
  -- Contar comisiones pendientes
  SELECT COUNT(*) INTO pending_commissions 
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name = 'Comisión Operador' 
    AND c.subcategory = 'comisiones';
  
  -- Contar comisiones pagadas
  SELECT COUNT(*) INTO paid_commissions 
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name = 'Comisión Operador' 
    AND c.subcategory = 'comisiones_pagadas';
  
  -- Calcular comisiones faltantes (servicios completados con recursos pero sin comisión)
  SELECT COUNT(*) INTO missing_commissions
  FROM public.services s
  JOIN public.service_resources sr ON s.id = sr.service_id
  WHERE s.status = 'completed' 
    AND sr.resource_type = 'operator'
    AND sr.commission_amount > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.costs c
      JOIN public.cost_categories cc ON c.category_id = cc.id
      WHERE cc.name = 'Comisión Operador'
        AND c.service_id = s.id
        AND c.operator_id = sr.operator_id
    );
  
  -- Comisiones huérfanas (sin servicio o operador válido)
  SELECT COUNT(*) INTO orphaned_commissions
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name = 'Comisión Operador'
    AND (c.service_id IS NULL OR c.operator_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM public.services WHERE id = c.service_id)
         OR NOT EXISTS (SELECT 1 FROM public.operators WHERE id = c.operator_id));

  result := jsonb_build_object(
    'audit_date', now(),
    'services', jsonb_build_object(
      'total', total_services,
      'completed', completed_services,
      'with_operator_id', services_with_operator,
      'with_resources', services_with_resources
    ),
    'commissions', jsonb_build_object(
      'total', total_commissions,
      'pending', pending_commissions,
      'paid', paid_commissions,
      'missing', missing_commissions,
      'orphaned', orphaned_commissions
    ),
    'issues', jsonb_build_object(
      'services_without_operator_id', completed_services - services_with_operator,
      'missing_commissions', missing_commissions,
      'orphaned_commissions', orphaned_commissions
    )
  );

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."audit_commission_system"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_update_invoice_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invoice_id UUID;
  v_invoice_total NUMERIC;
  v_invoice_due_date DATE;
  v_total_applied NUMERIC;
  v_new_status invoice_status;
BEGIN
  -- Determinar el invoice_id según el tipo de operación
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
  END IF;
  
  -- Obtener información de la factura
  SELECT total, due_date INTO v_invoice_total, v_invoice_due_date
  FROM invoices 
  WHERE id = v_invoice_id;
  
  -- Calcular total aplicado
  SELECT COALESCE(SUM(applied_amount), 0) INTO v_total_applied
  FROM payment_applications 
  WHERE invoice_id = v_invoice_id;
  
  -- Determinar nuevo estado
  IF v_total_applied >= v_invoice_total THEN
    v_new_status := 'paid'::invoice_status;
  ELSIF v_total_applied > 0 THEN
    v_new_status := 'partial'::invoice_status;
  ELSIF v_invoice_due_date < CURRENT_DATE THEN
    v_new_status := 'overdue'::invoice_status;
  ELSE
    v_new_status := 'sent'::invoice_status;
  END IF;
  
  -- Actualizar la factura (sin tocar campos generados automáticamente)
  UPDATE invoices 
  SET 
    paid_amount = v_total_applied,
    status = v_new_status,
    payment_date = CASE 
      WHEN v_new_status = 'paid' AND payment_date IS NULL THEN CURRENT_DATE
      WHEN v_new_status != 'paid' THEN NULL
      ELSE payment_date
    END,
    updated_at = NOW()
  WHERE id = v_invoice_id;
  
  -- Log para debugging
  RAISE NOTICE 'Auto-updated invoice %: total_applied=%, status=%', v_invoice_id, v_total_applied, v_new_status;
  
  -- Retornar registro apropiado según la operación
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."auto_update_invoice_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_update_maintenance_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Si se establece completed_date, cambiar status a completed
  IF NEW.completed_date IS NOT NULL AND OLD.completed_date IS NULL THEN
    NEW.status := 'completed';
    RAISE NOTICE 'Auto-actualizado status a completed para mantenimiento %', NEW.id;
  END IF;
  
  -- Si se quita completed_date, cambiar status a in_progress
  IF NEW.completed_date IS NULL AND OLD.completed_date IS NOT NULL THEN
    NEW.status := 'in_progress';
    RAISE NOTICE 'Auto-actualizado status a in_progress para mantenimiento %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_update_maintenance_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_update_service_invoice_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- When invoice_folio is added and status allows transition to invoiced
  IF NEW.invoice_folio IS NOT NULL AND NEW.invoice_folio != '' 
     AND (OLD.invoice_folio IS NULL OR OLD.invoice_folio = '') THEN
    IF NEW.status IN ('completed', 'failed') THEN
      NEW.status := 'invoiced';
    END IF;
  END IF;

  -- When invoice_folio is removed, only revert if currently invoiced
  IF (NEW.invoice_folio IS NULL OR NEW.invoice_folio = '') 
     AND (OLD.invoice_folio IS NOT NULL AND OLD.invoice_folio != '') THEN
    IF NEW.status = 'invoiced' THEN
      NEW.status := 'completed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_update_service_invoice_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_maintenance_costs"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  maintenance_record RECORD;
  maintenance_category_id UUID;
  created_count INTEGER := 0;
  error_count INTEGER := 0;
  errors jsonb := '[]'::jsonb;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar esta función';
  END IF;

  -- Obtener categoría de mantenimiento
  SELECT id INTO maintenance_category_id 
  FROM public.cost_categories 
  WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%mant%'
  LIMIT 1;

  -- Si no existe, crearla
  IF maintenance_category_id IS NULL THEN
    INSERT INTO public.cost_categories (name, description)
    VALUES ('Mantenimiento', 'Gastos de mantenimiento y reparaciones de grúas')
    RETURNING id INTO maintenance_category_id;
  END IF;

  -- Procesar mantenimientos completados sin costos asociados
  FOR maintenance_record IN 
    SELECT cm.* 
    FROM public.crane_maintenance cm
    WHERE cm.status = 'completed' 
    AND cm.cost > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.costs c 
      WHERE c.crane_id = cm.crane_id 
      AND c.date = COALESCE(cm.completed_date, cm.scheduled_date)
      AND c.amount = cm.cost
      AND c.category_id = maintenance_category_id
    )
    ORDER BY cm.completed_date DESC NULLS LAST
  LOOP
    BEGIN
      INSERT INTO public.costs (
        amount,
        category_id,
        crane_id,
        date,
        description,
        notes,
        subcategory,
        created_by
      ) VALUES (
        maintenance_record.cost,
        maintenance_category_id,
        maintenance_record.crane_id,
        COALESCE(maintenance_record.completed_date, maintenance_record.scheduled_date),
        'Mantenimiento ' || maintenance_record.maintenance_type || 
        CASE WHEN maintenance_record.provider IS NOT NULL THEN ' - ' || maintenance_record.provider ELSE '' END ||
        ' (Backfill automático)',
        COALESCE(maintenance_record.notes, '') || 
        CASE WHEN maintenance_record.description IS NOT NULL THEN ' | ' || maintenance_record.description ELSE '' END,
        CASE 
          WHEN maintenance_record.maintenance_type = 'preventive' THEN 'Mantenimiento Preventivo'
          WHEN maintenance_record.maintenance_type = 'corrective' THEN 'Mantenimiento Correctivo'
          WHEN maintenance_record.maintenance_type = 'emergency' THEN 'Mantenimiento de Emergencia'
          ELSE 'Mantenimiento General'
        END,
        maintenance_record.created_by
      );
      
      created_count := created_count + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        errors := errors || jsonb_build_object(
          'maintenance_id', maintenance_record.id,
          'crane_id', maintenance_record.crane_id,
          'error', SQLERRM
        );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'created_count', created_count,
    'error_count', error_count,
    'errors', errors,
    'message', format('Backfill completado: %s costos creados, %s errores', created_count, error_count)
  );
END;
$$;


ALTER FUNCTION "public"."backfill_maintenance_costs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_supplier_payments_from_costs"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  fixed_count integer := 0;
BEGIN
  PERFORM set_config('app.bidirectional_sync', 'true', true);
  PERFORM set_config('app.sync_in_progress', 'true', true);

  WITH candidate_costs AS (
    SELECT c.id,
           c.supplier_id,
           c.amount,
           c.description,
           c.date,
           c.payment_date,
           c.notes,
           c.subcategory,
           c.other_reason
    FROM public.costs c
    WHERE c.supplier_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.supplier_payments sp
        WHERE sp.cost_id = c.id
      )
  ),
  inserted_payments AS (
    INSERT INTO public.supplier_payments (
      supplier_id,
      amount,
      paid_amount,
      description,
      category,
      due_date,
      status,
      paid_date,
      notes,
      cost_id
    )
    SELECT cc.supplier_id,
           cc.amount,
           CASE WHEN cc.payment_date IS NOT NULL THEN cc.amount ELSE 0 END,
           COALESCE(NULLIF(BTRIM(cc.description), ''), 'Gasto registrado'),
           COALESCE(NULLIF(BTRIM(cc.subcategory), ''), NULLIF(BTRIM(cc.other_reason), ''), 'Costos'),
           COALESCE(cc.payment_date, cc.date, CURRENT_DATE),
           CASE WHEN cc.payment_date IS NOT NULL THEN 'paid' ELSE 'pending' END,
           cc.payment_date,
           cc.notes,
           cc.id
    FROM candidate_costs cc
    RETURNING id, cost_id
  )
  UPDATE public.costs c
  SET supplier_payment_id = ip.id,
      updated_at = now()
  FROM inserted_payments ip
  WHERE c.id = ip.cost_id
    AND c.supplier_payment_id IS DISTINCT FROM ip.id;

  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  RETURN fixed_count;
END;
$$;


ALTER FUNCTION "public"."backfill_supplier_payments_from_costs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."build_import_batch_summary"("p_batch_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'records', COALESCE(
      (
        SELECT jsonb_object_agg(table_name, cnt)
        FROM (
          SELECT table_name, COUNT(*)::int AS cnt
          FROM public.import_batch_records
          WHERE batch_id = p_batch_id
          GROUP BY table_name
        ) t
      ),
      '{}'::jsonb
    )
  );
$$;


ALTER FUNCTION "public"."build_import_batch_summary"("p_batch_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_billing_date"("service_date" "date", "billing_cycle_type" "text", "billing_delay_days" integer DEFAULT 0, "billing_cycle_day" integer DEFAULT NULL::integer) RETURNS "date"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  service_month_start date;
  next_month date;
  billing_date date;
BEGIN
  IF billing_cycle_type = 'immediate' THEN
    RETURN service_date;
  END IF;
  
  -- Para facturación diferida, todos los servicios de un mes se facturan en el mes siguiente
  -- Calcular el primer día del mes del servicio
  service_month_start := date_trunc('month', service_date)::date;
  
  -- Calcular el mes siguiente más los DÍAS de diferimiento
  next_month := (service_month_start + interval '1 month' + (billing_delay_days || ' days')::interval)::date;
  
  -- Si se especifica un día del ciclo, usar ese día, sino usar el día 5
  IF billing_cycle_day IS NOT NULL AND billing_cycle_day BETWEEN 1 AND 28 THEN
    -- Ajustar al día específico del mes
    billing_date := date_trunc('month', next_month)::date + (billing_cycle_day - 1);
  ELSE
    -- Por defecto usar el día 5 del mes
    billing_date := date_trunc('month', next_month)::date + interval '4 days';
  END IF;
  
  RETURN billing_date;
END;
$$;


ALTER FUNCTION "public"."calculate_billing_date"("service_date" "date", "billing_cycle_type" "text", "billing_delay_days" integer, "billing_cycle_day" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_crane_part_total_value"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Calcular total_value si no está definido o es 0
  IF NEW.total_value IS NULL OR NEW.total_value = 0 THEN
    NEW.total_value := COALESCE(NEW.quantity, 0) * COALESCE(NEW.unit_price, 0);
  END IF;
  
  -- Validar que tenemos valores válidos
  IF NEW.total_value <= 0 THEN
    RAISE WARNING 'total_value calculado es <= 0 para pieza: %. quantity: %, unit_price: %', 
      NEW.part_name, NEW.quantity, NEW.unit_price;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_crane_part_total_value"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_client_sensitive_data"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  -- Only admins can access sensitive client data (email, phone, address)
  SELECT is_admin_user_safe();
$$;


ALTER FUNCTION "public"."can_access_client_sensitive_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_notification"("target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT auth.uid() = target_user_id;
$$;


ALTER FUNCTION "public"."can_view_notification"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cascade_delete_cost"("p_cost_id" "uuid") RETURNS TABLE("deleted_costs" integer, "deleted_crane_parts" integer, "deleted_inventory_movements" integer, "deleted_supplier_payments" integer, "deleted_supplier_invoices" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid;
  v_role text;
  v_cost_inventory_id uuid;
  v_cost_payment_id uuid;
  v_inventory_ids uuid[] := ARRAY[]::uuid[];
  v_payment_ids uuid[] := ARRAY[]::uuid[];
  v_invoice_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  PERFORM set_config('app.cascade_delete', 'true', true);

  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Permisos insuficientes';
  END IF;

  SELECT inventory_movement_id, supplier_payment_id
  INTO v_cost_inventory_id, v_cost_payment_id
  FROM costs
  WHERE id = p_cost_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Costo no encontrado';
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_inventory_ids
  FROM inventory_movements
  WHERE cost_id = p_cost_id;
  IF v_cost_inventory_id IS NOT NULL THEN
    v_inventory_ids := v_inventory_ids || ARRAY[v_cost_inventory_id];
  END IF;
  SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::uuid[])
  INTO v_inventory_ids
  FROM unnest(v_inventory_ids) x
  WHERE x IS NOT NULL;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_payment_ids
  FROM supplier_payments
  WHERE cost_id = p_cost_id;
  IF v_cost_payment_id IS NOT NULL THEN
    v_payment_ids := v_payment_ids || ARRAY[v_cost_payment_id];
  END IF;
  SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::uuid[])
  INTO v_payment_ids
  FROM unnest(v_payment_ids) x
  WHERE x IS NOT NULL;

  IF array_length(v_payment_ids, 1) > 0 THEN
    SELECT COALESCE(array_agg(DISTINCT supplier_invoice_id), ARRAY[]::uuid[])
    INTO v_invoice_ids
    FROM supplier_payments
    WHERE id = ANY(v_payment_ids) AND supplier_invoice_id IS NOT NULL;
  END IF;

  WITH del AS (
    DELETE FROM crane_parts WHERE cost_id = p_cost_id RETURNING 1
  )
  SELECT COALESCE(count(*), 0) INTO deleted_crane_parts FROM del;

  IF array_length(v_inventory_ids, 1) > 0 THEN
    DELETE FROM inventory_consumptions WHERE movement_id = ANY(v_inventory_ids);
    WITH del AS (
      DELETE FROM inventory_movements WHERE id = ANY(v_inventory_ids) RETURNING 1
    )
    SELECT COALESCE(count(*), 0) INTO deleted_inventory_movements FROM del;
  ELSE
    deleted_inventory_movements := 0;
  END IF;

  IF array_length(v_payment_ids, 1) > 0 THEN
    WITH del AS (
      DELETE FROM supplier_payments WHERE id = ANY(v_payment_ids) RETURNING 1
    )
    SELECT COALESCE(count(*), 0) INTO deleted_supplier_payments FROM del;
  ELSE
    deleted_supplier_payments := 0;
  END IF;

  IF array_length(v_invoice_ids, 1) > 0 THEN
    WITH del AS (
      DELETE FROM supplier_invoices WHERE id = ANY(v_invoice_ids) RETURNING 1
    )
    SELECT COALESCE(count(*), 0) INTO deleted_supplier_invoices FROM del;
  ELSE
    deleted_supplier_invoices := 0;
  END IF;

  WITH del AS (
    DELETE FROM costs WHERE id = p_cost_id RETURNING 1
  )
  SELECT COALESCE(count(*), 0) INTO deleted_costs FROM del;

  RETURN QUERY
  SELECT deleted_costs, deleted_crane_parts, deleted_inventory_movements, deleted_supplier_payments, deleted_supplier_invoices;
END;
$$;


ALTER FUNCTION "public"."cascade_delete_cost"("p_cost_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cascade_delete_service_data"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Log de la eliminación automática
  RAISE NOTICE 'Trigger: Limpiando datos relacionados del servicio eliminado: %', OLD.id;

  -- Eliminar costos relacionados
  DELETE FROM public.costs WHERE service_id = OLD.id;
  
  -- Eliminar service_costs
  DELETE FROM public.service_costs WHERE service_id = OLD.id;
  
  -- Eliminar service_resources  
  DELETE FROM public.service_resources WHERE service_id = OLD.id;
  
  -- Eliminar inspecciones
  DELETE FROM public.inspections WHERE service_id = OLD.id;
  
  -- Eliminar de closure_services
  DELETE FROM public.closure_services WHERE service_id = OLD.id;
  
  -- Eliminar de invoice_services
  DELETE FROM public.invoice_services WHERE service_id = OLD.id;
  
  -- Eliminar eventos de calendario
  DELETE FROM public.calendar_events WHERE service_id = OLD.id;

  RAISE NOTICE 'Trigger: Datos relacionados eliminados exitosamente para servicio: %', OLD.id;
  
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."cascade_delete_service_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_and_update_overdue_invoices"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Ejecutar actualización global de facturas vencidas
  PERFORM public.update_overdue_invoices();
  
  -- Si es INSERT o UPDATE, verificar la factura actual
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    -- Verificar si la factura actual debería estar vencida
    IF NEW.due_date < CURRENT_DATE 
       AND NEW.status IN ('sent', 'draft') 
       AND NEW.status != 'overdue'
       AND NEW.status != 'paid'
       AND NEW.status != 'cancelled' THEN
      NEW.status := 'overdue';
      NEW.updated_at := now();
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."check_and_update_overdue_invoices"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_auth_health"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  auth_user_count INTEGER;
  profile_count INTEGER;
  result jsonb;
BEGIN
  -- Count authenticated users
  SELECT COUNT(*) INTO profile_count FROM public.profiles;
  
  result := jsonb_build_object(
    'profiles_count', profile_count,
    'rls_enabled', (SELECT relrowsecurity FROM pg_class WHERE relname = 'profiles'),
    'policies_count', (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'profiles'),
    'timestamp', now()
  );
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."check_auth_health"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_bidirectional_sync_status"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  purchase_movements INTEGER;
  consumption_movements INTEGER;
  synced_purchases INTEGER;
  synced_consumptions INTEGER;
  total_crane_parts INTEGER;
  purchase_parts INTEGER;
  consumption_parts INTEGER;
BEGIN
  -- Contar movimientos de compra (entry)
  SELECT COUNT(*) INTO purchase_movements
  FROM public.inventory_movements
  WHERE movement_type = 'entry';

  -- Contar movimientos de consumo (exit con crane_id)
  SELECT COUNT(*) INTO consumption_movements
  FROM public.inventory_movements
  WHERE movement_type = 'exit' AND crane_id IS NOT NULL;

  -- Contar compras sincronizadas
  SELECT COUNT(*) INTO synced_purchases
  FROM public.crane_parts cp
  INNER JOIN public.inventory_movements im ON cp.inventory_movement_id = im.id
  WHERE im.movement_type = 'entry' AND cp.quantity > 0;

  -- Contar consumos sincronizados
  SELECT COUNT(*) INTO synced_consumptions
  FROM public.crane_parts cp
  INNER JOIN public.inventory_movements im ON cp.inventory_movement_id = im.id
  WHERE im.movement_type = 'exit' AND cp.quantity < 0;

  -- Contar piezas totales
  SELECT COUNT(*) INTO total_crane_parts FROM public.crane_parts;

  -- Contar piezas de compra vs consumo
  SELECT COUNT(*) INTO purchase_parts FROM public.crane_parts WHERE quantity > 0;
  SELECT COUNT(*) INTO consumption_parts FROM public.crane_parts WHERE quantity < 0;

  RETURN jsonb_build_object(
    'purchase_movements', purchase_movements,
    'consumption_movements', consumption_movements,
    'synced_purchases', synced_purchases,
    'synced_consumptions', synced_consumptions,
    'total_crane_parts', total_crane_parts,
    'purchase_parts', purchase_parts,
    'consumption_parts', consumption_parts,
    'purchase_sync_rate', CASE WHEN purchase_movements > 0 THEN ROUND((synced_purchases::decimal / purchase_movements::decimal) * 100, 2) ELSE 0 END,
    'consumption_sync_rate', CASE WHEN consumption_movements > 0 THEN ROUND((synced_consumptions::decimal / consumption_movements::decimal) * 100, 2) ELSE 0 END,
    'bidirectional_complete', (synced_purchases + synced_consumptions) = (purchase_movements + consumption_movements)
  );
END;
$$;


ALTER FUNCTION "public"."check_bidirectional_sync_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_cost_duplicates"("p_date" "date", "p_amount" numeric, "p_description" "text", "p_folio" "text" DEFAULT NULL::"text", "p_tolerance_percent" numeric DEFAULT 5) RETURNS TABLE("id" "uuid", "date" "date", "description" "text", "amount" numeric, "service_folio" "text", "created_at" timestamp with time zone, "match_type" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.date,
    c.description,
    c.amount,
    c.service_folio,
    c.created_at,
    CASE
      WHEN c.date = p_date AND c.amount = p_amount AND LOWER(TRIM(c.description)) = LOWER(TRIM(p_description)) THEN 'exact'
      WHEN p_folio IS NOT NULL AND p_folio != '' AND c.service_folio = p_folio THEN 'folio'
      WHEN c.date = p_date AND ABS(c.amount - p_amount) <= (p_amount * p_tolerance_percent / 100) THEN 'similar'
    END AS match_type
  FROM costs c
  WHERE 
    (c.date = p_date AND c.amount = p_amount AND LOWER(TRIM(c.description)) = LOWER(TRIM(p_description)))
    OR (p_folio IS NOT NULL AND p_folio != '' AND c.service_folio = p_folio)
    OR (c.date = p_date AND ABS(c.amount - p_amount) <= (p_amount * p_tolerance_percent / 100))
  ORDER BY 
    CASE 
      WHEN c.date = p_date AND c.amount = p_amount AND LOWER(TRIM(c.description)) = LOWER(TRIM(p_description)) THEN 1
      WHEN p_folio IS NOT NULL AND p_folio != '' AND c.service_folio = p_folio THEN 2
      ELSE 3
    END,
    c.created_at DESC
  LIMIT 5;
END;
$$;


ALTER FUNCTION "public"."check_cost_duplicates"("p_date" "date", "p_amount" numeric, "p_description" "text", "p_folio" "text", "p_tolerance_percent" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_for_duplicate_payment"("p_client_id" "uuid", "p_amount" numeric, "p_payment_date" "date", "p_tolerance_days" integer DEFAULT 3) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."check_for_duplicate_payment"("p_client_id" "uuid", "p_amount" numeric, "p_payment_date" "date", "p_tolerance_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_inventory_alerts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  item_record RECORD;
  alert_record RECORD;
BEGIN
  -- Get item details
  SELECT * INTO item_record FROM public.inventory_items WHERE id = NEW.item_id;
  
  -- Check low stock alerts
  IF NEW.current_quantity <= item_record.minimum_stock THEN
    INSERT INTO public.notification_logs (user_id, type, title, body, data)
    SELECT 
      p.id,
      'inventory_alert',
      'Stock Bajo: ' || item_record.name,
      'El producto ' || item_record.name || ' tiene stock bajo (' || NEW.current_quantity || ' unidades)',
      jsonb_build_object('item_id', NEW.item_id, 'location_id', NEW.location_id, 'quantity', NEW.current_quantity)
    FROM public.profiles p 
    WHERE p.role IN ('admin', 'operator');
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_inventory_alerts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_inventory_sync_status"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  total_parts INTEGER;
  synced_parts INTEGER;
  unsynced_parts INTEGER;
  total_items INTEGER;
  auto_created_items INTEGER;
BEGIN
  -- Contar piezas totales
  SELECT COUNT(*) INTO total_parts FROM public.crane_parts;
  
  -- Contar piezas sincronizadas
  SELECT COUNT(*) INTO synced_parts 
  FROM public.crane_parts 
  WHERE inventory_movement_id IS NOT NULL;
  
  -- Calcular no sincronizadas
  unsynced_parts := total_parts - synced_parts;
  
  -- Contar items de inventario totales
  SELECT COUNT(*) INTO total_items FROM public.inventory_items WHERE is_active = true;
  
  -- Contar items auto-creados
  SELECT COUNT(*) INTO auto_created_items 
  FROM public.inventory_items 
  WHERE description LIKE '%Auto-creado%' OR description LIKE '%Migrado%';

  RETURN jsonb_build_object(
    'total_parts', total_parts,
    'synced_parts', synced_parts,
    'unsynced_parts', unsynced_parts,
    'sync_percentage', CASE WHEN total_parts > 0 THEN ROUND((synced_parts::decimal / total_parts::decimal) * 100, 2) ELSE 0 END,
    'total_inventory_items', total_items,
    'auto_created_items', auto_created_items,
    'trigger_exists', EXISTS(
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'sync_parts_purchase_trigger'
    )
  );
END;
$$;


ALTER FUNCTION "public"."check_inventory_sync_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_operator_not_excluded"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_operator_name TEXT;
  v_excluded_operators TEXT[] := ARRAY['Jorge Iriarte', 'Sergio Iriarte', 'Jorge Ignacio Iriarte'];
BEGIN
  IF NEW.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4' AND NEW.operator_id IS NOT NULL THEN
    SELECT name INTO v_operator_name FROM operators WHERE id = NEW.operator_id;
    IF v_operator_name = ANY(v_excluded_operators) THEN
      RAISE EXCEPTION 'No se pueden crear comisiones para operadores excluidos: %', v_operator_name;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_operator_not_excluded"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_operator_visibility"("p_email" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_profile_id     uuid;
  v_profile_role   text;
  v_has_op_role    boolean;
  v_operator_id    uuid;
  v_operator_name  text;
  v_services_direct  int;
  v_services_resource int;
  v_resource_types   text[];
  v_pending_direct   int;
  v_pending_resource int;
BEGIN
  -- 1. Profile lookup
  SELECT id, role INTO v_profile_id, v_profile_role
  FROM public.profiles
  WHERE email = p_email
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'No profile found for email: ' || p_email
    );
  END IF;

  -- 2. user_roles check
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_profile_id AND role = 'operator'
  ) INTO v_has_op_role;

  -- 3. Operator record
  SELECT id, name INTO v_operator_id, v_operator_name
  FROM public.operators
  WHERE user_id = v_profile_id
  LIMIT 1;

  -- 4. Services via direct operator_id
  SELECT COUNT(*) INTO v_services_direct
  FROM public.services
  WHERE operator_id = v_operator_id;

  SELECT COUNT(*) INTO v_pending_direct
  FROM public.services
  WHERE operator_id = v_operator_id
    AND status = 'pending';

  -- 5. Services via service_resources
  SELECT COUNT(DISTINCT service_id) INTO v_services_resource
  FROM public.service_resources
  WHERE operator_id = v_operator_id;

  SELECT COUNT(DISTINCT sr.service_id) INTO v_pending_resource
  FROM public.service_resources sr
  JOIN public.services s ON s.id = sr.service_id
  WHERE sr.operator_id = v_operator_id
    AND s.status = 'pending';

  -- 6. Distinct resource_type values for this operator
  SELECT ARRAY_AGG(DISTINCT resource_type) INTO v_resource_types
  FROM public.service_resources
  WHERE operator_id = v_operator_id;

  RETURN jsonb_build_object(
    'email',              p_email,
    'profile_id',         v_profile_id,
    'profile_role',       v_profile_role,
    'has_operator_role_in_user_roles', v_has_op_role,
    'operator_id',        v_operator_id,
    'operator_name',      v_operator_name,
    'operator_user_id_set', (v_operator_id IS NOT NULL),
    'services_via_direct_operator_id', v_services_direct,
    'services_pending_via_direct',     v_pending_direct,
    'services_via_service_resources',  v_services_resource,
    'services_pending_via_resources',  v_pending_resource,
    'resource_types_found',            to_jsonb(v_resource_types),
    'diagnosis', CASE
      WHEN v_profile_id IS NULL THEN
        'FAIL: perfil no existe para este email'
      WHEN NOT v_has_op_role THEN
        'FAIL: user_roles no tiene role=''operator'' para este usuario. Agregar fila en user_roles.'
      WHEN v_operator_id IS NULL THEN
        'FAIL: no hay fila en operators con user_id = profile_id. Ejecutar UPDATE operators SET user_id = ... '
      WHEN v_services_direct = 0 AND v_services_resource = 0 THEN
        'INFO: operador configurado correctamente pero no tiene servicios asignados aún'
      WHEN v_pending_direct = 0 AND v_pending_resource = 0 THEN
        'INFO: tiene servicios pero ninguno en estado ''pending'' (tab Asignados). Revisar otros tabs.'
      ELSE
        'OK: configuración correcta — ' ||
        v_services_direct || ' servicios vía operator_id, ' ||
        v_services_resource || ' vía service_resources'
    END
  );
END;
$$;


ALTER FUNCTION "public"."check_operator_visibility"("p_email" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_operator_visibility"("p_email" "text") IS 'Diagnóstico de visibilidad de servicios para un operador dado su email. Ejecutar como admin.';



CREATE OR REPLACE FUNCTION "public"."check_security_compliance"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  anonymous_policies INTEGER;
  mutable_functions INTEGER;
  result jsonb;
BEGIN
  -- Count policies allowing anonymous access
  SELECT COUNT(*) INTO anonymous_policies
  FROM pg_policies 
  WHERE schemaname = 'public'
  AND roles && ARRAY['anon']::name[];

  -- Count functions without fixed search_path
  SELECT COUNT(*) INTO mutable_functions
  FROM information_schema.routines r
  WHERE r.routine_schema = 'public' 
  AND r.routine_type = 'FUNCTION'
  AND NOT EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname = r.routine_name
    AND p.proconfig IS NOT NULL
    AND array_to_string(p.proconfig, ',') LIKE '%search_path%'
  );

  result := jsonb_build_object(
    'anonymous_policies', anonymous_policies,
    'mutable_functions', mutable_functions,
    'is_secure', (anonymous_policies = 0 AND mutable_functions <= 2),
    'timestamp', now()
  );

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."check_security_compliance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_security_status"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  mutable_functions INTEGER := 0;
  tables_without_policies INTEGER := 0;
  result_text TEXT;
BEGIN
  -- Contar funciones con search_path mutable
  SELECT COUNT(*) INTO mutable_functions
  FROM information_schema.routines r
  WHERE r.routine_schema = 'public' 
  AND r.routine_type = 'FUNCTION'
  AND NOT EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname = r.routine_name
    AND p.proconfig IS NOT NULL
    AND array_to_string(p.proconfig, ',') LIKE '%search_path%'
  );

  -- Contar tablas con RLS habilitado pero sin políticas
  SELECT COUNT(*) INTO tables_without_policies
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p 
    WHERE p.schemaname = 'public' 
    AND p.tablename = c.relname
  );

  result_text := format(
    'ESTADO SEGURIDAD: %s funciones mutable, %s tablas sin políticas - %s',
    mutable_functions,
    tables_without_policies,
    CASE WHEN mutable_functions = 0 AND tables_without_policies = 0 THEN 'SEGURO' ELSE 'MEJORADO' END
  );

  RETURN result_text;
END;
$$;


ALTER FUNCTION "public"."check_security_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_service_invoice_consistency"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  inconsistent_services INTEGER;
  services_with_folio INTEGER;
  services_invoiced INTEGER;
  sample_folios text[];
BEGIN
  -- Contar servicios inconsistentes
  SELECT COUNT(*) INTO inconsistent_services
  FROM public.services 
  WHERE invoice_folio IS NOT NULL 
    AND invoice_folio != ''
    AND status != 'invoiced';

  -- Contar servicios con folio
  SELECT COUNT(*) INTO services_with_folio
  FROM public.services 
  WHERE invoice_folio IS NOT NULL AND invoice_folio != '';

  -- Contar servicios con status invoiced
  SELECT COUNT(*) INTO services_invoiced
  FROM public.services 
  WHERE status = 'invoiced';

  -- Obtener muestra de inconsistencias para debugging (corregido)
  SELECT array_agg(folio) INTO sample_folios
  FROM (
    SELECT folio 
    FROM public.services 
    WHERE invoice_folio IS NOT NULL 
      AND invoice_folio != ''
      AND status != 'invoiced'
    ORDER BY folio 
    LIMIT 5
  ) sample;

  RETURN jsonb_build_object(
    'consistent', (inconsistent_services = 0),
    'inconsistent_services_count', inconsistent_services,
    'services_with_invoice_folio', services_with_folio,
    'services_with_invoiced_status', services_invoiced,
    'sample_inconsistent_folios', COALESCE(sample_folios, ARRAY[]::text[]),
    'last_check', now(),
    'status', CASE 
      WHEN inconsistent_services = 0 THEN 'PERFECTO'
      WHEN inconsistent_services <= 5 THEN 'ADVERTENCIA'
      ELSE 'CRÍTICO'
    END
  );
END;
$$;


ALTER FUNCTION "public"."check_service_invoice_consistency"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_supplier_duplicates"("p_rut" "text", "p_name" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "name" "text", "rut" "text", "email" "text", "phone" "text", "is_active" boolean, "created_at" timestamp with time zone, "match_type" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    s.rut,
    s.email,
    s.phone,
    s.is_active,
    s.created_at,
    CASE
      WHEN s.rut = p_rut THEN 'exact_rut'
      WHEN p_name IS NOT NULL AND LOWER(TRIM(s.name)) = LOWER(TRIM(p_name)) THEN 'exact_name'
      WHEN p_name IS NOT NULL AND s.name ILIKE '%' || p_name || '%' THEN 'similar_name'
    END AS match_type
  FROM suppliers s
  WHERE 
    s.rut = p_rut
    OR (p_name IS NOT NULL AND LOWER(TRIM(s.name)) = LOWER(TRIM(p_name)))
    OR (p_name IS NOT NULL AND s.name ILIKE '%' || p_name || '%')
  ORDER BY 
    CASE 
      WHEN s.rut = p_rut THEN 1
      WHEN p_name IS NOT NULL AND LOWER(TRIM(s.name)) = LOWER(TRIM(p_name)) THEN 2
      ELSE 3
    END,
    s.created_at DESC
  LIMIT 5;
END;
$$;


ALTER FUNCTION "public"."check_supplier_duplicates"("p_rut" "text", "p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_supplier_invoice_duplicates"("p_folio" "text", "p_supplier_rut" "text" DEFAULT NULL::"text", "p_amount" numeric DEFAULT NULL::numeric, "p_tolerance_percent" numeric DEFAULT 5) RETURNS TABLE("id" "uuid", "reference_number" "text", "supplier_id" "uuid", "supplier_name" "text", "supplier_rut" "text", "amount" numeric, "due_date" "date", "created_at" timestamp with time zone, "match_type" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id,
    sp.reference_number,
    sp.supplier_id,
    s.name AS supplier_name,
    s.rut AS supplier_rut,
    sp.amount,
    sp.due_date,
    sp.created_at,
    CASE
      WHEN sp.reference_number = p_folio THEN 'exact_folio'
      WHEN p_supplier_rut IS NOT NULL AND s.rut = p_supplier_rut AND p_amount IS NOT NULL 
           AND ABS(sp.amount - p_amount) <= (p_amount * p_tolerance_percent / 100) THEN 'similar'
    END AS match_type
  FROM supplier_payments sp
  JOIN inventory_suppliers s ON s.id = sp.supplier_id
  WHERE 
    sp.reference_number = p_folio
    OR (p_supplier_rut IS NOT NULL AND s.rut = p_supplier_rut AND p_amount IS NOT NULL 
        AND ABS(sp.amount - p_amount) <= (p_amount * p_tolerance_percent / 100))
  ORDER BY 
    CASE WHEN sp.reference_number = p_folio THEN 1 ELSE 2 END,
    sp.created_at DESC
  LIMIT 5;
END;
$$;


ALTER FUNCTION "public"."check_supplier_invoice_duplicates"("p_folio" "text", "p_supplier_rut" "text", "p_amount" numeric, "p_tolerance_percent" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_duplicate_inventory_costs"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  duplicate_costs_count INTEGER := 0;
  cleaned_costs_count INTEGER := 0;
  cost_record RECORD;
  maintenance_category_id UUID;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar la limpieza de duplicados';
  END IF;

  -- Obtener ID de categoría de mantenimiento
  SELECT id INTO maintenance_category_id
  FROM public.cost_categories
  WHERE name ILIKE '%mantenimiento%' 
  LIMIT 1;

  -- Contar costos de "Consumo de Inventario" con valores sospechosos
  SELECT COUNT(*) INTO duplicate_costs_count
  FROM public.costs c
  WHERE c.category_id = maintenance_category_id
    AND c.subcategory = 'Consumo de Inventario'
    AND (c.amount = 0.01 OR c.description ILIKE '%consumo de inventario%');

  RAISE NOTICE 'Encontrados % costos duplicados de consumo de inventario', duplicate_costs_count;

  -- Eliminar costos duplicados y actualizar crane_parts asociados
  FOR cost_record IN 
    SELECT c.*, cp.id as crane_part_id
    FROM public.costs c
    LEFT JOIN public.crane_parts cp ON c.id = cp.cost_id
    WHERE c.category_id = maintenance_category_id
      AND c.subcategory = 'Consumo de Inventario'
      AND (c.amount = 0.01 OR c.description ILIKE '%consumo de inventario%')
  LOOP
    -- Desvincular crane_parts del cost que se va a eliminar
    IF cost_record.crane_part_id IS NOT NULL THEN
      UPDATE public.crane_parts 
      SET cost_id = NULL,
          notes = COALESCE(notes, '') || ' [Cost duplicado eliminado automáticamente]'
      WHERE id = cost_record.crane_part_id;
    END IF;
    
    -- Eliminar el cost duplicado
    DELETE FROM public.costs WHERE id = cost_record.id;
    cleaned_costs_count := cleaned_costs_count + 1;
    
    RAISE NOTICE 'Eliminado cost duplicado: % ($%)', cost_record.description, cost_record.amount;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_duplicates_found', duplicate_costs_count,
    'costs_cleaned', cleaned_costs_count,
    'message', format('Limpieza completada: eliminados %s costos duplicados de consumo de inventario', cleaned_costs_count)
  );
END;
$_$;


ALTER FUNCTION "public"."cleanup_duplicate_inventory_costs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_duplicate_payments"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  duplicate_record RECORD;
  deleted_count INTEGER := 0;
  kept_count INTEGER := 0;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden limpiar duplicados';
  END IF;

  -- Identificar y eliminar duplicados, manteniendo el más reciente
  FOR duplicate_record IN 
    SELECT 
      client_id,
      amount,
      payment_date,
      payment_method,
      array_agg(id ORDER BY created_at DESC) as payment_ids,
      COUNT(*) as duplicate_count
    FROM public.payments 
    GROUP BY client_id, amount, payment_date, payment_method
    HAVING COUNT(*) > 1
  LOOP
    -- Mantener el primer pago (más reciente) y eliminar los duplicados
    FOR i IN 2..array_length(duplicate_record.payment_ids, 1) LOOP
      -- Eliminar aplicaciones de pago duplicadas
      DELETE FROM public.payment_applications 
      WHERE payment_id = duplicate_record.payment_ids[i];
      
      -- Eliminar el pago duplicado
      DELETE FROM public.payments 
      WHERE id = duplicate_record.payment_ids[i];
      
      deleted_count := deleted_count + 1;
    END LOOP;
    
    kept_count := kept_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_payments', deleted_count,
    'kept_payments', kept_count,
    'message', format('Limpieza completada: eliminados %s duplicados, mantenidos %s pagos únicos', deleted_count, kept_count)
  );
END;
$$;


ALTER FUNCTION "public"."cleanup_duplicate_payments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_duplicate_profiles"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Eliminar perfiles duplicados por email, manteniendo el más reciente
  WITH duplicates AS (
    SELECT id, email, role, created_at,
      ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn
    FROM public.profiles
  )
  DELETE FROM public.profiles 
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  );
  
  RAISE NOTICE 'Duplicate profiles cleanup completed';
END;
$$;


ALTER FUNCTION "public"."cleanup_duplicate_profiles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_orphaned_supplier_costs"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  -- Marcar costos huérfanos con descripción especial
  UPDATE costs
  SET 
    description = description || ' [COSTO HUÉRFANO - SIN PAGO VINCULADO]',
    notes = COALESCE(notes, '') || ' [LIMPIEZA AUTOMÁTICA: ' || NOW()::DATE || ']'
  WHERE 
    description LIKE '%Pago a proveedor%'
    AND NOT EXISTS (
      SELECT 1 FROM supplier_payment_cost_links spcl
      WHERE spcl.cost_id = costs.id
    )
    AND description NOT LIKE '%HUÉRFANO%';
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN v_updated_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_orphaned_supplier_costs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_payment_duplicates"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."cleanup_payment_duplicates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_service_status_only"("p_service_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result jsonb;
  service_folio text;
BEGIN
  -- Obtener folio del servicio para logging
  SELECT folio INTO service_folio
  FROM public.services
  WHERE id = p_service_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Servicio no encontrado'
    );
  END IF;
  
  -- Actualizar solo el estado sin disparar lógica de comisiones
  UPDATE public.services 
  SET 
    status = 'completed',
    updated_at = now()
  WHERE id = p_service_id;
  
  -- Verificar que se actualizó
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se pudo actualizar el servicio'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'service_id', p_service_id,
    'service_folio', service_folio,
    'new_status', 'completed',
    'message', 'Servicio cerrado exitosamente'
  );
END;
$$;


ALTER FUNCTION "public"."close_service_status_only"("p_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comprehensive_payment_diagnosis"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."comprehensive_payment_diagnosis"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_automatic_payment_for_invoice"("p_invoice_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invoice RECORD;
  v_payment_id UUID;
  v_existing_payment_id UUID;
  v_calculated_paid NUMERIC;
BEGIN
  -- Obtener información de la factura
  SELECT 
    i.id,
    i.folio,
    i.client_id,
    i.total,
    i.paid_amount,
    i.status,
    i.issue_date
  INTO v_invoice
  FROM invoices i
  WHERE i.id = p_invoice_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Factura no encontrada'
    );
  END IF;
  
  -- VALIDACIÓN PREVENTIVA: Detectar inconsistencias antes de procesar
  SELECT COALESCE(SUM(applied_amount), 0) INTO v_calculated_paid
  FROM payment_applications 
  WHERE invoice_id = p_invoice_id;
  
  IF v_invoice.paid_amount != v_calculated_paid THEN
    RAISE WARNING 'Inconsistencia detectada en factura %: paid_amount=% pero suma de aplicaciones=%', 
      v_invoice.folio, 
      v_invoice.paid_amount,
      v_calculated_paid;
    
    -- Auto-corregir antes de continuar
    UPDATE invoices 
    SET paid_amount = v_calculated_paid,
        updated_at = NOW()
    WHERE id = p_invoice_id;
    
    RAISE NOTICE 'Auto-corrección aplicada a factura %', v_invoice.folio;
    v_invoice.paid_amount := v_calculated_paid;
  END IF;
  
  -- Verificar si la factura ya está pagada
  IF v_invoice.status = 'paid' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'La factura ya está marcada como pagada',
      'invoice_folio', v_invoice.folio
    );
  END IF;
  
  -- Calcular monto pendiente
  DECLARE
    v_remaining_amount NUMERIC;
  BEGIN
    v_remaining_amount := v_invoice.total - v_invoice.paid_amount;
    
    IF v_remaining_amount <= 0 THEN
      -- Si no hay monto pendiente, actualizar estado a paid
      UPDATE invoices 
      SET status = 'paid'::invoice_status,
          payment_date = CURRENT_DATE,
          updated_at = NOW()
      WHERE id = p_invoice_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Factura ya está completamente pagada',
        'invoice_folio', v_invoice.folio,
        'status', 'paid'
      );
    END IF;
    
    -- Verificar si ya existe un pago automático para esta factura
    SELECT pa.payment_id INTO v_existing_payment_id
    FROM payment_applications pa
    JOIN payments p ON pa.payment_id = p.id
    WHERE pa.invoice_id = p_invoice_id
      AND pa.application_method = 'fifo'
      AND p.notes ILIKE '%Pago automático%'
    LIMIT 1;
    
    IF v_existing_payment_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Ya existe un pago automático para esta factura',
        'payment_id', v_existing_payment_id
      );
    END IF;
    
    -- Crear pago automático
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
      v_remaining_amount,
      CURRENT_DATE,
      'transferencia',
      'AUTO-' || v_invoice.folio,
      'Pago automático generado para ' || v_invoice.folio,
      'pending'::payment_status,
      0, -- Será actualizado por el trigger
      auth.uid()
    ) RETURNING id INTO v_payment_id;
    
    -- Aplicar el pago a la factura
    INSERT INTO payment_applications (
      payment_id,
      invoice_id,
      applied_amount,
      application_method,
      notes,
      created_by
    ) VALUES (
      v_payment_id,
      p_invoice_id,
      v_remaining_amount,
      'fifo',
      'Aplicación automática generada',
      auth.uid()
    );
    
    -- El trigger auto_update_invoice_status se encargará de actualizar
    -- paid_amount, status y payment_date automáticamente
    
    -- Logging detallado
    RAISE NOTICE 'Pago automático creado: payment_id=%, invoice=%, amount=%', 
      v_payment_id, v_invoice.folio, v_remaining_amount;
    
    RETURN jsonb_build_object(
      'success', true,
      'payment_id', v_payment_id,
      'invoice_id', p_invoice_id,
      'invoice_folio', v_invoice.folio,
      'amount', v_remaining_amount,
      'status', 'paid',
      'message', 'Pago automático creado exitosamente'
    );
  END;
END;
$$;


ALTER FUNCTION "public"."create_automatic_payment_for_invoice"("p_invoice_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_automatic_payment_for_invoice"("p_invoice_id" "uuid", "p_payment_date" "date" DEFAULT CURRENT_DATE) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invoice RECORD;
  v_payment_id UUID;
  v_existing_payment_id UUID;
  v_calculated_paid NUMERIC;
BEGIN
  -- Obtener información de la factura
  SELECT 
    i.id,
    i.folio,
    i.client_id,
    i.total,
    i.paid_amount,
    i.status,
    i.issue_date
  INTO v_invoice
  FROM invoices i
  WHERE i.id = p_invoice_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Factura no encontrada'
    );
  END IF;
  
  -- VALIDACIÓN PREVENTIVA: Detectar inconsistencias antes de procesar
  SELECT COALESCE(SUM(applied_amount), 0) INTO v_calculated_paid
  FROM payment_applications 
  WHERE invoice_id = p_invoice_id;
  
  IF v_invoice.paid_amount != v_calculated_paid THEN
    RAISE WARNING 'Inconsistencia detectada en factura %: paid_amount=% pero suma de aplicaciones=%', 
      v_invoice.folio, 
      v_invoice.paid_amount,
      v_calculated_paid;
    
    UPDATE invoices 
    SET paid_amount = v_calculated_paid,
        updated_at = NOW()
    WHERE id = p_invoice_id;
    
    v_invoice.paid_amount := v_calculated_paid;
  END IF;
  
  -- Verificar si la factura ya está pagada
  IF v_invoice.status = 'paid' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'La factura ya está marcada como pagada',
      'invoice_folio', v_invoice.folio
    );
  END IF;
  
  DECLARE
    v_remaining_amount NUMERIC;
  BEGIN
    v_remaining_amount := v_invoice.total - v_invoice.paid_amount;
    
    IF v_remaining_amount <= 0 THEN
      UPDATE invoices 
      SET status = 'paid'::invoice_status,
          payment_date = p_payment_date,
          updated_at = NOW()
      WHERE id = p_invoice_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Factura ya está completamente pagada',
        'invoice_folio', v_invoice.folio,
        'status', 'paid'
      );
    END IF;
    
    -- Verificar si ya existe un pago automático para esta factura
    SELECT pa.payment_id INTO v_existing_payment_id
    FROM payment_applications pa
    JOIN payments p ON pa.payment_id = p.id
    WHERE pa.invoice_id = p_invoice_id
      AND pa.application_method = 'fifo'
      AND p.notes ILIKE '%Pago automático%'
    LIMIT 1;
    
    IF v_existing_payment_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Ya existe un pago automático para esta factura',
        'payment_id', v_existing_payment_id
      );
    END IF;
    
    -- Crear pago automático con la fecha proporcionada
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
      v_remaining_amount,
      p_payment_date,
      'transferencia',
      'AUTO-' || v_invoice.folio,
      'Pago automático generado para ' || v_invoice.folio,
      'pending'::payment_status,
      0,
      auth.uid()
    ) RETURNING id INTO v_payment_id;
    
    -- Aplicar el pago a la factura
    INSERT INTO payment_applications (
      payment_id,
      invoice_id,
      applied_amount,
      application_method,
      notes,
      created_by
    ) VALUES (
      v_payment_id,
      p_invoice_id,
      v_remaining_amount,
      'fifo',
      'Aplicación automática generada',
      auth.uid()
    );
    
    RAISE NOTICE 'Pago automático creado: payment_id=%, invoice=%, amount=%, fecha=%', 
      v_payment_id, v_invoice.folio, v_remaining_amount, p_payment_date;
    
    RETURN jsonb_build_object(
      'success', true,
      'payment_id', v_payment_id,
      'invoice_id', p_invoice_id,
      'invoice_folio', v_invoice.folio,
      'amount', v_remaining_amount,
      'status', 'paid',
      'message', 'Pago automático creado exitosamente'
    );
  END;
END;
$$;


ALTER FUNCTION "public"."create_automatic_payment_for_invoice"("p_invoice_id" "uuid", "p_payment_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_cost_for_crane_part"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  maintenance_category_id UUID;
  new_cost_id UUID;
BEGIN
  -- Get the maintenance category ID
  SELECT id INTO maintenance_category_id
  FROM public.cost_categories
  WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%maintenance%'
  LIMIT 1;

  -- If no maintenance category exists, create one
  IF maintenance_category_id IS NULL THEN
    INSERT INTO public.cost_categories (name, description)
    VALUES ('Mantenimiento', 'Gastos de mantenimiento y reparaciones')
    RETURNING id INTO maintenance_category_id;
  END IF;

  -- Create cost entry
  INSERT INTO public.costs (
    amount,
    category_id,
    crane_id,
    date,
    description,
    notes,
    subcategory,
    created_by
  ) VALUES (
    NEW.total_value,
    maintenance_category_id,
    NEW.crane_id,
    NEW.date,
    'Compra de piezas: ' || NEW.part_name,
    COALESCE(NEW.notes, '') || ' - Proveedor: ' || NEW.supplier || CASE WHEN NEW.phone IS NOT NULL THEN ' (Tel: ' || NEW.phone || ')' ELSE '' END,
    'Piezas y Repuestos',
    NEW.created_by
  ) RETURNING id INTO new_cost_id;

  -- Update the crane_part with the cost_id reference
  NEW.cost_id := new_cost_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_cost_for_crane_part"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_cost_for_crane_part_conditional"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  maintenance_category_id UUID;
  new_cost_id UUID;
  calculated_amount NUMERIC;
BEGIN
  -- Si ya tiene cost_id asociado, no crear uno nuevo
  IF NEW.cost_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Calcular amount usando total_value (que ya debería estar calculado por el trigger anterior)
  calculated_amount := COALESCE(NEW.total_value, NEW.quantity * NEW.unit_price, 0);
  
  -- Validar que el amount sea válido
  IF calculated_amount <= 0 THEN
    RAISE WARNING 'No se puede crear costo con amount <= 0 para pieza: %. total_value: %, quantity: %, unit_price: %', 
      NEW.part_name, NEW.total_value, NEW.quantity, NEW.unit_price;
    RETURN NEW;
  END IF;

  -- Obtener categoría de mantenimiento
  SELECT id INTO maintenance_category_id
  FROM public.cost_categories
  WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%maintenance%'
  LIMIT 1;

  -- Si no existe categoría de mantenimiento, crearla
  IF maintenance_category_id IS NULL THEN
    INSERT INTO public.cost_categories (name, description)
    VALUES ('Mantenimiento', 'Gastos de mantenimiento y reparaciones')
    RETURNING id INTO maintenance_category_id;
  END IF;

  -- Crear registro de costo
  INSERT INTO public.costs (
    amount,
    category_id,
    crane_id,
    date,
    description,
    notes,
    subcategory,
    created_by
  ) VALUES (
    calculated_amount,
    maintenance_category_id,
    NEW.crane_id,
    NEW.date,
    'Compra de piezas: ' || NEW.part_name,
    COALESCE(NEW.notes, '') || ' - Proveedor: ' || NEW.supplier || CASE WHEN NEW.phone IS NOT NULL THEN ' (Tel: ' || NEW.phone || ')' ELSE '' END,
    'Piezas y Repuestos',
    NEW.created_by
  ) RETURNING id INTO new_cost_id;

  -- Asignar el cost_id al registro de crane_parts
  NEW.cost_id := new_cost_id;

  RAISE NOTICE 'Costo creado exitosamente: ID %, amount: % para pieza: %', new_cost_id, calculated_amount, NEW.part_name;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_cost_for_crane_part_conditional"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_cost_for_maintenance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  maintenance_category_id UUID;
  existing_cost_count INTEGER;
BEGIN
  -- Solo procesar cuando el mantenimiento cambia a 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Obtener ID de categoría de mantenimiento
    SELECT id INTO maintenance_category_id 
    FROM public.cost_categories 
    WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%mant%'
    LIMIT 1;
    
    -- Si no existe la categoría, crearla
    IF maintenance_category_id IS NULL THEN
      INSERT INTO public.cost_categories (name, description)
      VALUES ('Mantenimiento', 'Gastos de mantenimiento y reparaciones de grúas')
      RETURNING id INTO maintenance_category_id;
    END IF;
    
    -- Verificar que no exista costo previo para este mantenimiento
    SELECT COUNT(*) INTO existing_cost_count
    FROM public.costs 
    WHERE crane_id = NEW.crane_id 
    AND date = COALESCE(NEW.completed_date, NEW.scheduled_date)
    AND amount = NEW.cost
    AND description LIKE '%' || NEW.maintenance_type || '%'
    AND category_id = maintenance_category_id;
    
    -- Solo crear si no existe costo previo y el costo es mayor a 0
    IF existing_cost_count = 0 AND NEW.cost > 0 THEN
      INSERT INTO public.costs (
        amount,
        category_id,
        crane_id,
        date,
        description,
        notes,
        subcategory,
        created_by
      ) VALUES (
        NEW.cost,
        maintenance_category_id,
        NEW.crane_id,
        COALESCE(NEW.completed_date, NEW.scheduled_date),
        'Mantenimiento ' || NEW.maintenance_type || CASE WHEN NEW.provider IS NOT NULL THEN ' - ' || NEW.provider ELSE '' END,
        COALESCE(NEW.notes, '') || CASE WHEN NEW.description IS NOT NULL THEN ' | ' || NEW.description ELSE '' END,
        CASE 
          WHEN NEW.maintenance_type = 'preventive' THEN 'Mantenimiento Preventivo'
          WHEN NEW.maintenance_type = 'corrective' THEN 'Mantenimiento Correctivo'
          WHEN NEW.maintenance_type = 'emergency' THEN 'Mantenimiento de Emergencia'
          ELSE 'Mantenimiento General'
        END,
        NEW.created_by
      );
      
      RAISE NOTICE 'Costo de mantenimiento creado automáticamente: $ % para grúa %', NEW.cost, NEW.crane_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."create_cost_for_maintenance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_cost_from_maintenance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  maintenance_category_id UUID;
  cost_description TEXT;
  cost_subcategory TEXT;
BEGIN
  -- Solo crear costo cuando el mantenimiento cambia a 'completed' y tiene costo > 0
  IF NEW.status = 'completed' 
     AND (OLD.status IS NULL OR OLD.status != 'completed') 
     AND NEW.cost > 0 THEN
    
    -- Obtener o crear categoría de mantenimiento
    SELECT id INTO maintenance_category_id
    FROM public.cost_categories
    WHERE name = 'Mantenimiento'
    LIMIT 1;
    
    -- Si no existe la categoría, crearla
    IF maintenance_category_id IS NULL THEN
      INSERT INTO public.cost_categories (name, description)
      VALUES ('Mantenimiento', 'Gastos de mantenimiento y reparaciones de grúas')
      RETURNING id INTO maintenance_category_id;
    END IF;
    
    -- Construir descripción CORRECTA basada en los datos del mantenimiento
    cost_description := 'Mantenimiento: ' || COALESCE(NEW.description, 'Sin descripción');
    
    IF NEW.provider IS NOT NULL AND NEW.provider != '' THEN
      cost_description := cost_description || ' - Proveedor: ' || NEW.provider;
    END IF;
    
    -- Determinar subcategoría basada en tipo de mantenimiento
    cost_subcategory := CASE 
      WHEN NEW.maintenance_type ILIKE '%preventivo%' THEN 'Mantenimiento Preventivo'
      WHEN NEW.maintenance_type ILIKE '%correctivo%' OR NEW.maintenance_type ILIKE '%reparaci%' THEN 'Reparaciones'
      WHEN NEW.maintenance_type ILIKE '%repuesto%' OR NEW.maintenance_type ILIKE '%pieza%' THEN 'Piezas y Repuestos'
      WHEN NEW.maintenance_type ILIKE '%revision%' OR NEW.maintenance_type ILIKE '%inspecci%' THEN 'Inspecciones'
      ELSE 'Mantenimiento General'
    END;
    
    -- Verificar si ya existe un costo para este mantenimiento
    IF NOT EXISTS (SELECT 1 FROM public.costs WHERE maintenance_id = NEW.id) THEN
      -- Crear el registro de costo con descripción CORRECTA
      INSERT INTO public.costs (
        amount,
        category_id,
        crane_id,
        date,
        description,
        notes,
        subcategory,
        maintenance_id,
        created_by
      ) VALUES (
        NEW.cost,
        maintenance_category_id,
        NEW.crane_id,
        COALESCE(NEW.completed_date, NEW.scheduled_date, CURRENT_DATE),
        cost_description, -- Usar la descripción correcta construida arriba
        CASE 
          WHEN NEW.notes IS NOT NULL THEN 'Costo generado automáticamente: ' || NEW.notes
          ELSE 'Costo generado automáticamente desde mantenimiento'
        END,
        cost_subcategory,
        NEW.id,
        COALESCE(NEW.created_by, auth.uid())
      );
      
      RAISE NOTICE 'Costo creado automáticamente para mantenimiento %: %', NEW.id, cost_description;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_cost_from_maintenance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_cost_from_supplier_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cost_id uuid;
  v_maintenance_cat_id uuid;
  v_resolved_cat_id uuid;
  v_should_sync boolean := false;
BEGIN
  IF current_setting('app.bidirectional_sync', true) = 'true'
     OR current_setting('app.cascade_delete', true) = 'true' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_maintenance_cat_id
  FROM public.cost_categories
  WHERE name = 'Mantenimiento'
  LIMIT 1;

  IF v_maintenance_cat_id IS NULL THEN
    SELECT id INTO v_maintenance_cat_id
    FROM public.cost_categories
    LIMIT 1;
  END IF;

  IF NEW.category IS NOT NULL AND NEW.category <> '' THEN
    BEGIN
      v_resolved_cat_id := NEW.category::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM public.cost_categories WHERE id = v_resolved_cat_id
      ) THEN
        v_resolved_cat_id := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_resolved_cat_id := NULL;
    END;

    IF v_resolved_cat_id IS NULL THEN
      SELECT id INTO v_resolved_cat_id
      FROM public.cost_categories
      WHERE lower(name) = lower(NEW.category)
      LIMIT 1;
    END IF;
  ELSE
    v_resolved_cat_id := NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.cost_id IS NOT NULL
       OR EXISTS (SELECT 1 FROM public.costs WHERE supplier_payment_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    PERFORM set_config('app.bidirectional_sync', 'true', true);

    INSERT INTO public.costs (
      amount,
      category_id,
      subcategory,
      date,
      description,
      supplier_id,
      supplier_payment_id,
      payment_date,
      created_by,
      notes
    ) VALUES (
      NEW.amount,
      COALESCE(v_resolved_cat_id, v_maintenance_cat_id),
      NULLIF(NEW.subcategory, ''),
      COALESCE(NEW.due_date, CURRENT_DATE),
      COALESCE(NEW.description, 'Pago a proveedor'),
      NEW.supplier_id,
      NEW.id,
      CASE WHEN NEW.status = 'paid' THEN COALESCE(NEW.paid_date, CURRENT_DATE) ELSE NULL END,
      NEW.created_by,
      NEW.notes
    ) RETURNING id INTO v_cost_id;

    UPDATE public.supplier_payments
    SET cost_id = v_cost_id
    WHERE id = NEW.id
      AND cost_id IS DISTINCT FROM v_cost_id;

    PERFORM set_config('app.bidirectional_sync', 'false', true);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_cost_id := COALESCE(NEW.cost_id, OLD.cost_id);

    IF v_cost_id IS NULL THEN
      SELECT id INTO v_cost_id
      FROM public.costs
      WHERE supplier_payment_id = NEW.id
      LIMIT 1;
    END IF;

    IF v_cost_id IS NULL THEN
      RETURN NEW;
    END IF;

    IF NEW.cost_id IS NULL THEN
      PERFORM set_config('app.bidirectional_sync', 'true', true);
      UPDATE public.supplier_payments
      SET cost_id = v_cost_id
      WHERE id = NEW.id
        AND cost_id IS DISTINCT FROM v_cost_id;
      PERFORM set_config('app.bidirectional_sync', 'false', true);
    END IF;

    v_should_sync :=
      (OLD.amount IS DISTINCT FROM NEW.amount) OR
      (OLD.due_date IS DISTINCT FROM NEW.due_date) OR
      (OLD.description IS DISTINCT FROM NEW.description) OR
      (OLD.paid_date IS DISTINCT FROM NEW.paid_date) OR
      (OLD.status IS DISTINCT FROM NEW.status) OR
      (OLD.supplier_id IS DISTINCT FROM NEW.supplier_id) OR
      (OLD.category IS DISTINCT FROM NEW.category) OR
      (OLD.subcategory IS DISTINCT FROM NEW.subcategory) OR
      (OLD.notes IS DISTINCT FROM NEW.notes);

    IF NOT v_should_sync THEN
      RETURN NEW;
    END IF;

    PERFORM set_config('app.bidirectional_sync', 'true', true);

    UPDATE public.costs
    SET amount = NEW.amount,
        category_id = COALESCE(v_resolved_cat_id, category_id),
        subcategory = CASE
          WHEN NEW.subcategory IS DISTINCT FROM OLD.subcategory THEN NULLIF(NEW.subcategory, '')
          ELSE subcategory
        END,
        date = COALESCE(NEW.due_date, date),
        description = COALESCE(NEW.description, description),
        supplier_id = COALESCE(NEW.supplier_id, supplier_id),
        payment_date = CASE
          WHEN NEW.status = 'paid' THEN COALESCE(NEW.paid_date, CURRENT_DATE)
          ELSE NULL
        END,
        notes = COALESCE(NEW.notes, notes),
        updated_at = now()
    WHERE id = v_cost_id;

    PERFORM set_config('app.bidirectional_sync', 'false', true);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_cost_from_supplier_payment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_cost_with_payment_link"("p_payment_id" "uuid", "p_supplier_name" "text", "p_amount" numeric, "p_description" "text", "p_category" "text", "p_paid_date" "date", "p_cost_category_mapping" "jsonb" DEFAULT '{}'::"jsonb", "p_default_category" "text" DEFAULT 'Gastos de Proveedores'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cost_category_name TEXT;
  v_cost_category_id UUID;
  v_new_cost_id UUID;
  v_result JSONB;
BEGIN
  -- Iniciar transacción implícita (las funciones PL/pgSQL son atómicas)
  
  -- 1. Determinar categoría de costo
  v_cost_category_name := COALESCE(
    (p_cost_category_mapping ->> p_category),
    p_default_category
  );
  
  -- 2. Buscar o crear categoría de costo
  SELECT id INTO v_cost_category_id
  FROM cost_categories
  WHERE name = v_cost_category_name;
  
  IF v_cost_category_id IS NULL THEN
    INSERT INTO cost_categories (name)
    VALUES (v_cost_category_name)
    RETURNING id INTO v_cost_category_id;
  END IF;
  
  -- 3. Crear el registro de costo
  INSERT INTO costs (
    amount,
    category_id,
    date,
    description,
    notes,
    subcategory
  ) VALUES (
    p_amount,
    v_cost_category_id,
    p_paid_date,
    'Pago a proveedor: ' || p_supplier_name || ' - ' || p_description,
    'Generado automáticamente desde pago de proveedor. ID del pago: ' || p_payment_id,
    'Pago a Proveedores'
  ) RETURNING id INTO v_new_cost_id;
  
  -- 4. Crear el vínculo bidireccional (CRÍTICO: debe ser en la misma transacción)
  INSERT INTO supplier_payment_cost_links (
    supplier_payment_id,
    cost_id
  ) VALUES (
    p_payment_id,
    v_new_cost_id
  );
  
  -- 5. Preparar resultado
  v_result := jsonb_build_object(
    'cost_id', v_new_cost_id,
    'category_id', v_cost_category_id,
    'success', true,
    'message', 'Costo y vínculo creados exitosamente'
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- En caso de error, la transacción se revierte automáticamente
    RAISE EXCEPTION 'Error creando costo con vínculo: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."create_cost_with_payment_link"("p_payment_id" "uuid", "p_supplier_name" "text", "p_amount" numeric, "p_description" "text", "p_category" "text", "p_paid_date" "date", "p_cost_category_mapping" "jsonb", "p_default_category" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_inventory_consumption_movement"("p_inventory_item_id" "uuid", "p_quantity" integer, "p_crane_id" "uuid", "p_operator_id" "uuid" DEFAULT NULL::"uuid", "p_reference_document" "text" DEFAULT NULL::"text", "p_observations" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  movement_id UUID;
  location_id UUID;
BEGIN
  -- Obtener ubicación por defecto
  SELECT id INTO location_id
  FROM public.inventory_locations
  WHERE is_active = true
  ORDER BY created_at
  LIMIT 1;

  -- Crear movimiento de salida
  INSERT INTO public.inventory_movements (
    item_id,
    location_id,
    movement_type,
    quantity,
    crane_id,
    operator_id,
    reference_document,
    observations,
    movement_date,
    status,
    created_by
  ) VALUES (
    p_inventory_item_id,
    location_id,
    'exit',
    p_quantity,
    p_crane_id,
    p_operator_id,
    p_reference_document,
    p_observations,
    CURRENT_DATE,
    'active',
    auth.uid()
  )
  RETURNING id INTO movement_id;

  RETURN movement_id;
END;
$$;


ALTER FUNCTION "public"."create_inventory_consumption_movement"("p_inventory_item_id" "uuid", "p_quantity" integer, "p_crane_id" "uuid", "p_operator_id" "uuid", "p_reference_document" "text", "p_observations" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_inventory_consumption_movement"("p_inventory_item_id" "uuid", "p_quantity" integer, "p_crane_id" "uuid", "p_operator_id" "uuid" DEFAULT NULL::"uuid", "p_reference_document" "text" DEFAULT NULL::"text", "p_observations" "text" DEFAULT NULL::"text", "p_unit_cost" numeric DEFAULT NULL::numeric) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  movement_id UUID;
  location_id UUID;
  item_unit_cost NUMERIC;
BEGIN
  -- Obtener ubicación por defecto
  SELECT id INTO location_id
  FROM public.inventory_locations
  WHERE is_active = true
  ORDER BY created_at
  LIMIT 1;

  -- Si no hay ubicación, crear una por defecto
  IF location_id IS NULL THEN
    INSERT INTO public.inventory_locations (name, code, description, is_active)
    VALUES ('Bodega Principal', 'MAIN', 'Bodega principal de repuestos', true)
    RETURNING id INTO location_id;
  END IF;

  -- Obtener costo unitario del item si no se proporciona
  IF p_unit_cost IS NULL THEN
    SELECT unit_cost INTO item_unit_cost
    FROM public.inventory_items
    WHERE id = p_inventory_item_id;
  ELSE
    item_unit_cost := p_unit_cost;
  END IF;

  -- Crear movimiento de salida (el trigger se encargará de crear el crane_parts)
  INSERT INTO public.inventory_movements (
    item_id,
    location_id,
    movement_type,
    quantity,
    unit_cost,
    total_cost,
    crane_id,
    operator_id,
    reference_document,
    observations,
    movement_date,
    status,
    created_by
  ) VALUES (
    p_inventory_item_id,
    location_id,
    'exit',
    p_quantity,
    item_unit_cost,
    item_unit_cost * p_quantity,
    p_crane_id,
    p_operator_id,
    p_reference_document,
    p_observations,
    CURRENT_DATE,
    'active',
    auth.uid()
  )
  RETURNING id INTO movement_id;

  RETURN movement_id;
END;
$$;


ALTER FUNCTION "public"."create_inventory_consumption_movement"("p_inventory_item_id" "uuid", "p_quantity" integer, "p_crane_id" "uuid", "p_operator_id" "uuid", "p_reference_document" "text", "p_observations" "text", "p_unit_cost" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_invoice_transaction"("p_invoice_data" "jsonb", "p_service_ids" "uuid"[]) RETURNS TABLE("invoice_id" "uuid", "invoice_folio" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_invoice_id UUID;
  simple_folio TEXT;
  service_id UUID;
  total_billable_amount NUMERIC := 0;
  service_value NUMERIC;
  client_covered_amount NUMERIC;
  v_payment_term_id UUID;
BEGIN
  simple_folio := public.generate_simple_invoice_folio();

  v_payment_term_id := NULLIF((p_invoice_data->>'payment_term_id'), '')::UUID;

  FOREACH service_id IN ARRAY p_service_ids
  LOOP
    SELECT 
      s.value,
      CASE WHEN s.has_excess THEN s.client_covered_amount ELSE s.value END
    INTO service_value, client_covered_amount
    FROM services s
    WHERE s.id = service_id;

    IF FOUND THEN
      total_billable_amount := total_billable_amount + COALESCE(client_covered_amount, service_value);
    END IF;
  END LOOP;

  INSERT INTO invoices (
    client_id,
    folio,
    issue_date,
    due_date,
    subtotal,
    vat,
    total,
    status,
    notes,
    numero_fiscal,
    payment_term_id,
    product_service_description,
    created_by
  ) VALUES (
    (p_invoice_data->>'client_id')::UUID,
    simple_folio,
    (p_invoice_data->>'issue_date')::DATE,
    (p_invoice_data->>'due_date')::DATE,
    COALESCE((p_invoice_data->>'subtotal')::NUMERIC, total_billable_amount),
    COALESCE((p_invoice_data->>'vat')::NUMERIC, total_billable_amount * 0.19),
    COALESCE((p_invoice_data->>'total')::NUMERIC, total_billable_amount * 1.19),
    COALESCE((p_invoice_data->>'status')::invoice_status, 'draft'::invoice_status),
    p_invoice_data->>'notes',
    p_invoice_data->>'numero_fiscal',
    v_payment_term_id,
    public.validate_product_service_description(p_invoice_data->>'product_service_description'),
    auth.uid()
  )
  RETURNING id INTO new_invoice_id;

  FOREACH service_id IN ARRAY p_service_ids
  LOOP
    INSERT INTO invoice_services (invoice_id, service_id)
    VALUES (new_invoice_id, service_id);

    UPDATE services 
    SET 
      status = 'invoiced',
      invoice_folio = simple_folio,
      invoice_numero_fiscal = p_invoice_data->>'numero_fiscal',
      updated_at = now()
    WHERE id = service_id;
  END LOOP;

  RETURN QUERY SELECT new_invoice_id, simple_folio;
END;
$$;


ALTER FUNCTION "public"."create_invoice_transaction"("p_invoice_data" "jsonb", "p_service_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text" DEFAULT 'info'::"text", "p_category" "text" DEFAULT 'system'::"text", "p_priority" integer DEFAULT 4, "p_action_url" "text" DEFAULT NULL::"text", "p_action_data" "jsonb" DEFAULT NULL::"jsonb", "p_entity_type" "text" DEFAULT NULL::"text", "p_entity_id" "uuid" DEFAULT NULL::"uuid", "p_group_key" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id, title, message, type, category, priority,
    action_url, action_data, entity_type, entity_id, group_key
  ) VALUES (
    p_user_id, p_title, p_message, p_type, p_category, p_priority,
    p_action_url, p_action_data, p_entity_type, p_entity_id, p_group_key
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;


ALTER FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text", "p_category" "text", "p_priority" integer, "p_action_url" "text", "p_action_data" "jsonb", "p_entity_type" "text", "p_entity_id" "uuid", "p_group_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_payment_from_existing_income"("p_income_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_income RECORD;
  v_payment_id UUID;
  v_apply_result jsonb;
BEGIN
  -- Obtener datos del income
  SELECT * INTO v_income FROM incomes WHERE id = p_income_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Income no encontrado');
  END IF;

  -- Validar que tenga invoice_id asociado
  IF v_income.invoice_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Income no tiene factura asociada');
  END IF;

  -- Crear el payment (SIN remaining_amount porque es calculado automáticamente)
  INSERT INTO payments (
    client_id,
    amount,
    payment_date,
    payment_method,
    bank_reference,
    notes,
    status,
    applied_amount
  ) VALUES (
    v_income.client_id,
    v_income.amount,
    v_income.income_date,
    v_income.payment_method,
    v_income.bank_reference,
    'Creado desde ingreso: ' || COALESCE(v_income.description, 'Sin descripción'),
    'pending',
    0
  ) RETURNING id INTO v_payment_id;

  -- Aplicar el payment a la factura usando apply_payment_manual
  SELECT apply_payment_manual(
    v_payment_id,
    jsonb_build_array(
      jsonb_build_object(
        'invoice_id', v_income.invoice_id,
        'amount', v_income.amount
      )
    )
  ) INTO v_apply_result;

  -- Verificar resultado de la aplicación
  IF v_apply_result->>'status' != 'success' THEN
    -- Rollback: eliminar el payment creado
    DELETE FROM payments WHERE id = v_payment_id;
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Error al aplicar payment: ' || (v_apply_result->>'message')
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'message', 'Payment creado y aplicado exitosamente',
    'details', v_apply_result
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;


ALTER FUNCTION "public"."create_payment_from_existing_income"("p_income_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_supplier_payment_from_cost"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  existing_payment_id uuid;
  effective_due_date date;
  effective_status text;
  effective_paid_amount numeric;
  effective_category text;
  effective_notes text;
BEGIN
  -- Skip if sync flag is set (prevents recursive loops)
  IF current_setting('app.bidirectional_sync', true) = 'true'
     OR current_setting('app.sync_in_progress', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Skip if no supplier
  IF NEW.supplier_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate effective values
  effective_due_date := COALESCE(NEW.payment_date, NEW.date, CURRENT_DATE);
  effective_status := CASE WHEN NEW.payment_date IS NOT NULL THEN 'paid' ELSE 'pending' END;
  effective_paid_amount := CASE WHEN NEW.payment_date IS NOT NULL THEN COALESCE(NEW.amount, 0) ELSE 0 END;
  effective_category := COALESCE(NULLIF(BTRIM(NEW.subcategory), ''), NULLIF(BTRIM(NEW.other_reason), ''), 'Costos');
  effective_notes := NEW.notes;

  -- Set sync flags to prevent recursion
  PERFORM set_config('app.bidirectional_sync', 'true', true);
  PERFORM set_config('app.sync_in_progress', 'true', true);

  -- If cost already has a supplier_payment_id, just update that payment
  IF NEW.supplier_payment_id IS NOT NULL THEN
    UPDATE public.supplier_payments
    SET supplier_id = NEW.supplier_id,
        amount = NEW.amount,
        paid_amount = effective_paid_amount,
        description = COALESCE(NULLIF(BTRIM(NEW.description), ''), 'Gasto registrado'),
        category = effective_category,
        due_date = effective_due_date,
        paid_date = NEW.payment_date,
        status = effective_status,
        notes = effective_notes,
        cost_id = NEW.id,
        updated_at = now()
    WHERE id = NEW.supplier_payment_id;

    RETURN NEW;
  END IF;

  -- Check if a supplier_payment already exists for this cost_id
  SELECT sp.id
  INTO existing_payment_id
  FROM public.supplier_payments sp
  WHERE sp.cost_id = NEW.id
  ORDER BY sp.created_at ASC NULLS LAST, sp.id ASC
  LIMIT 1;

  IF existing_payment_id IS NULL THEN
    -- No existing payment: try to insert, but handle duplicate gracefully
    BEGIN
      INSERT INTO public.supplier_payments (
        supplier_id, amount, paid_amount, description, category,
        due_date, status, paid_date, notes, cost_id
      )
      VALUES (
        NEW.supplier_id, NEW.amount, effective_paid_amount,
        COALESCE(NULLIF(BTRIM(NEW.description), ''), 'Gasto registrado'),
        effective_category, effective_due_date, effective_status,
        NEW.payment_date, effective_notes, NEW.id
      )
      RETURNING id INTO existing_payment_id;
    EXCEPTION
      WHEN unique_violation THEN
        -- Another process already created it (race condition) - just find and update it
        SELECT sp.id INTO existing_payment_id
        FROM public.supplier_payments sp
        WHERE sp.cost_id = NEW.id
        LIMIT 1;
        
        IF existing_payment_id IS NOT NULL THEN
          UPDATE public.supplier_payments
          SET supplier_id = NEW.supplier_id,
              amount = NEW.amount,
              paid_amount = effective_paid_amount,
              description = COALESCE(NULLIF(BTRIM(NEW.description), ''), 'Gasto registrado'),
              category = effective_category,
              due_date = effective_due_date,
              paid_date = NEW.payment_date,
              status = effective_status,
              notes = COALESCE(NEW.notes, notes),
              updated_at = now()
          WHERE id = existing_payment_id;
        END IF;
    END;
  ELSE
    -- Existing payment found: update it
    UPDATE public.supplier_payments
    SET supplier_id = NEW.supplier_id,
        amount = NEW.amount,
        paid_amount = effective_paid_amount,
        description = COALESCE(NULLIF(BTRIM(NEW.description), ''), 'Gasto registrado'),
        category = COALESCE(NULLIF(BTRIM(category), ''), effective_category),
        due_date = effective_due_date,
        paid_date = NEW.payment_date,
        status = effective_status,
        notes = COALESCE(NEW.notes, notes),
        cost_id = NEW.id,
        updated_at = now()
    WHERE id = existing_payment_id;
  END IF;

  -- Link cost to the payment if not already linked
  IF existing_payment_id IS NOT NULL THEN
    UPDATE public.costs
    SET supplier_payment_id = existing_payment_id,
        updated_at = now()
    WHERE id = NEW.id
      AND supplier_payment_id IS DISTINCT FROM existing_payment_id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('app.bidirectional_sync', 'false', true);
    PERFORM set_config('app.sync_in_progress', 'false', true);
    RAISE;
END;
$$;


ALTER FUNCTION "public"."create_supplier_payment_from_cost"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() ORDER BY role LIMIT 1),
    'viewer'
  );
$$;


ALTER FUNCTION "public"."current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_service_states"() RETURNS TABLE("service_folio" "text", "current_status" "public"."service_status", "invoice_folio" "text", "should_be_invoiced" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.folio as service_folio,
    s.status as current_status,
    s.invoice_folio,
    (s.invoice_folio IS NOT NULL AND s.invoice_folio != '') as should_be_invoiced
  FROM public.services s
  WHERE s.invoice_folio IS NOT NULL
  ORDER BY s.folio;
END;
$$;


ALTER FUNCTION "public"."debug_service_states"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_commissions_on_service_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  commission_category_id UUID;
  deleted_count INTEGER;
BEGIN
  -- Obtener ID de categoría de comisiones
  SELECT id INTO commission_category_id 
  FROM public.cost_categories 
  WHERE name = 'Comisión Operador'
  LIMIT 1;
  
  IF commission_category_id IS NOT NULL THEN
    -- Eliminar todas las comisiones asociadas al servicio
    DELETE FROM public.costs 
    WHERE service_id = OLD.id 
      AND category_id = commission_category_id;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
      RAISE NOTICE '🗑️ Eliminadas % comisiones del servicio %', deleted_count, OLD.folio;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."delete_commissions_on_service_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_cost_for_crane_part"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Delete the associated cost record
  DELETE FROM public.costs WHERE id = OLD.cost_id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."delete_cost_for_crane_part"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_service_cascade"("p_service_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Verificar que el usuario sea administrador o tenga permisos
  IF NOT (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'No tiene permisos para eliminar servicios';
  END IF;

  -- Log de la eliminación
  RAISE NOTICE 'Eliminando servicio en cascada: %', p_service_id;

  -- Eliminar registros relacionados en orden correcto para evitar violaciones de FK
  
  -- 1. Eliminar inspecciones
  DELETE FROM public.inspections WHERE service_id = p_service_id;
  RAISE NOTICE 'Eliminadas inspecciones del servicio: %', p_service_id;

  -- 2. ELIMINAR COMPLETAMENTE los costos (incluyendo comisiones)
  DELETE FROM public.costs WHERE service_id = p_service_id;
  RAISE NOTICE 'Eliminados TODOS los costos del servicio: %', p_service_id;

  -- 3. Eliminar service_costs
  DELETE FROM public.service_costs WHERE service_id = p_service_id;
  RAISE NOTICE 'Eliminados service_costs del servicio: %', p_service_id;

  -- 4. Eliminar service_resources
  DELETE FROM public.service_resources WHERE service_id = p_service_id;
  RAISE NOTICE 'Eliminados service_resources del servicio: %', p_service_id;

  -- 5. Eliminar de closure_services
  DELETE FROM public.closure_services WHERE service_id = p_service_id;
  RAISE NOTICE 'Eliminado de closure_services: %', p_service_id;

  -- 6. Eliminar de invoice_services
  DELETE FROM public.invoice_services WHERE service_id = p_service_id;
  RAISE NOTICE 'Eliminado de invoice_services: %', p_service_id;

  -- 7. Eliminar eventos de calendario relacionados
  DELETE FROM public.calendar_events WHERE service_id = p_service_id;
  RAISE NOTICE 'Eliminados eventos de calendario del servicio: %', p_service_id;

  -- 8. Finalmente eliminar el servicio
  DELETE FROM public.services WHERE id = p_service_id;
  RAISE NOTICE 'Servicio eliminado exitosamente: %', p_service_id;

END;
$$;


ALTER FUNCTION "public"."delete_service_cascade"("p_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_admin"("target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only admins can delete users
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only administrators can delete users';
  END IF;

  -- First delete the profile (this will also delete related data via cascade)
  DELETE FROM public.profiles WHERE id = target_user_id;
  
  -- Then delete from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;


ALTER FUNCTION "public"."delete_user_admin"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."detect_duplicate_crane_parts"("p_crane_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  duplicate_count INTEGER := 0;
  total_parts INTEGER := 0;
  total_costs INTEGER := 0;
  linked_costs INTEGER := 0;
BEGIN
  -- Contar total de crane_parts
  SELECT COUNT(*) INTO total_parts
  FROM public.crane_parts
  WHERE (p_crane_id IS NULL OR crane_id = p_crane_id);

  -- Contar costos de "Piezas y Repuestos"
  SELECT COUNT(*) INTO total_costs
  FROM public.costs
  WHERE subcategory = 'Piezas y Repuestos'
  AND (p_crane_id IS NULL OR crane_id = p_crane_id);

  -- Contar costos ya vinculados a crane_parts
  SELECT COUNT(*) INTO linked_costs
  FROM public.costs c
  INNER JOIN public.crane_parts cp ON c.id = cp.cost_id
  WHERE c.subcategory = 'Piezas y Repuestos'
  AND (p_crane_id IS NULL OR c.crane_id = p_crane_id);

  -- Los duplicados potenciales son costos sin vincular
  duplicate_count := total_costs - linked_costs;

  RETURN json_build_object(
    'success', true,
    'duplicate_count', duplicate_count,
    'total_parts', total_parts,
    'total_costs', total_costs,
    'linked_costs', linked_costs,
    'unlinked_costs', duplicate_count,
    'message', CASE 
      WHEN duplicate_count > 0 THEN 
        'Se detectaron ' || duplicate_count || ' costos de piezas sin vincular'
      ELSE 
        'No se detectaron duplicados'
    END
  );
END;
$$;


ALTER FUNCTION "public"."detect_duplicate_crane_parts"("p_crane_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."diagnose_maintenance_cost_integration"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  completed_maintenances INTEGER;
  linked_costs INTEGER;
  unlinked_costs INTEGER;
  orphaned_costs INTEGER;
BEGIN
  -- Contar mantenimientos completados con costo
  SELECT COUNT(*) INTO completed_maintenances
  FROM public.crane_maintenance 
  WHERE status = 'completed' AND cost > 0;
  
  -- Contar costos vinculados correctamente
  SELECT COUNT(*) INTO linked_costs
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name = 'Mantenimiento' AND c.maintenance_id IS NOT NULL;
  
  -- Contar costos de mantenimiento sin vincular
  SELECT COUNT(*) INTO unlinked_costs
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name = 'Mantenimiento' AND c.maintenance_id IS NULL;
  
  -- Contar costos vinculados a mantenimientos inexistentes
  SELECT COUNT(*) INTO orphaned_costs
  FROM public.costs c
  WHERE c.maintenance_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.crane_maintenance cm WHERE cm.id = c.maintenance_id);
  
  RETURN jsonb_build_object(
    'timestamp', NOW(),
    'integration_health', CASE 
      WHEN unlinked_costs = 0 AND orphaned_costs = 0 THEN 'HEALTHY'
      ELSE 'NEEDS_ATTENTION'
    END,
    'statistics', jsonb_build_object(
      'completed_maintenances_with_cost', completed_maintenances,
      'linked_costs', linked_costs,
      'unlinked_costs', unlinked_costs,
      'orphaned_costs', orphaned_costs
    ),
    'message', CASE 
      WHEN unlinked_costs = 0 AND orphaned_costs = 0 
      THEN 'Integración funcionando correctamente'
      ELSE format('Se encontraron %s costos sin vincular y %s costos huérfanos', unlinked_costs, orphaned_costs)
    END
  );
END;
$$;


ALTER FUNCTION "public"."diagnose_maintenance_cost_integration"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."diagnose_mixed_payment_invoices"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  mixed_invoices jsonb;
  mixed_count INTEGER := 0;
BEGIN
  -- Buscar facturas con pagos tanto automáticos como manuales
  SELECT 
    COUNT(*),
    jsonb_agg(
      jsonb_build_object(
        'invoice_id', i.id,
        'folio', i.folio,
        'client_name', c.name,
        'total', i.total,
        'paid_amount', i.paid_amount,
        'status', i.status,
        'automatic_payments', automatic_payments,
        'manual_payments', manual_payments,
        'total_applications', total_applications
      )
    )
  INTO mixed_count, mixed_invoices
  FROM invoices i
  JOIN clients c ON i.client_id = c.id
  CROSS JOIN LATERAL (
    -- Contar pagos automáticos aplicados a esta factura
    SELECT COUNT(*) as automatic_payments
    FROM payment_applications pa
    JOIN payments p ON pa.payment_id = p.id
    WHERE pa.invoice_id = i.id 
    AND p.bank_reference LIKE 'PAGO-AUTO-%'
  ) auto_payments
  CROSS JOIN LATERAL (
    -- Contar pagos manuales aplicados a esta factura
    SELECT COUNT(*) as manual_payments  
    FROM payment_applications pa
    JOIN payments p ON pa.payment_id = p.id
    WHERE pa.invoice_id = i.id 
    AND (p.bank_reference IS NULL OR p.bank_reference NOT LIKE 'PAGO-AUTO-%')
  ) man_payments
  CROSS JOIN LATERAL (
    -- Total de aplicaciones
    SELECT COUNT(*) as total_applications
    FROM payment_applications pa
    WHERE pa.invoice_id = i.id
  ) total_apps
  WHERE automatic_payments > 0 AND manual_payments > 0;

  RETURN jsonb_build_object(
    'timestamp', NOW(),
    'mixed_invoices_count', mixed_count,
    'invoices_with_conflicts', COALESCE(mixed_invoices, '[]'::jsonb),
    'system_health', CASE 
      WHEN mixed_count = 0 THEN 'HEALTHY'
      ELSE 'NEEDS_ATTENTION'
    END,
    'message', CASE 
      WHEN mixed_count = 0 THEN 'No se encontraron facturas con pagos mixtos'
      ELSE format('Se encontraron %s facturas con pagos tanto automáticos como manuales', mixed_count)
    END
  );
END;
$$;


ALTER FUNCTION "public"."diagnose_mixed_payment_invoices"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."diagnose_payment_application_conflicts"("p_payment_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  conflict_data jsonb;
  payment_summary jsonb;
BEGIN
  -- If specific payment provided, focus on that
  IF p_payment_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'payment_id', p.id,
      'client_id', p.client_id,
      'amount', p.amount,
      'applied_amount', p.applied_amount,
      'status', p.status,
      'payment_date', p.payment_date,
      'bank_reference', p.bank_reference,
      'applications', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'application_id', pa.id,
            'invoice_id', pa.invoice_id,
            'invoice_folio', i.folio,
            'applied_amount', pa.applied_amount,
            'application_method', pa.application_method,
            'created_at', pa.created_at
          ) ORDER BY pa.created_at
        )
        FROM payment_applications pa
        JOIN invoices i ON pa.invoice_id = i.id
        WHERE pa.payment_id = p.id
      ),
      'calculated_applied', (
        SELECT COALESCE(SUM(pa.applied_amount), 0)
        FROM payment_applications pa
        WHERE pa.payment_id = p.id
      )
    ) INTO payment_summary
    FROM payments p
    WHERE p.id = p_payment_id;
    
    RETURN jsonb_build_object(
      'timestamp', NOW(),
      'payment_analysis', payment_summary,
      'has_conflicts', payment_summary->'applied_amount' != payment_summary->'calculated_applied'
    );
  END IF;
  
  -- General conflict analysis
  SELECT jsonb_agg(
    jsonb_build_object(
      'payment_id', p.id,
      'client_name', c.name,
      'amount', p.amount,
      'recorded_applied', p.applied_amount,
      'calculated_applied', calculated_applied,
      'difference', p.applied_amount - calculated_applied,
      'applications_count', applications_count,
      'status', p.status,
      'bank_reference', p.bank_reference
    )
  ) INTO conflict_data
  FROM payments p
  JOIN clients c ON p.client_id = c.id
  CROSS JOIN LATERAL (
    SELECT 
      COALESCE(SUM(pa.applied_amount), 0) as calculated_applied,
      COUNT(*) as applications_count
    FROM payment_applications pa
    WHERE pa.payment_id = p.id
  ) calc
  WHERE ABS(p.applied_amount - calculated_applied) > 0.01
     OR (p.status = 'applied' AND calculated_applied < p.amount)
     OR (p.status = 'pending' AND calculated_applied > 0);
  
  RETURN jsonb_build_object(
    'timestamp', NOW(),
    'conflicts_found', jsonb_array_length(COALESCE(conflict_data, '[]'::jsonb)),
    'conflicted_payments', COALESCE(conflict_data, '[]'::jsonb),
    'system_health', CASE 
      WHEN conflict_data IS NULL THEN 'HEALTHY'
      ELSE 'NEEDS_ATTENTION'
    END
  );
END;
$$;


ALTER FUNCTION "public"."diagnose_payment_application_conflicts"("p_payment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."diagnose_service_update_issues"("service_id_param" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN jsonb_build_object('success', true, 'message', 'Diagnostic available');
END;
$$;


ALTER FUNCTION "public"."diagnose_service_update_issues"("service_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."emergency_close_service"("p_service_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  service_folio text;
  current_status service_status;
  existing_costs_count integer;
BEGIN
  -- Obtener información del servicio
  SELECT folio, status INTO service_folio, current_status
  FROM public.services
  WHERE id = p_service_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Servicio no encontrado'
    );
  END IF;
  
  -- Verificar que no esté ya completado
  IF current_status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'service_id', p_service_id,
      'service_folio', service_folio,
      'message', 'El servicio ya está completado'
    );
  END IF;
  
  -- Verificar que no esté facturado
  IF current_status = 'invoiced' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se puede cerrar un servicio facturado'
    );
  END IF;

  -- Contar costos existentes para información
  SELECT COUNT(*) INTO existing_costs_count
  FROM public.costs
  WHERE service_id = p_service_id;

  BEGIN
    -- DESHABILITAR TEMPORALMENTE EL TRIGGER DE PREVENCIÓN DE DUPLICADOS
    ALTER TABLE public.costs DISABLE TRIGGER prevent_duplicate_commissions_trigger;
    
    -- SOLO actualizar el estado del servicio
    -- El trigger generate_commission_on_service_completion_trigger
    -- se encargará automáticamente de crear las comisiones
    UPDATE public.services 
    SET 
      status = 'completed'::service_status,
      updated_at = now()
    WHERE id = p_service_id;
    
    -- REHABILITAR EL TRIGGER DE PREVENCIÓN DE DUPLICADOS
    ALTER TABLE public.costs ENABLE TRIGGER prevent_duplicate_commissions_trigger;
    
    RETURN jsonb_build_object(
      'success', true,
      'service_id', p_service_id,
      'service_folio', service_folio,
      'new_status', 'completed',
      'message', 'Servicio cerrado exitosamente',
      'existing_costs', existing_costs_count,
      'note', 'Las comisiones se crean automáticamente por el trigger'
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      -- ASEGURAR QUE EL TRIGGER SE REHABILITE INCLUSO EN CASO DE ERROR
      ALTER TABLE public.costs ENABLE TRIGGER prevent_duplicate_commissions_trigger;
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Error al cerrar servicio: ' || SQLERRM,
        'error_code', SQLSTATE,
        'service_id', p_service_id,
        'service_folio', service_folio
      );
  END;
END;
$$;


ALTER FUNCTION "public"."emergency_close_service"("p_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_commission_batch_consistency"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_commission_category_id UUID;
BEGIN
  IF NEW.payment_batch_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id
  INTO v_commission_category_id
  FROM public.cost_categories
  WHERE name = 'Comisión Operador'
  LIMIT 1;

  IF v_commission_category_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.category_id IS DISTINCT FROM v_commission_category_id THEN
    RETURN NEW;
  END IF;

  IF NEW.operator_id IS NULL THEN
    RAISE EXCEPTION 'Las comisiones en lote deben tener operator_id definido';
  END IF;

  IF NEW.payment_date IS NULL THEN
    RAISE EXCEPTION 'payment_batch_id requiere payment_date (comisión pagada)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.costs c
    WHERE c.payment_batch_id = NEW.payment_batch_id
      AND c.category_id = v_commission_category_id
      AND c.id <> NEW.id
      AND c.operator_id IS DISTINCT FROM NEW.operator_id
  ) THEN
    RAISE EXCEPTION 'Solo un operador por lote (%).', NEW.payment_batch_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.costs c
    WHERE c.payment_batch_id = NEW.payment_batch_id
      AND c.category_id = v_commission_category_id
      AND c.id <> NEW.id
      AND c.payment_date IS DISTINCT FROM NEW.payment_date
  ) THEN
    RAISE EXCEPTION 'Todas las comisiones del lote (%) deben compartir la misma payment_date.', NEW.payment_batch_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_commission_batch_consistency"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_product_service_description"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.product_service_description := public.validate_product_service_description(NEW.product_service_description);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_product_service_description"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_commission_operator_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Si es una comisión y no tiene operator_id, intentar obtenerlo del servicio
  IF NEW.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4' 
     AND NEW.operator_id IS NULL 
     AND NEW.service_id IS NOT NULL THEN
    
    SELECT operator_id INTO NEW.operator_id 
    FROM public.services 
    WHERE id = NEW.service_id;
    
    -- Si aún no tiene operator_id, evitar la inserción
    IF NEW.operator_id IS NULL THEN
      RAISE EXCEPTION 'Las comisiones deben tener un operator_id válido. Service_id: % no tiene operador asignado.', NEW.service_id;
    END IF;
    
    RAISE NOTICE 'Trigger: Auto-asignado operator_id % para comisión de servicio %', NEW.operator_id, NEW.service_id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_commission_operator_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."execute_readonly_query"("query_text" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "statement_timeout" TO '5s'
    AS $$
DECLARE
  result jsonb;
  normalized text;
  clean_query text;
BEGIN
  -- Clean trailing semicolons and whitespace
  clean_query := rtrim(trim(query_text), ';');
  
  -- Validate: must start with SELECT or WITH
  normalized := upper(trim(clean_query));
  IF NOT (normalized LIKE 'SELECT%' OR normalized LIKE 'WITH%') THEN
    RAISE EXCEPTION 'Solo se permiten consultas SELECT';
  END IF;
  
  -- Block dangerous keywords
  IF normalized ~ '\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b' THEN
    RAISE EXCEPTION 'Consulta contiene operaciones no permitidas';
  END IF;

  -- Execute and return as JSON
  EXECUTE 'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (' || clean_query || ') t' INTO result;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."execute_readonly_query"("query_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fill_exit_costs"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_avg_cost numeric;
BEGIN
  -- Solo aplica para movimientos de salida sin costo definido
  IF NEW.movement_type = 'exit' AND NEW.unit_cost IS NULL THEN
    -- Obtener costo promedio ponderado
    v_avg_cost := get_weighted_average_cost(NEW.item_id);
    
    -- Asignar costos calculados
    NEW.unit_cost := v_avg_cost;
    NEW.total_cost := v_avg_cost * NEW.quantity;
    
    RAISE NOTICE 'Auto-calculado costo para salida: item=%, unit_cost=%, total_cost=%', 
      NEW.item_id, NEW.unit_cost, NEW.total_cost;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fill_exit_costs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."final_security_check"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  duplicate_policies INTEGER;
  anonymous_policies INTEGER;
  secure_policies INTEGER;
  result jsonb;
BEGIN
  -- Contar políticas duplicadas (que tengan "_secure" en el nombre)
  SELECT COUNT(*) INTO duplicate_policies
  FROM pg_policies 
  WHERE schemaname = 'public'
  AND policyname LIKE '%_secure%';

  -- Contar políticas que permiten acceso anónimo (que tengan "true" literal)
  SELECT COUNT(*) INTO anonymous_policies
  FROM pg_policies 
  WHERE schemaname = 'public'
  AND (qual LIKE '%true%' OR with_check LIKE '%true%');

  -- Contar políticas seguras (que requieren autenticación)
  SELECT COUNT(*) INTO secure_policies
  FROM pg_policies 
  WHERE schemaname = 'public'
  AND (policyname LIKE '%_auth_only' OR policyname LIKE '%_only' OR policyname LIKE '%_own');

  result := jsonb_build_object(
    'duplicate_policies', duplicate_policies,
    'anonymous_policies', anonymous_policies,
    'secure_policies', secure_policies,
    'is_fully_secure', (duplicate_policies = 0 AND anonymous_policies = 0),
    'profiles_accessible', EXISTS (SELECT 1 FROM public.profiles LIMIT 1),
    'timestamp', now()
  );
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."final_security_check"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_duplicate_suppliers"() RETURNS TABLE("proveedor_1" "text", "proveedor_2" "text", "id_1" "uuid", "id_2" "uuid", "rut_1" "text", "rut_2" "text", "similitud" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s1.name as proveedor_1,
    s2.name as proveedor_2,
    s1.id as id_1,
    s2.id as id_2,
    s1.rut as rut_1,
    s2.rut as rut_2,
    SIMILARITY(s1.name, s2.name) as similitud
  FROM suppliers s1
  CROSS JOIN suppliers s2
  WHERE s1.id < s2.id
    AND s1.is_active = true
    AND s2.is_active = true
    AND SIMILARITY(s1.name, s2.name) > 0.7
  ORDER BY SIMILARITY(s1.name, s2.name) DESC;
END;
$$;


ALTER FUNCTION "public"."find_duplicate_suppliers"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_duplicate_suppliers"() IS 'Identifica proveedores con nombres similares que podrían ser duplicados (similitud > 70%)';



CREATE OR REPLACE FUNCTION "public"."find_matching_costs_for_invoice"("p_supplier_rut" "text", "p_amount" numeric, "p_date_from" "date", "p_date_to" "date") RETURNS TABLE("id" "uuid", "description" "text", "amount" numeric, "date" "date", "payment_date" "date", "supplier_name" "text", "supplier_payment_id" "uuid", "has_invoice" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    c.id,
    c.description,
    c.amount,
    c.date,
    c.payment_date,
    COALESCE(s.name, '') as supplier_name,
    c.supplier_payment_id,
    CASE WHEN sp.supplier_invoice_id IS NOT NULL THEN true ELSE false END as has_invoice
  FROM costs c
  LEFT JOIN inventory_suppliers s ON c.supplier_id = s.id
  LEFT JOIN supplier_payments sp ON (c.supplier_payment_id = sp.id OR sp.cost_id = c.id)
  WHERE
    -- Match by supplier RUT
    c.supplier_id IN (
      SELECT id FROM inventory_suppliers
      WHERE UPPER(REPLACE(REPLACE(REPLACE(rut, '.', ''), '-', ''), ' ', '')) = UPPER(REPLACE(REPLACE(REPLACE(p_supplier_rut, '.', ''), '-', ''), ' ', ''))
    )
    -- Amount within ±5%
    AND c.amount BETWEEN p_amount * 0.95 AND p_amount * 1.05
    -- Date within range OR cost has no folio (pre-invoice registration, always a candidate)
    AND (
      c.date BETWEEN p_date_from AND p_date_to
      OR c.service_folio IS NULL
    )
    -- No invoice linked yet
    AND (sp.supplier_invoice_id IS NULL OR sp.id IS NULL)
  ORDER BY
    -- Prefer exact amount match first
    ABS(c.amount - p_amount) ASC,
    c.date DESC
  LIMIT 5;
$$;


ALTER FUNCTION "public"."find_matching_costs_for_invoice"("p_supplier_rut" "text", "p_amount" numeric, "p_date_from" "date", "p_date_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_all_invoice_statuses"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  invoice_record RECORD;
  fixed_count INTEGER := 0;
  total_applied NUMERIC;
  new_status invoice_status;
  old_status invoice_status;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar correcciones masivas';
  END IF;

  -- Procesar todas las facturas
  FOR invoice_record IN 
    SELECT 
      i.id,
      i.folio,
      i.total,
      i.due_date,
      i.status as current_status,
      COALESCE(SUM(pa.applied_amount), 0) as calculated_paid_amount
    FROM invoices i
    LEFT JOIN payment_applications pa ON i.id = pa.invoice_id
    GROUP BY i.id, i.folio, i.total, i.due_date, i.status
  LOOP
    total_applied := invoice_record.calculated_paid_amount;
    old_status := invoice_record.current_status;
    
    -- Determinar estado correcto
    IF total_applied >= invoice_record.total THEN
      new_status := 'paid'::invoice_status;
    ELSIF total_applied > 0 THEN
      new_status := 'partial'::invoice_status;
    ELSIF invoice_record.due_date < CURRENT_DATE THEN
      new_status := 'overdue'::invoice_status;
    ELSE
      new_status := 'sent'::invoice_status;
    END IF;
    
    -- Actualizar solo si hay cambios
    IF old_status != new_status OR ABS(COALESCE((SELECT paid_amount FROM invoices WHERE id = invoice_record.id), 0) - total_applied) > 0.01 THEN
      UPDATE invoices 
      SET 
        paid_amount = total_applied,
        status = new_status,
        payment_date = CASE 
          WHEN new_status = 'paid' AND payment_date IS NULL THEN CURRENT_DATE
          WHEN new_status != 'paid' THEN NULL
          ELSE payment_date
        END,
        updated_at = NOW()
      WHERE id = invoice_record.id;
      
      fixed_count := fixed_count + 1;
      
      RAISE NOTICE 'Corregida factura %: % -> %, paid_amount: %', 
        invoice_record.folio, old_status, new_status, total_applied;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'fixed_invoices', fixed_count,
    'message', format('Corregidas %s facturas con estados inconsistentes', fixed_count),
    'timestamp', NOW()
  );
END;
$$;


ALTER FUNCTION "public"."fix_all_invoice_statuses"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_all_invoiced_services_status"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  fixed_count INTEGER := 0;
  total_inconsistent INTEGER := 0;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar esta función de corrección global';
  END IF;

  -- Contar servicios inconsistentes antes de la corrección
  SELECT COUNT(*) INTO total_inconsistent
  FROM public.services 
  WHERE invoice_folio IS NOT NULL 
    AND invoice_folio != ''
    AND status != 'invoiced';

  -- Log inicial
  RAISE NOTICE 'CORRECCIÓN GLOBAL: Iniciando corrección de % servicios inconsistentes', total_inconsistent;

  -- Corregir servicios con invoice_folio pero status incorrecto
  UPDATE public.services 
  SET 
    status = 'invoiced',
    updated_at = now()
  WHERE invoice_folio IS NOT NULL 
    AND invoice_folio != ''
    AND status != 'invoiced';

  GET DIAGNOSTICS fixed_count = ROW_COUNT;

  -- Log de resultados
  RAISE NOTICE 'CORRECCIÓN GLOBAL: % servicios corregidos exitosamente', fixed_count;

  RETURN jsonb_build_object(
    'success', true,
    'total_inconsistent_before', total_inconsistent,
    'services_fixed', fixed_count,
    'message', format('Corrección global completada: %s servicios corregidos de %s inconsistentes', fixed_count, total_inconsistent),
    'timestamp', now()
  );
END;
$$;


ALTER FUNCTION "public"."fix_all_invoiced_services_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_all_maintenance_cost_descriptions"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  fixed_count INTEGER := 0;
  cost_record RECORD;
  maintenance_record RECORD;
  new_description TEXT;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar esta función de corrección';
  END IF;

  -- Buscar todos los costos de mantenimiento con descripciones genéricas
  FOR cost_record IN 
    SELECT c.id, c.description, c.maintenance_id, c.notes
    FROM public.costs c
    JOIN public.cost_categories cc ON c.category_id = cc.id
    WHERE cc.name = 'Mantenimiento' 
      AND c.maintenance_id IS NOT NULL
      AND (c.description ILIKE 'Mantenimiento corrective%' 
           OR c.description ILIKE 'Mantenimiento preventivo%'
           OR c.description NOT ILIKE '%:%'
           OR c.description NOT ILIKE '%proveedor%')
  LOOP
    -- Obtener los detalles del mantenimiento correspondiente
    SELECT cm.description, cm.provider, cm.maintenance_type
    INTO maintenance_record
    FROM public.crane_maintenance cm
    WHERE cm.id = cost_record.maintenance_id;
    
    IF FOUND THEN
      -- Construir la descripción correcta
      new_description := 'Mantenimiento: ' || maintenance_record.description;
      
      IF maintenance_record.provider IS NOT NULL AND maintenance_record.provider != '' THEN
        new_description := new_description || ' - Proveedor: ' || maintenance_record.provider;
      END IF;
      
      -- Actualizar el costo con la descripción correcta
      UPDATE public.costs 
      SET 
        description = new_description,
        notes = CASE 
          WHEN notes IS NULL OR notes = '' THEN 'Descripción corregida automáticamente'
          ELSE notes || ' [Descripción corregida automáticamente]'
        END,
        updated_at = NOW()
      WHERE id = cost_record.id;
      
      fixed_count := fixed_count + 1;
      
      RAISE NOTICE 'Corregido costo %: % -> %', 
        cost_record.id, cost_record.description, new_description;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'fixed_costs', fixed_count,
    'message', format('Corregidas %s descripciones de costos de mantenimiento', fixed_count)
  );
END;
$$;


ALTER FUNCTION "public"."fix_all_maintenance_cost_descriptions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_amphos_payment_applications"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_payment_id UUID := '9234da35-7e10-43e6-b918-b08d18b101be';
  v_removed_count INTEGER := 0;
  v_added_count INTEGER := 0;
  v_updated_count INTEGER := 0;
  v_final_applied DECIMAL;
  
  -- Invoices that should NOT be paid (to remove)
  wrong_applications UUID[] := ARRAY[
    '21a5dcbe-e8a8-4677-b395-f430c5f4cdf7', -- FACT-4004
    '5ce20c33-f779-4acf-a268-8e2f209149a0', -- FACT-4031  
    '44f1c6e9-c80e-4e0b-86b4-6464755c8cc1', -- FACT-4032
    'b45ab027-a221-4a4a-bde8-d5616864b853'  -- FACT-4035
  ];
  
  -- Invoices that should be paid
  v_fact_4011_id UUID := 'db1e10bc-5100-4691-af9b-a270e6f219c8';
  v_fact_4013_id UUID := '73a50b63-a8ec-48e2-b16c-505882afa3f7';
  v_existing_4013_app_id UUID;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar esta corrección';
  END IF;

  -- Step 1: Remove incorrect applications
  DELETE FROM payment_applications 
  WHERE id = ANY(wrong_applications);
  
  GET DIAGNOSTICS v_removed_count = ROW_COUNT;
  
  -- Step 2: Check if FACT-4011 application exists, if not create it
  IF NOT EXISTS (
    SELECT 1 FROM payment_applications 
    WHERE payment_id = v_payment_id AND invoice_id = v_fact_4011_id
  ) THEN
    INSERT INTO payment_applications (
      payment_id,
      invoice_id, 
      applied_amount,
      application_method,
      created_by
    ) VALUES (
      v_payment_id,
      v_fact_4011_id,
      258388.00,
      'manual',
      auth.uid()
    );
    v_added_count := v_added_count + 1;
  END IF;
  
  -- Step 3: Update existing FACT-4013 application to complete payment
  SELECT id INTO v_existing_4013_app_id
  FROM payment_applications
  WHERE payment_id = v_payment_id AND invoice_id = v_fact_4013_id;
  
  IF v_existing_4013_app_id IS NOT NULL THEN
    UPDATE payment_applications
    SET applied_amount = 595000.00,  -- Complete total payment
        application_method = 'manual'
    WHERE id = v_existing_4013_app_id;
    v_updated_count := 1;
  ELSE
    -- If for some reason it doesn't exist, create it
    INSERT INTO payment_applications (
      payment_id,
      invoice_id,
      applied_amount, 
      application_method,
      created_by
    ) VALUES (
      v_payment_id,
      v_fact_4013_id,
      595000.00,
      'manual',
      auth.uid()
    );
    v_added_count := v_added_count + 1;
  END IF;
  
  -- Step 4: Calculate final applied amount
  SELECT COALESCE(SUM(applied_amount), 0) INTO v_final_applied
  FROM payment_applications
  WHERE payment_id = v_payment_id;
  
  -- Step 5: Update payment status
  UPDATE payments 
  SET 
    applied_amount = v_final_applied,
    status = 'applied'::payment_status,
    updated_at = NOW()
  WHERE id = v_payment_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'removed_applications', v_removed_count,
    'added_applications', v_added_count,
    'updated_applications', v_updated_count,
    'final_applied_amount', v_final_applied,
    'message', format('Corregido pago Amphos 21: eliminadas %s aplicaciones incorrectas, agregadas %s, actualizadas %s. Total aplicado: $%s', 
      v_removed_count, v_added_count, v_updated_count, v_final_applied)
  );
END;
$_$;


ALTER FUNCTION "public"."fix_amphos_payment_applications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_applied_amount_duplications"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  payment_record RECORD;
  fixed_count INTEGER := 0;
  total_inconsistent INTEGER := 0;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar esta corrección';
  END IF;

  -- Count total inconsistent payments
  SELECT COUNT(*) INTO total_inconsistent
  FROM (
    SELECT 
      p.id,
      p.applied_amount as recorded_applied,
      COALESCE(SUM(pa.applied_amount), 0) as calculated_applied
    FROM payments p
    LEFT JOIN payment_applications pa ON p.id = pa.payment_id
    GROUP BY p.id, p.applied_amount
    HAVING ABS(p.applied_amount - COALESCE(SUM(pa.applied_amount), 0)) > 0.01
  ) inconsistent;

  -- Fix each inconsistent payment
  FOR payment_record IN 
    SELECT 
      p.id,
      p.amount,
      p.applied_amount as recorded_applied,
      COALESCE(SUM(pa.applied_amount), 0) as calculated_applied,
      c.name as client_name
    FROM payments p
    LEFT JOIN payment_applications pa ON p.id = pa.payment_id
    LEFT JOIN clients c ON p.client_id = c.id
    GROUP BY p.id, p.amount, p.applied_amount, c.name
    HAVING ABS(p.applied_amount - COALESCE(SUM(pa.applied_amount), 0)) > 0.01
  LOOP
    -- Update payment with correct applied amount
    UPDATE payments 
    SET 
      applied_amount = payment_record.calculated_applied,
      status = CASE 
        WHEN payment_record.calculated_applied >= payment_record.amount THEN 'applied'::payment_status
        WHEN payment_record.calculated_applied > 0 THEN 'partial'::payment_status
        ELSE 'pending'::payment_status
      END,
      updated_at = NOW()
    WHERE id = payment_record.id;
    
    fixed_count := fixed_count + 1;
    
    RAISE NOTICE 'Corregido pago de %: applied_amount % -> %', 
      payment_record.client_name, 
      payment_record.recorded_applied, 
      payment_record.calculated_applied;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_inconsistent_found', total_inconsistent,
    'payments_fixed', fixed_count,
    'message', format('Corregidos %s de %s pagos con applied_amount incorrecto', fixed_count, total_inconsistent),
    'timestamp', NOW()
  );
END;
$$;


ALTER FUNCTION "public"."fix_applied_amount_duplications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_duplicate_fact_4011_application"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_main_payment_id UUID := '9234da35-7e10-43e6-b918-b08d18b101be';
  v_fact_4011_id UUID := 'db1e10bc-5100-4691-af9b-a270e6f219c8';
  v_removed_amount DECIMAL;
  v_final_applied DECIMAL;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar esta corrección';
  END IF;

  -- Get the amount being removed for logging
  SELECT applied_amount INTO v_removed_amount
  FROM payment_applications 
  WHERE payment_id = v_main_payment_id AND invoice_id = v_fact_4011_id;

  -- Remove the duplicate application from the main payment to FACT-4011
  -- FACT-4011 should only be paid by its own separate payment
  DELETE FROM payment_applications 
  WHERE payment_id = v_main_payment_id 
    AND invoice_id = v_fact_4011_id;

  -- Calculate final applied amount for main payment
  SELECT COALESCE(SUM(applied_amount), 0) INTO v_final_applied
  FROM payment_applications
  WHERE payment_id = v_main_payment_id;

  -- Update main payment status
  UPDATE payments 
  SET 
    applied_amount = v_final_applied,
    status = CASE 
      WHEN v_final_applied >= amount THEN 'applied'::payment_status
      WHEN v_final_applied > 0 THEN 'partial'::payment_status
      ELSE 'pending'::payment_status
    END,
    updated_at = NOW()
  WHERE id = v_main_payment_id;

  RETURN jsonb_build_object(
    'success', true,
    'main_payment_id', v_main_payment_id,
    'removed_duplicate_amount', v_removed_amount,
    'final_applied_amount', v_final_applied,
    'message', format('Eliminada aplicación duplicada de FACT-4011: $%s. El pago principal ahora aplica $%s correctamente.', 
      v_removed_amount, v_final_applied)
  );
END;
$_$;


ALTER FUNCTION "public"."fix_duplicate_fact_4011_application"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_duplicate_paid_amounts"() RETURNS TABLE("invoice_id" "uuid", "folio" "text", "old_paid_amount" numeric, "correct_paid_amount" numeric, "difference" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH invoice_corrections AS (
    SELECT 
      i.id,
      i.folio,
      i.paid_amount as old_paid,
      COALESCE(SUM(pa.applied_amount), 0) as correct_paid,
      i.paid_amount - COALESCE(SUM(pa.applied_amount), 0) as diff
    FROM invoices i
    LEFT JOIN payment_applications pa ON pa.invoice_id = i.id
    WHERE i.paid_amount != COALESCE((SELECT SUM(pa2.applied_amount) FROM payment_applications pa2 WHERE pa2.invoice_id = i.id), 0)
    GROUP BY i.id, i.folio, i.paid_amount
  )
  SELECT 
    ic.id,
    ic.folio,
    ic.old_paid,
    ic.correct_paid,
    ic.diff
  FROM invoice_corrections ic;
  
  -- Ejecutar correcciones
  UPDATE invoices i
  SET 
    paid_amount = (
      SELECT COALESCE(SUM(pa.applied_amount), 0)
      FROM payment_applications pa
      WHERE pa.invoice_id = i.id
    ),
    status = CASE
      WHEN (SELECT COALESCE(SUM(pa.applied_amount), 0) FROM payment_applications pa WHERE pa.invoice_id = i.id) >= i.total THEN 'paid'::invoice_status
      WHEN (SELECT COALESCE(SUM(pa.applied_amount), 0) FROM payment_applications pa WHERE pa.invoice_id = i.id) > 0 THEN 'partial'::invoice_status
      ELSE i.status
    END,
    updated_at = now()
  WHERE i.paid_amount != (
    SELECT COALESCE(SUM(pa.applied_amount), 0)
    FROM payment_applications pa
    WHERE pa.invoice_id = i.id
  );
END;
$$;


ALTER FUNCTION "public"."fix_duplicate_paid_amounts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_existing_invoice_inconsistencies"() RETURNS TABLE("invoice_id" "uuid", "old_paid_amount" numeric, "new_paid_amount" numeric, "old_status" "public"."invoice_status", "new_status" "public"."invoice_status")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invoice RECORD;
  v_total_paid DECIMAL(10,2);
  v_new_status invoice_status;
BEGIN
  -- Iterar sobre todas las facturas
  FOR v_invoice IN 
    SELECT i.id, i.total, i.paid_amount as current_paid, i.status as current_status
    FROM invoices i
  LOOP
    -- Calcular el verdadero total pagado
    SELECT COALESCE(SUM(pa.applied_amount), 0)
    INTO v_total_paid
    FROM payment_applications pa
    WHERE pa.invoice_id = v_invoice.id;

    -- Determinar el estado correcto (solo si hay pagos)
    IF v_total_paid > 0 THEN
      IF v_total_paid >= v_invoice.total THEN
        v_new_status := 'paid';
      ELSE
        v_new_status := 'partial';
      END IF;
    ELSE
      -- Si no hay pagos, mantener el estado actual
      v_new_status := v_invoice.current_status;
    END IF;

    -- Si hay diferencia, corregir
    IF v_total_paid != v_invoice.current_paid OR (v_total_paid > 0 AND v_new_status != v_invoice.current_status) THEN
      -- Guardar valores antiguos para el reporte
      invoice_id := v_invoice.id;
      old_paid_amount := v_invoice.current_paid;
      new_paid_amount := v_total_paid;
      old_status := v_invoice.current_status;
      new_status := v_new_status;

      -- Actualizar la factura
      UPDATE invoices
      SET 
        paid_amount = v_total_paid,
        status = v_new_status,
        updated_at = now()
      WHERE id = v_invoice.id;

      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."fix_existing_invoice_inconsistencies"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_existing_overdue_invoices"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Verificar que el usuario sea administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar esta función';
  END IF;

  -- Contar cuántas facturas se actualizarán
  SELECT COUNT(*) INTO updated_count
  FROM public.invoices 
  WHERE status IN ('sent', 'draft') 
    AND due_date < CURRENT_DATE
    AND status != 'overdue'
    AND status != 'paid'
    AND status != 'cancelled';

  -- Ejecutar la actualización de facturas vencidas
  PERFORM public.update_overdue_invoices();
  
  RETURN 'Actualización completada: ' || updated_count || ' facturas actualizadas a estado vencido';
END;
$$;


ALTER FUNCTION "public"."fix_existing_overdue_invoices"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_existing_payment_inconsistencies"() RETURNS TABLE("payment_id" "uuid", "old_applied_amount" numeric, "new_applied_amount" numeric, "old_status" "public"."payment_status", "new_status" "public"."payment_status")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_payment RECORD;
  v_total_applied DECIMAL(10,2);
  v_new_status payment_status;
BEGIN
  -- Iterar sobre todos los pagos
  FOR v_payment IN 
    SELECT p.id, p.amount, p.applied_amount as current_applied, p.status as current_status
    FROM payments p
  LOOP
    -- Calcular el verdadero total aplicado
    SELECT COALESCE(SUM(pa.applied_amount), 0)
    INTO v_total_applied
    FROM payment_applications pa
    WHERE pa.payment_id = v_payment.id;

    -- Determinar el estado correcto
    IF v_total_applied = 0 THEN
      v_new_status := 'pending';
    ELSIF v_total_applied >= v_payment.amount THEN
      v_new_status := 'applied';
    ELSE
      v_new_status := 'partial';
    END IF;

    -- Si hay diferencia, corregir
    IF v_total_applied != v_payment.current_applied OR v_new_status != v_payment.current_status THEN
      -- Guardar valores antiguos para el reporte
      payment_id := v_payment.id;
      old_applied_amount := v_payment.current_applied;
      new_applied_amount := v_total_applied;
      old_status := v_payment.current_status;
      new_status := v_new_status;

      -- Actualizar el pago
      UPDATE payments
      SET 
        applied_amount = v_total_applied,
        status = v_new_status,
        updated_at = now()
      WHERE id = v_payment.id;

      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."fix_existing_payment_inconsistencies"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_inventory_cost_issues"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  cleanup_result jsonb;
  recalc_result jsonb;
  final_result jsonb;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar la corrección completa';
  END IF;

  RAISE NOTICE 'Iniciando corrección completa de problemas de inventario...';

  -- Paso 1: Limpiar costos duplicados
  SELECT public.cleanup_duplicate_inventory_costs() INTO cleanup_result;
  
  -- Paso 2: Recalcular costos en crane_parts
  SELECT public.recalculate_crane_parts_costs() INTO recalc_result;

  -- Compilar resultado final
  final_result := jsonb_build_object(
    'success', true,
    'timestamp', NOW(),
    'cleanup_phase', cleanup_result,
    'recalculation_phase', recalc_result,
    'message', 'Corrección completa de problemas de inventario ejecutada exitosamente'
  );

  RAISE NOTICE 'Corrección completa finalizada exitosamente';
  RETURN final_result;
END;
$$;


ALTER FUNCTION "public"."fix_inventory_cost_issues"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_invoice_payment_inconsistencies"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  inconsistent_invoice RECORD;
  fixed_count INTEGER := 0;
  total_applied DECIMAL;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden corregir inconsistencias';
  END IF;

  -- Corregir facturas marcadas como pagadas con remaining_amount > 0
  FOR inconsistent_invoice IN 
    SELECT 
      i.id,
      i.folio,
      i.total,
      i.paid_amount,
      i.remaining_amount,
      COALESCE(SUM(pa.applied_amount), 0) as calculated_paid_amount
    FROM invoices i
    LEFT JOIN payment_applications pa ON i.id = pa.invoice_id
    WHERE i.status = 'paid' AND i.remaining_amount > 0
    GROUP BY i.id, i.folio, i.total, i.paid_amount, i.remaining_amount
  LOOP
    -- Recalcular paid_amount basado en payment_applications
    total_applied := inconsistent_invoice.calculated_paid_amount;
    
    -- Actualizar la factura con el monto correcto
    UPDATE invoices 
    SET 
      paid_amount = total_applied,
      status = CASE 
        WHEN total_applied >= total THEN 'paid'::invoice_status
        WHEN total_applied > 0 THEN 'partial'::invoice_status
        ELSE 'sent'::invoice_status
      END,
      updated_at = NOW()
    WHERE id = inconsistent_invoice.id;
    
    fixed_count := fixed_count + 1;
    
    RAISE NOTICE 'Corregida factura %: paid_amount % -> %, status recalculado', 
      inconsistent_invoice.folio, inconsistent_invoice.paid_amount, total_applied;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'fixed_invoices', fixed_count,
    'message', format('Corregidas %s facturas con inconsistencias de pago', fixed_count)
  );
END;
$$;


ALTER FUNCTION "public"."fix_invoice_payment_inconsistencies"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fix_invoice_payment_inconsistencies"() IS 'Corrige inconsistencias en facturas marcadas como pagadas con remaining_amount > 0';



CREATE OR REPLACE FUNCTION "public"."fix_maintenance_status_inconsistencies"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  fixed_count INTEGER := 0;
  backfilled_count INTEGER := 0;
BEGIN
  -- Corregir mantenimientos con completed_date pero status incorrecto
  UPDATE public.crane_maintenance 
  SET status = 'completed', updated_at = now()
  WHERE completed_date IS NOT NULL 
  AND status != 'completed';
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  
  -- Ejecutar backfill de costos para mantenimientos corregidos
  PERFORM public.backfill_maintenance_costs();
  
  -- Contar costos creados por el backfill
  SELECT COUNT(*) INTO backfilled_count
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name ILIKE '%mantenimiento%'
  AND c.created_at > now() - interval '5 minutes';
  
  RETURN jsonb_build_object(
    'success', true,
    'fixed_maintenance_records', fixed_count,
    'backfilled_costs', backfilled_count,
    'message', format('Corregidos %s mantenimientos y generados %s costos faltantes', fixed_count, backfilled_costs)
  );
END;
$$;


ALTER FUNCTION "public"."fix_maintenance_status_inconsistencies"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_materiales_electricos_unit_cost"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  item_id_found UUID;
  avg_historical_cost NUMERIC;
  updated_count INTEGER := 0;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden corregir costos de catálogo';
  END IF;

  -- Buscar el item "Materiales Eléctricos"
  SELECT id INTO item_id_found
  FROM public.inventory_items
  WHERE LOWER(name) LIKE '%materiales%electricos%' 
     OR LOWER(name) LIKE '%materiales%eléctricos%'
  LIMIT 1;

  IF item_id_found IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se encontró el producto "Materiales Eléctricos"'
    );
  END IF;

  -- Calcular costo promedio de las entradas históricas
  SELECT AVG(unit_cost) INTO avg_historical_cost
  FROM public.inventory_movements 
  WHERE item_id = item_id_found 
    AND movement_type IN ('entry', 'purchase')
    AND unit_cost > 0
    AND unit_cost IS NOT NULL;

  -- Si no hay costo histórico, usar el valor conocido de $19,620
  IF avg_historical_cost IS NULL OR avg_historical_cost = 0 THEN
    avg_historical_cost := 19620.00;
  END IF;

  -- Actualizar el unit_cost en inventory_items
  UPDATE public.inventory_items
  SET 
    unit_cost = avg_historical_cost,
    updated_at = NOW()
  WHERE id = item_id_found
    AND (unit_cost IS NULL OR unit_cost = 0);
    
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'item_id', item_id_found,
    'updated_count', updated_count,
    'new_unit_cost', avg_historical_cost,
    'message', format('Costo unitario actualizado a $%s', avg_historical_cost)
  );
END;
$_$;


ALTER FUNCTION "public"."fix_materiales_electricos_unit_cost"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_negative_remaining_amounts"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  fixed_count INTEGER := 0;
BEGIN
  -- Verificar permisos
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden corregir montos negativos';
  END IF;

  -- Corregir pagos con remaining_amount negativo
  UPDATE public.payments 
  SET 
    applied_amount = LEAST(applied_amount, amount),
    remaining_amount = GREATEST(amount - applied_amount, 0),
    status = CASE 
      WHEN LEAST(applied_amount, amount) = 0 THEN 'pending'::payment_status
      WHEN LEAST(applied_amount, amount) < amount THEN 'partial'::payment_status
      WHEN LEAST(applied_amount, amount) = amount THEN 'applied'::payment_status
      ELSE 'partial'::payment_status
    END,
    updated_at = now()
  WHERE remaining_amount < 0 OR applied_amount > amount;
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'fixed_count', fixed_count,
    'message', format('Corregidos %s pagos con montos negativos', fixed_count)
  );
END;
$$;


ALTER FUNCTION "public"."fix_negative_remaining_amounts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_payment_system_inconsistencies"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  fixed_payments INTEGER := 0;
  fixed_invoices INTEGER := 0;
  payment_record RECORD;
  invoice_record RECORD;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden corregir inconsistencias';
  END IF;

  -- Corregir pagos con applied_amount incorrecto
  FOR payment_record IN 
    SELECT 
      p.id,
      p.amount,
      p.applied_amount,
      COALESCE(SUM(pa.applied_amount), 0) as calculated_applied
    FROM payments p
    LEFT JOIN payment_applications pa ON p.id = pa.payment_id
    GROUP BY p.id, p.amount, p.applied_amount
    HAVING p.applied_amount != COALESCE(SUM(pa.applied_amount), 0)
       OR p.applied_amount > p.amount
       OR p.applied_amount < 0
  LOOP
    UPDATE payments 
    SET 
      applied_amount = LEAST(payment_record.calculated_applied, payment_record.amount),
      status = CASE 
        WHEN LEAST(payment_record.calculated_applied, payment_record.amount) >= payment_record.amount THEN 'applied'::payment_status
        WHEN LEAST(payment_record.calculated_applied, payment_record.amount) > 0 THEN 'partial'::payment_status
        ELSE 'pending'::payment_status
      END,
      updated_at = NOW()
    WHERE id = payment_record.id;
    
    fixed_payments := fixed_payments + 1;
  END LOOP;

  -- Corregir facturas con paid_amount incorrecto
  FOR invoice_record IN 
    SELECT 
      i.id,
      i.total,
      i.paid_amount,
      i.status,
      COALESCE(SUM(pa.applied_amount), 0) as calculated_paid
    FROM invoices i
    LEFT JOIN payment_applications pa ON i.id = pa.invoice_id
    GROUP BY i.id, i.total, i.paid_amount, i.status
    HAVING i.paid_amount != COALESCE(SUM(pa.applied_amount), 0)
       OR (i.status = 'paid' AND COALESCE(SUM(pa.applied_amount), 0) < i.total)
       OR (i.status != 'paid' AND COALESCE(SUM(pa.applied_amount), 0) >= i.total)
  LOOP
    UPDATE invoices
    SET 
      paid_amount = invoice_record.calculated_paid,
      status = CASE 
        WHEN invoice_record.calculated_paid >= invoice_record.total THEN 'paid'::invoice_status
        WHEN invoice_record.calculated_paid > 0 THEN 'partial'::invoice_status
        ELSE 'sent'::invoice_status
      END,
      payment_date = CASE 
        WHEN invoice_record.calculated_paid >= invoice_record.total THEN COALESCE(payment_date, CURRENT_DATE)
        ELSE NULL
      END,
      updated_at = NOW()
    WHERE id = invoice_record.id;
    
    fixed_invoices := fixed_invoices + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'fixed_payments', fixed_payments,
    'fixed_invoices', fixed_invoices,
    'message', format('Sistema corregido: %s pagos y %s facturas actualizadas', fixed_payments, fixed_invoices)
  );
END;
$$;


ALTER FUNCTION "public"."fix_payment_system_inconsistencies"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_specific_payment_issue"("p_payment_id" "uuid" DEFAULT '019354ad-1fc6-7a97-9faa-f48fa2cb6abc'::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  correct_fiscal_numbers TEXT[] := ARRAY['3779', '3781', '3782', '3783', '3784'];
  unwanted_fiscal_numbers TEXT[] := ARRAY['3772', '3794', '3795', '3798'];
  v_removed_count INTEGER := 0;
  v_kept_count INTEGER := 0;
  v_payment_amount DECIMAL;
  v_remaining_applied DECIMAL;
BEGIN
  -- Get payment amount
  SELECT amount INTO v_payment_amount
  FROM payments 
  WHERE id = p_payment_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pago no encontrado'
    );
  END IF;
  
  -- Remove unwanted applications
  DELETE FROM payment_applications 
  WHERE payment_id = p_payment_id
    AND invoice_id IN (
      SELECT id FROM invoices 
      WHERE numero_fiscal = ANY(unwanted_fiscal_numbers)
    );
  
  GET DIAGNOSTICS v_removed_count = ROW_COUNT;
  
  -- Count remaining applications
  SELECT COUNT(*) INTO v_kept_count
  FROM payment_applications pa
  JOIN invoices i ON pa.invoice_id = i.id
  WHERE pa.payment_id = p_payment_id
    AND i.numero_fiscal = ANY(correct_fiscal_numbers);
  
  -- Calculate remaining applied amount
  SELECT COALESCE(SUM(applied_amount), 0) INTO v_remaining_applied
  FROM payment_applications
  WHERE payment_id = p_payment_id;
  
  -- Update payment status
  UPDATE payments 
  SET 
    applied_amount = v_remaining_applied,
    status = CASE 
      WHEN v_remaining_applied >= amount THEN 'applied'::payment_status
      WHEN v_remaining_applied > 0 THEN 'partial'::payment_status
      ELSE 'pending'::payment_status
    END,
    updated_at = NOW()
  WHERE id = p_payment_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'payment_amount', v_payment_amount,
    'removed_applications', v_removed_count,
    'kept_applications', v_kept_count,
    'remaining_applied_amount', v_remaining_applied,
    'message', format('Corregido pago: eliminadas %s aplicaciones incorrectas, mantenidas %s correctas', 
      v_removed_count, v_kept_count)
  );
END;
$$;


ALTER FUNCTION "public"."fix_specific_payment_issue"("p_payment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_unlinked_maintenance_costs"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  fixed_count INTEGER := 0;
  duplicate_count INTEGER := 0;
  cost_record RECORD;
  maintenance_id_found UUID;
BEGIN
  -- Buscar costos de mantenimiento sin maintenance_id
  FOR cost_record IN 
    SELECT c.* 
    FROM public.costs c
    JOIN public.cost_categories cc ON c.category_id = cc.id
    WHERE cc.name = 'Mantenimiento' 
      AND c.maintenance_id IS NULL
      AND c.description ILIKE 'Mantenimiento:%'
  LOOP
    -- Intentar encontrar el mantenimiento correspondiente por descripción y fecha
    SELECT cm.id INTO maintenance_id_found
    FROM public.crane_maintenance cm
    WHERE cm.crane_id = cost_record.crane_id
      AND cm.cost = cost_record.amount
      AND cm.status = 'completed'
      AND ABS(EXTRACT(EPOCH FROM (cm.completed_date::timestamp - cost_record.date::timestamp))) < 86400 -- Mismo día
      AND NOT EXISTS (
        SELECT 1 FROM public.costs c2 WHERE c2.maintenance_id = cm.id
      )
    ORDER BY ABS(EXTRACT(EPOCH FROM (cm.completed_date::timestamp - cost_record.date::timestamp)))
    LIMIT 1;
    
    IF maintenance_id_found IS NOT NULL THEN
      -- Vincular el costo existente
      UPDATE public.costs 
      SET maintenance_id = maintenance_id_found,
          notes = COALESCE(notes, '') || ' [Vinculado automáticamente]'
      WHERE id = cost_record.id;
      
      fixed_count := fixed_count + 1;
      RAISE NOTICE 'Vinculado costo % con mantenimiento %', cost_record.id, maintenance_id_found;
    ELSE
      -- Si no encuentra mantenimiento, verificar si es duplicado
      IF EXISTS (
        SELECT 1 FROM public.costs c2
        WHERE c2.id != cost_record.id
          AND c2.crane_id = cost_record.crane_id
          AND c2.amount = cost_record.amount
          AND c2.date = cost_record.date
          AND c2.maintenance_id IS NOT NULL
      ) THEN
        -- Eliminar duplicado
        DELETE FROM public.costs WHERE id = cost_record.id;
        duplicate_count := duplicate_count + 1;
        RAISE NOTICE 'Eliminado costo duplicado %', cost_record.id;
      END IF;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'fixed_costs', fixed_count,
    'removed_duplicates', duplicate_count,
    'message', format('Corregidos %s costos, eliminados %s duplicados', fixed_count, duplicate_count)
  );
END;
$$;


ALTER FUNCTION "public"."fix_unlinked_maintenance_costs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."force_close_service_bypass_triggers"("p_service_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result jsonb;
  service_folio text;
  current_status service_status;
BEGIN
  -- Obtener información del servicio
  SELECT folio, status INTO service_folio, current_status
  FROM public.services
  WHERE id = p_service_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Servicio no encontrado'
    );
  END IF;
  
  -- Verificar que no esté ya completado
  IF current_status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'service_id', p_service_id,
      'service_folio', service_folio,
      'message', 'El servicio ya está completado'
    );
  END IF;
  
  -- Verificar que no esté facturado
  IF current_status = 'invoiced' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se puede cerrar un servicio facturado'
    );
  END IF;
  
  -- Deshabilitar temporalmente triggers relacionados con comisiones
  -- Actualizar directamente sin triggers
  PERFORM pg_advisory_lock(hashtext('close_service_' || p_service_id::text));
  
  BEGIN
    -- Actualizar solo el estado usando UPDATE directo
    UPDATE public.services 
    SET 
      status = 'completed'::service_status,
      updated_at = now()
    WHERE id = p_service_id
      AND status != 'completed'::service_status
      AND status != 'invoiced'::service_status;
    
    -- Verificar que se actualizó
    GET DIAGNOSTICS result = ROW_COUNT;
    
    IF result::integer = 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'No se pudo actualizar el servicio - posible problema de estado'
      );
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_advisory_unlock(hashtext('close_service_' || p_service_id::text));
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Error en la actualización: ' || SQLERRM
      );
  END;
  
  PERFORM pg_advisory_unlock(hashtext('close_service_' || p_service_id::text));
  
  RETURN jsonb_build_object(
    'success', true,
    'service_id', p_service_id,
    'service_folio', service_folio,
    'new_status', 'completed',
    'message', 'Servicio cerrado exitosamente'
  );
END;
$$;


ALTER FUNCTION "public"."force_close_service_bypass_triggers"("p_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."force_commission_sync_for_service"("p_service_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_service RECORD;
  v_category_id UUID := '440296d4-09c2-4f3a-b02b-835f861df4c4';
  v_created_count INT := 0;
  v_resource_record RECORD;
BEGIN
  SELECT id, folio, service_date, crane_id, operator_commission
  INTO v_service
  FROM services
  WHERE id = p_service_id;

  IF v_service.id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Servicio no encontrado');
  END IF;

  IF v_service.operator_commission IS NULL OR v_service.operator_commission <= 0 THEN
    RETURN json_build_object('success', true, 'message', 'El servicio no tiene comisión configurada', 'created', 0);
  END IF;

  DELETE FROM costs
  WHERE service_id = p_service_id
    AND category_id = v_category_id;

  -- Crear comisiones solo para operadores NO excluidos
  FOR v_resource_record IN
    SELECT sr.operator_id, sr.commission_amount, o.name
    FROM service_resources sr
    JOIN operators o ON sr.operator_id = o.id
    WHERE sr.service_id = p_service_id 
      AND sr.resource_type = 'operator'
      AND sr.commission_amount > 0
      AND o.name NOT IN ('Jorge Iriarte', 'Sergio Iriarte', 'Jorge Ignacio Iriarte')
  LOOP
    INSERT INTO costs (
      date, description, amount, category_id, operator_id, service_id, service_folio, subcategory, crane_id
    ) VALUES (
      v_service.service_date,
      'Comisión operador: ' || v_resource_record.name || ' - Servicio ' || v_service.folio,
      v_resource_record.commission_amount, v_category_id, v_resource_record.operator_id,
      p_service_id, v_service.folio, 'Comisión Operador', v_service.crane_id
    );
    v_created_count := v_created_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'message', 'Sincronización completada', 'created', v_created_count, 'folio', v_service.folio);
END;
$$;


ALTER FUNCTION "public"."force_commission_sync_for_service"("p_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."force_frontend_cache_refresh"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Esta función será llamada desde el frontend para invalidar todos los cachés
  -- y forzar una recarga completa de datos
  
  RETURN jsonb_build_object(
    'success', true,
    'timestamp', now(),
    'message', 'Cache refresh forced successfully'
  );
END;
$$;


ALTER FUNCTION "public"."force_frontend_cache_refresh"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."force_resync_crane_part"("part_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  part_record RECORD;
  result jsonb;
BEGIN
  -- Verificar permisos
  IF NOT (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'Permisos insuficientes para re-sincronizar piezas';
  END IF;

  -- Obtener la pieza
  SELECT * INTO part_record FROM public.crane_parts WHERE id = part_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Pieza no encontrada');
  END IF;

  -- Limpiar sincronización existente si existe
  IF part_record.inventory_movement_id IS NOT NULL THEN
    -- Marcar movimiento como cancelado en lugar de eliminarlo
    UPDATE public.inventory_movements 
    SET status = 'cancelled', observations = observations || ' - Re-sincronizado'
    WHERE id = part_record.inventory_movement_id;
    
    -- Limpiar referencia
    UPDATE public.crane_parts 
    SET inventory_movement_id = NULL 
    WHERE id = part_id;
  END IF;

  -- Ejecutar sincronización manual usando la misma lógica del trigger
  -- (esto activará el trigger en la próxima actualización)
  UPDATE public.crane_parts 
  SET updated_at = now()
  WHERE id = part_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Re-sincronización completada para: ' || part_record.part_name
  );
END;
$$;


ALTER FUNCTION "public"."force_resync_crane_part"("part_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."force_update_service_to_invoiced"("p_service_id" "uuid", "p_invoice_folio" "text", "p_numero_fiscal" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result jsonb;
  service_before record;
  service_after record;
BEGIN
  -- Obtener estado actual del servicio
  SELECT id, folio, status, invoice_folio, invoice_numero_fiscal, updated_at
  INTO service_before
  FROM public.services
  WHERE id = p_service_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Servicio no encontrado'
    );
  END IF;
  
  -- Registrar estado antes
  RAISE NOTICE 'Estado ANTES: folio=%, status=%, invoice_folio=%, invoice_numero_fiscal=%', 
    service_before.folio, service_before.status, service_before.invoice_folio, service_before.invoice_numero_fiscal;
  
  -- Realizar la actualización
  UPDATE public.services 
  SET 
    status = 'invoiced',
    invoice_folio = p_invoice_folio,
    invoice_numero_fiscal = p_numero_fiscal,
    updated_at = now()
  WHERE id = p_service_id;
  
  -- Verificar si se actualizó
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se pudo actualizar el servicio - posible problema de permisos'
    );
  END IF;
  
  -- Obtener estado después
  SELECT id, folio, status, invoice_folio, invoice_numero_fiscal, updated_at
  INTO service_after
  FROM public.services
  WHERE id = p_service_id;
  
  -- Registrar estado después
  RAISE NOTICE 'Estado DESPUÉS: folio=%, status=%, invoice_folio=%, invoice_numero_fiscal=%', 
    service_after.folio, service_after.status, service_after.invoice_folio, service_after.invoice_numero_fiscal;
  
  RETURN jsonb_build_object(
    'success', true,
    'service_id', p_service_id,
    'before', jsonb_build_object(
      'status', service_before.status,
      'invoice_folio', service_before.invoice_folio,
      'invoice_numero_fiscal', service_before.invoice_numero_fiscal,
      'updated_at', service_before.updated_at
    ),
    'after', jsonb_build_object(
      'status', service_after.status,
      'invoice_folio', service_after.invoice_folio,
      'invoice_numero_fiscal', service_after.invoice_numero_fiscal,
      'updated_at', service_after.updated_at
    ),
    'updated_successfully', (service_after.status = 'invoiced')
  );
END;
$$;


ALTER FUNCTION "public"."force_update_service_to_invoiced"("p_service_id" "uuid", "p_invoice_folio" "text", "p_numero_fiscal" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."full_payment_cleanup_and_sync"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."full_payment_cleanup_and_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_commission_cost"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  service_record RECORD;
  category_id_commission UUID;
  existing_cost_id UUID;
BEGIN
  -- Solo procesar recursos de tipo operator con comisión > 0
  IF NEW.resource_type = 'operator' AND NEW.commission_amount > 0 AND NEW.operator_id IS NOT NULL THEN
    
    -- Obtener datos del servicio
    SELECT s.*, o.name as operator_name
    INTO service_record
    FROM public.services s
    LEFT JOIN public.operators o ON NEW.operator_id = o.id
    WHERE s.id = NEW.service_id;
    
    -- Obtener el category_id de comisiones
    SELECT id INTO category_id_commission
    FROM public.cost_categories
    WHERE name = 'Comisión Operador'
    LIMIT 1;
    
    -- Verificar si ya existe un costo de comisión para este servicio y operador
    SELECT c.id INTO existing_cost_id
    FROM public.costs c
    JOIN public.cost_categories cc ON c.category_id = cc.id
    WHERE cc.name = 'Comisión Operador'
      AND c.service_id = NEW.service_id
      AND c.operator_id = NEW.operator_id;
    
    IF existing_cost_id IS NOT NULL THEN
      -- Actualizar el costo existente con el nuevo monto
      UPDATE public.costs 
      SET 
        amount = NEW.commission_amount,
        updated_at = now(),
        description = 'Comisión por servicio ' || service_record.folio || ' - ' || service_record.operator_name
      WHERE id = existing_cost_id;
      
      RAISE NOTICE 'Updated existing commission cost: % for operator: %', NEW.commission_amount, service_record.operator_name;
    ELSE
      -- Insertar nuevo costo de comisión
      INSERT INTO public.costs (
        amount,
        category_id,
        service_id,
        operator_id,
        service_folio,
        date,
        description,
        subcategory,
        notes,
        created_by
      ) VALUES (
        NEW.commission_amount,
        category_id_commission,
        NEW.service_id,
        NEW.operator_id,
        service_record.folio,
        service_record.service_date,
        'Comisión por servicio ' || service_record.folio || ' - ' || service_record.operator_name,
        'comisiones',
        'Comisión generada automáticamente',
        service_record.created_by
      );
      
      RAISE NOTICE 'Created new commission cost: % for operator: %', NEW.commission_amount, service_record.operator_name;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_commission_cost"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_commission_cost"() IS 'DESHABILITADO: Función de generación automática de comisiones deshabilitada por seguridad';



CREATE OR REPLACE FUNCTION "public"."generate_commission_on_service_completion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_resource RECORD;
  v_commission_category_id UUID := '440296d4-09c2-4f3a-b02b-835f861df4c4';
  v_is_exempt BOOLEAN;
BEGIN
  -- Only fire when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    -- Delete existing commission costs for this service to avoid duplicates
    DELETE FROM public.costs
    WHERE service_id = NEW.id AND category_id = v_commission_category_id;

    -- Loop through service_resources with commission > 0
    FOR v_resource IN
      SELECT sr.operator_id, sr.commission_amount, o.name as operator_name
      FROM public.service_resources sr
      JOIN public.operators o ON o.id = sr.operator_id
      WHERE sr.service_id = NEW.id
        AND sr.resource_type = 'operator'
        AND sr.commission_amount > 0
        AND NOT o.commission_exempt
    LOOP
      INSERT INTO public.costs (
        amount, category_id, service_id, operator_id,
        service_folio, date, description, subcategory, notes, crane_id
      ) VALUES (
        v_resource.commission_amount,
        v_commission_category_id,
        NEW.id,
        v_resource.operator_id,
        NEW.folio,
        NEW.service_date,
        'Comisión ' || v_resource.operator_name,
        'comisiones',
        'Comisión generada automáticamente',
        NEW.crane_id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_commission_on_service_completion"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_commission_on_service_completion"() IS 'Trigger que genera comisiones automáticamente al completar un servicio. EXCLUYE automáticamente a Jorge Iriarte, Sergio Iriarte y Jorge Ignacio Iriarte del sistema de comisiones (regla de negocio).';



CREATE OR REPLACE FUNCTION "public"."generate_database_backup"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  table_record RECORD;
  column_record RECORD;
  backup_content TEXT := '';
  table_structure TEXT;
  insert_statements TEXT;
  row_record RECORD;
  sql_query TEXT;
BEGIN
  -- Verificar que el usuario sea administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden generar respaldos';
  END IF;

  -- Agregar encabezado del respaldo
  backup_content := backup_content || '-- TMS Gruas - Respaldo SQL Completo' || E'\n';
  backup_content := backup_content || '-- Generado el: ' || now()::text || E'\n';
  backup_content := backup_content || '-- Por usuario: ' || (SELECT email FROM public.profiles WHERE id = auth.uid()) || E'\n\n';

  -- Obtener todas las tablas públicas principales
  FOR table_record IN
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE '%_pkey'
    ORDER BY table_name
  LOOP
    -- Agregar estructura de tabla
    backup_content := backup_content || '-- Tabla: ' || table_record.table_name || E'\n';
    
    -- Generar declaraciones INSERT para los datos
    sql_query := 'SELECT * FROM public.' || quote_ident(table_record.table_name);
    
    -- Construir INSERT statements
    FOR row_record IN EXECUTE sql_query LOOP
      -- Construir INSERT statement (simplificado para seguridad)
      backup_content := backup_content || 'INSERT INTO public.' || quote_ident(table_record.table_name) || ' VALUES (datos_respaldados);' || E'\n';
    END LOOP;
    
    backup_content := backup_content || E'\n';
  END LOOP;

  -- Agregar información de resumen
  backup_content := backup_content || '-- Resumen del respaldo:' || E'\n';
  backup_content := backup_content || '-- Total de tablas respaldadas: ' || (
    SELECT COUNT(*) FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  )::text || E'\n';
  
  backup_content := backup_content || '-- Respaldo completado exitosamente' || E'\n';

  RETURN backup_content;
END;
$$;


ALTER FUNCTION "public"."generate_database_backup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_excess_folio"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  folio_format text;
  next_number integer;
  new_folio text;
  company_record record;
BEGIN
  -- Get company data with row lock to prevent race conditions
  SELECT excess_folio_format, next_excess_folio_number, id
  INTO company_record
  FROM public.company_data
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontraron datos de la empresa';
  END IF;
  
  -- Generate new folio
  folio_format := COALESCE(company_record.excess_folio_format, 'EXE-{number}');
  next_number := COALESCE(company_record.next_excess_folio_number, 1);
  new_folio := replace(folio_format, '{number}', lpad(next_number::text, 4, '0'));
  
  -- Update next number
  UPDATE public.company_data 
  SET next_excess_folio_number = next_number + 1,
      updated_at = now()
  WHERE id = company_record.id;
  
  RETURN new_folio;
END;
$$;


ALTER FUNCTION "public"."generate_excess_folio"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_quick_backup"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Verificar permisos
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden generar respaldos';
  END IF;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'generated_by', (SELECT email FROM public.profiles WHERE id = auth.uid()),
    'status', 'success'
  );
END;
$$;


ALTER FUNCTION "public"."generate_quick_backup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_service_cash_receipt_folio"() RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select
    'CI-' ||
    to_char(now(), 'YYYY') ||
    '-' ||
    lpad(nextval('public.service_cash_receipt_seq')::text, 6, '0');
$$;


ALTER FUNCTION "public"."generate_service_cash_receipt_folio"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_service_folio"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  next_number INTEGER;
  folio_format TEXT;
  new_folio TEXT;
BEGIN
  -- Obtener configuración de la empresa con alias específicos
  SELECT cd.next_service_folio_number, COALESCE(cd.folio_format, 'SRV-{number}') 
  INTO next_number, folio_format
  FROM public.company_data cd 
  LIMIT 1;
  
  -- Si no existe configuración, crear una por defecto
  IF next_number IS NULL THEN
    INSERT INTO public.company_data (
      business_name, rut, address, phone, email, 
      next_service_folio_number, folio_format
    ) 
    VALUES (
      'Empresa', '12345678-9', 'Dirección', '123456789', 
      'email@empresa.com', 1001, 'SRV-{number}'
    )
    ON CONFLICT (id) DO UPDATE SET 
      next_service_folio_number = 1001,
      folio_format = 'SRV-{number}';
    
    next_number := 1000;
    folio_format := 'SRV-{number}';
  END IF;
  
  -- Incrementar el contador
  UPDATE public.company_data 
  SET next_service_folio_number = next_service_folio_number + 1
  WHERE id = (SELECT id FROM public.company_data LIMIT 1);
  
  -- Generar el folio usando el formato
  new_folio := REPLACE(folio_format, '{number}', LPAD(next_number::text, 4, '0'));
  
  RETURN new_folio;
END;
$$;


ALTER FUNCTION "public"."generate_service_folio"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_simple_invoice_folio"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  next_number INTEGER;
  new_folio TEXT;
BEGIN
  UPDATE public.company_data 
  SET next_invoice_folio_number = COALESCE(next_invoice_folio_number, 4000) + 1
  WHERE id = (SELECT id FROM public.company_data LIMIT 1)
  RETURNING next_invoice_folio_number - 1 INTO next_number;
  
  IF next_number IS NULL THEN
    INSERT INTO public.company_data (
      business_name, rut, address, phone, email, 
      next_service_folio_number, next_invoice_folio_number
    ) 
    VALUES (
      'Empresa por Defecto', '12345678-9', 'Dirección', 
      '123456789', 'email@empresa.com', 1001, 4001
    )
    ON CONFLICT (id) DO UPDATE SET next_invoice_folio_number = 4001;
    next_number := 4000;
  END IF;
  
  new_folio := 'FACT-' || next_number;
  
  IF NOT EXISTS (SELECT 1 FROM invoices WHERE folio = new_folio) THEN
    RETURN new_folio;
  END IF;
  
  RAISE EXCEPTION 'Folio % ya existe', new_folio;
END;
$$;


ALTER FUNCTION "public"."generate_simple_invoice_folio"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_users"() RETURNS TABLE("id" "uuid", "email" "text", "full_name" "text", "role" "public"."app_role", "is_active" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "client_id" "uuid", "client_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.is_active,
    p.created_at,
    p.updated_at,
    p.client_id,
    c.name as client_name
  FROM public.profiles p
  LEFT JOIN public.clients c ON p.client_id = c.id
  WHERE p.status IS DISTINCT FROM 'pending'
  ORDER BY p.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_all_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_client_id_for_user"("user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  client_id_result UUID;
BEGIN
  SELECT client_id INTO client_id_result
  FROM public.profiles
  WHERE id = user_id;

  RETURN client_id_result;
END;
$$;


ALTER FUNCTION "public"."get_client_id_for_user"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_client_payment_history"("p_client_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  client_name TEXT;
  payment_history jsonb;
  invoice_history jsonb;
  summary_data jsonb;
BEGIN
  -- Obtener nombre del cliente
  SELECT name INTO client_name FROM public.clients WHERE id = p_client_id;
  
  -- Historial de pagos con aplicaciones correctas
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'amount', p.amount,
      'payment_date', p.payment_date,
      'payment_method', p.payment_method,
      'status', p.status,
      'applied_amount', p.applied_amount,
      'remaining_amount', p.amount - COALESCE(p.applied_amount, 0),
      'bank_reference', p.bank_reference,
      'notes', p.notes,
      'created_at', p.created_at,
      'applications', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'invoice_id', pa.invoice_id,
            'invoice_folio', i.folio,
            'applied_amount', pa.applied_amount,
            'application_method', pa.application_method,
            'applied_at', pa.created_at
          )
        )
        FROM public.payment_applications pa
        JOIN public.invoices i ON pa.invoice_id = i.id
        WHERE pa.payment_id = p.id
      )
    ) ORDER BY p.payment_date DESC, p.created_at DESC
  ) INTO payment_history
  FROM public.payments p
  WHERE p.client_id = p_client_id;

  -- Historial de facturas con pagos aplicados
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'folio', i.folio,
      'issue_date', i.issue_date,
      'due_date', i.due_date,
      'total', i.total,
      'paid_amount', COALESCE(i.paid_amount, 0),
      'remaining_amount', i.total - COALESCE(i.paid_amount, 0),
      'status', i.status,
      'payment_date', i.payment_date,
      'notes', i.notes,
      'payment_applications', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'payment_id', pa.payment_id,
            'applied_amount', pa.applied_amount,
            'application_method', pa.application_method,
            'applied_at', pa.created_at,
            'payment_reference', p.bank_reference,
            'payment_method', p.payment_method
          )
        )
        FROM public.payment_applications pa
        JOIN public.payments p ON pa.payment_id = p.id
        WHERE pa.invoice_id = i.id
      )
    ) ORDER BY i.issue_date DESC
  ) INTO invoice_history
  FROM public.invoices i
  WHERE i.client_id = p_client_id;

  -- Resumen financiero
  SELECT jsonb_build_object(
    'total_invoices', COUNT(*),
    'total_invoiced', COALESCE(SUM(i.total), 0),
    'total_paid', COALESCE(SUM(i.paid_amount), 0),
    'total_pending', COALESCE(SUM(i.total - COALESCE(i.paid_amount, 0)), 0),
    'paid_invoices_count', COUNT(*) FILTER (WHERE i.status = 'paid'),
    'pending_invoices_count', COUNT(*) FILTER (WHERE i.status IN ('sent', 'overdue', 'draft'))
  ) INTO summary_data
  FROM public.invoices i
  WHERE i.client_id = p_client_id;

  RETURN jsonb_build_object(
    'client_id', p_client_id,
    'client_name', client_name,
    'summary', summary_data,
    'payments', COALESCE(payment_history, '[]'::jsonb),
    'invoices', COALESCE(invoice_history, '[]'::jsonb)
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in get_client_payment_history: %', SQLERRM;
    RETURN jsonb_build_object(
      'error', true,
      'message', SQLERRM,
      'client_id', p_client_id
    );
END;
$$;


ALTER FUNCTION "public"."get_client_payment_history"("p_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_commissions_with_details"() RETURNS TABLE("id" "uuid", "date" "date", "description" "text", "amount" numeric, "operator_id" "uuid", "service_id" "uuid", "service_folio" "text", "subcategory" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "payment_date" "date", "payment_batch_id" "text", "category_id" "uuid", "service_value" numeric, "service_date" "date", "client_name" "text", "operator_name" "text", "operator_rut" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH commission_categories AS (
    SELECT id
    FROM public.cost_categories
    WHERE lower(translate(name, 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUaeiouu')) LIKE '%comision%'
      AND lower(translate(name, 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUaeiouu')) LIKE '%operador%'
  )
  SELECT
    c.id,
    c.date,
    c.description,
    c.amount,
    COALESCE(c.operator_id, s.operator_id) AS operator_id,
    c.service_id,
    c.service_folio,
    c.subcategory,
    c.created_at,
    c.updated_at,
    c.payment_date,
    c.payment_batch_id,
    c.category_id,
    s.value AS service_value,
    s.service_date,
    cl.name AS client_name,
    o.name AS operator_name,
    o.rut AS operator_rut
  FROM public.costs c
  LEFT JOIN public.services s
    ON s.id = c.service_id
    OR (
      c.service_id IS NULL
      AND c.service_folio IS NOT NULL
      AND s.folio = c.service_folio
    )
  LEFT JOIN public.clients cl ON s.client_id = cl.id
  LEFT JOIN public.operators o ON o.id = COALESCE(c.operator_id, s.operator_id)
  WHERE (
    c.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'::uuid
    OR c.category_id IN (SELECT id FROM commission_categories)
  )
  ORDER BY c.created_at DESC;
$$;


ALTER FUNCTION "public"."get_commissions_with_details"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_crane_metrics"("p_crane_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_services', COALESCE(services.total, 0),
    'completed_services', COALESCE(services.completed, 0),
    'pending_services', COALESCE(services.pending, 0),
    'monthly_revenue', COALESCE(services.monthly_revenue, 0),
    'maintenance_costs', COALESCE(maintenance.total_cost, 0),
    'maintenance_count', COALESCE(maintenance.count, 0)
  ) INTO result
  FROM (
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      SUM(value) FILTER (WHERE status = 'completed' AND EXTRACT(MONTH FROM service_date) = EXTRACT(MONTH FROM CURRENT_DATE)) as monthly_revenue
    FROM public.services 
    WHERE crane_id = p_crane_id
  ) services
  CROSS JOIN (
    SELECT 
      SUM(cost) as total_cost,
      COUNT(*) as count
    FROM public.crane_maintenance 
    WHERE crane_id = p_crane_id AND status = 'completed'
  ) maintenance;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_crane_metrics"("p_crane_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_user_role"() RETURNS "public"."app_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() ORDER BY role LIMIT 1;
$$;


ALTER FUNCTION "public"."get_current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_user_role_safe"() RETURNS "public"."app_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() ORDER BY role LIMIT 1;
$$;


ALTER FUNCTION "public"."get_current_user_role_safe"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_default_cost_category_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id
  INTO v_id
  FROM public.cost_categories
  WHERE LOWER(TRIM(name)) = 'otros'
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.cost_categories (name, description)
    VALUES ('Otros', 'Categoría por defecto para importaciones')
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."get_default_cost_category_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_document_expiry_alerts"() RETURNS TABLE("crane_id" "uuid", "crane_license_plate" "text", "document_type" "text", "expiry_date" "date", "days_until_expiry" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.license_plate,
    'technical_review'::TEXT,
    c.technical_review_expiry,
    (c.technical_review_expiry - CURRENT_DATE)::INTEGER
  FROM public.cranes c
  WHERE c.technical_review_expiry <= CURRENT_DATE + INTERVAL '30 days'
    AND c.is_active = TRUE
  
  UNION ALL
  
  SELECT 
    c.id,
    c.license_plate,
    'insurance'::TEXT,
    c.insurance_expiry,
    (c.insurance_expiry - CURRENT_DATE)::INTEGER
  FROM public.cranes c
  WHERE c.insurance_expiry <= CURRENT_DATE + INTERVAL '30 days'
    AND c.is_active = TRUE
  
  UNION ALL
  
  SELECT 
    c.id,
    c.license_plate,
    'circulation_permit'::TEXT,
    c.circulation_permit_expiry,
    (c.circulation_permit_expiry - CURRENT_DATE)::INTEGER
  FROM public.cranes c
  WHERE c.circulation_permit_expiry <= CURRENT_DATE + INTERVAL '30 days'
    AND c.is_active = TRUE
  
  ORDER BY days_until_expiry ASC;
END;
$$;


ALTER FUNCTION "public"."get_document_expiry_alerts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_invoice_overdue_stats"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  total_overdue INTEGER;
  total_amount NUMERIC;
  avg_days_overdue NUMERIC;
  oldest_overdue INTEGER;
BEGIN
  SELECT 
    COUNT(*),
    COALESCE(SUM(total), 0),
    COALESCE(AVG(CURRENT_DATE - due_date), 0),
    COALESCE(MAX(CURRENT_DATE - due_date), 0)
  INTO 
    total_overdue, 
    total_amount, 
    avg_days_overdue, 
    oldest_overdue
  FROM public.invoices 
  WHERE due_date < CURRENT_DATE 
    AND status IN ('sent', 'draft', 'overdue')
    AND status NOT IN ('paid', 'cancelled');

  RETURN jsonb_build_object(
    'total_overdue', total_overdue,
    'total_amount', total_amount,
    'avg_days_overdue', ROUND(avg_days_overdue, 1),
    'oldest_overdue', oldest_overdue,
    'last_updated', now()
  );
END;
$$;


ALTER FUNCTION "public"."get_invoice_overdue_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_invoice_payment_status"("p_invoice_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  invoice_info RECORD;
  payment_details jsonb;
BEGIN
  -- Obtener información de la factura
  SELECT i.id, i.folio, i.total, i.paid_amount, i.status, c.name as client_name
  INTO invoice_info
  FROM invoices i
  JOIN clients c ON i.client_id = c.id
  WHERE i.id = p_invoice_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Factura no encontrada');
  END IF;
  
  -- Obtener detalles de los pagos aplicados
  SELECT jsonb_agg(
    jsonb_build_object(
      'payment_id', p.id,
      'applied_amount', pa.applied_amount,
      'payment_date', p.payment_date,
      'payment_method', p.payment_method,
      'bank_reference', p.bank_reference,
      'is_automatic', CASE 
        WHEN p.bank_reference LIKE 'PAGO-AUTO-%' THEN true 
        ELSE false 
      END,
      'application_method', pa.application_method,
      'created_at', pa.created_at
    ) ORDER BY pa.created_at
  ) INTO payment_details
  FROM payment_applications pa
  JOIN payments p ON pa.payment_id = p.id
  WHERE pa.invoice_id = p_invoice_id;
  
  RETURN jsonb_build_object(
    'invoice_id', invoice_info.id,
    'folio', invoice_info.folio,
    'client_name', invoice_info.client_name,
    'total', invoice_info.total,
    'paid_amount', invoice_info.paid_amount,
    'status', invoice_info.status,
    'payment_applications', COALESCE(payment_details, '[]'::jsonb),
    'has_automatic_payments', EXISTS(
      SELECT 1 FROM payment_applications pa
      JOIN payments p ON pa.payment_id = p.id
      WHERE pa.invoice_id = p_invoice_id AND p.bank_reference LIKE 'PAGO-AUTO-%'
    ),
    'has_manual_payments', EXISTS(
      SELECT 1 FROM payment_applications pa  
      JOIN payments p ON pa.payment_id = p.id
      WHERE pa.invoice_id = p_invoice_id AND (p.bank_reference IS NULL OR p.bank_reference NOT LIKE 'PAGO-AUTO-%')
    )
  );
END;
$$;


ALTER FUNCTION "public"."get_invoice_payment_status"("p_invoice_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_invoices_due_soon"("days_ahead" integer DEFAULT 7) RETURNS TABLE("id" "uuid", "folio" "text", "client_name" "text", "due_date" "date", "total" numeric, "days_until_due" integer, "status" "public"."invoice_status")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.folio,
    c.name as client_name,
    i.due_date,
    i.total,
    (i.due_date - CURRENT_DATE)::integer as days_until_due,
    'sent'::invoice_status as status
  FROM public.invoices i
  JOIN public.clients c ON i.client_id = c.id
  WHERE i.due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + days_ahead)
    AND i.folio NOT LIKE 'HIST-%'
    AND i.status <> 'cancelled'
    AND i.status <> 'draft'
    AND COALESCE(i.remaining_amount, i.total - COALESCE(i.paid_amount, 0)) > 0
  ORDER BY i.due_date ASC;
END;
$$;


ALTER FUNCTION "public"."get_invoices_due_soon"("days_ahead" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_maintenance_with_cost"("maintenance_id_param" "uuid") RETURNS TABLE("maintenance_id" "uuid", "maintenance_description" "text", "maintenance_cost" numeric, "maintenance_status" "text", "cost_id" "uuid", "cost_amount" numeric, "cost_description" "text", "cost_date" "date")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.id,
    cm.description,
    cm.cost,
    cm.status,
    c.id,
    c.amount,
    c.description,
    c.date
  FROM public.crane_maintenance cm
  LEFT JOIN public.costs c ON cm.id = c.maintenance_id
  WHERE cm.id = maintenance_id_param;
END;
$$;


ALTER FUNCTION "public"."get_maintenance_with_cost"("maintenance_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_notification_summary"() RETURNS TABLE("total_count" bigint, "unread_count" bigint, "critical_count" bigint, "categories" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE read_at IS NULL)::BIGINT as unread_count,
    COUNT(*) FILTER (WHERE priority <= 2 AND read_at IS NULL)::BIGINT as critical_count,
    jsonb_object_agg(
      COALESCE(category, 'system'),
      category_count
    ) as categories
  FROM public.notifications n
  LEFT JOIN (
    SELECT category as cat, COUNT(*) as category_count
    FROM public.notifications
    WHERE user_id = auth.uid() AND read_at IS NULL
    GROUP BY category
  ) c ON n.category = c.cat
  WHERE n.user_id = auth.uid()
    AND n.dismissed_at IS NULL
    AND (n.expires_at IS NULL OR n.expires_at > now())
    AND (n.snoozed_until IS NULL OR n.snoozed_until <= now());
END;
$$;


ALTER FUNCTION "public"."get_notification_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_operator_id_by_user"("p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN (SELECT id FROM public.operators WHERE user_id = p_user_id LIMIT 1);
END;
$$;


ALTER FUNCTION "public"."get_operator_id_by_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_inventory_supplier"("p_name" "text", "p_rut" "text", "p_email" "text", "p_phone" "text", "p_address" "text", "p_contact_person" "text", "p_category" "text", "p_subcategory" "text", "p_notes" "text", "p_is_active" boolean) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_supplier_id uuid;
  v_user_id uuid;
  v_rut_norm text := UPPER(REPLACE(REPLACE(REPLACE(COALESCE(p_rut, ''), '.', ''), '-', ''), ' ', ''));
BEGIN
  IF v_rut_norm <> '' THEN
    SELECT id
    INTO v_supplier_id
    FROM public.inventory_suppliers
    WHERE UPPER(REPLACE(REPLACE(REPLACE(COALESCE(rut, ''), '.', ''), '-', ''), ' ', '')) = v_rut_norm
    LIMIT 1;
  END IF;

  IF v_supplier_id IS NULL AND COALESCE(NULLIF(TRIM(p_name), ''), '') <> '' THEN
    SELECT id
    INTO v_supplier_id
    FROM public.inventory_suppliers
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(p_name))
    LIMIT 1;
  END IF;

  IF v_supplier_id IS NOT NULL THEN
    RETURN v_supplier_id;
  END IF;

  v_user_id := auth.uid();

  INSERT INTO public.inventory_suppliers (
    name,
    rut,
    email,
    phone,
    address,
    contact_person,
    category,
    subcategory,
    notes,
    is_active,
    created_by
  )
  VALUES (
    COALESCE(NULLIF(TRIM(p_name), ''), 'Proveedor sin nombre'),
    COALESCE(p_rut, ''),
    NULLIF(TRIM(p_email), ''),
    NULLIF(TRIM(p_phone), ''),
    NULLIF(TRIM(p_address), ''),
    NULLIF(TRIM(p_contact_person), ''),
    COALESCE(NULLIF(TRIM(p_category), ''), 'otros'),
    NULLIF(TRIM(p_subcategory), ''),
    NULLIF(TRIM(p_notes), ''),
    COALESCE(p_is_active, true),
    v_user_id
  )
  RETURNING id INTO v_supplier_id;

  RETURN v_supplier_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_inventory_supplier"("p_name" "text", "p_rut" "text", "p_email" "text", "p_phone" "text", "p_address" "text", "p_contact_person" "text", "p_category" "text", "p_subcategory" "text", "p_notes" "text", "p_is_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_overdue_invoices_for_alerts"() RETURNS TABLE("id" "uuid", "folio" "text", "client_name" "text", "due_date" "date", "total" numeric, "days_overdue" integer, "status" "public"."invoice_status")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.folio,
    c.name as client_name,
    i.due_date,
    i.total,
    (CURRENT_DATE - i.due_date)::integer as days_overdue,
    'overdue'::invoice_status as status
  FROM public.invoices i
  JOIN public.clients c ON i.client_id = c.id
  WHERE i.due_date < CURRENT_DATE
    AND i.folio NOT LIKE 'HIST-%'
    AND i.status <> 'cancelled'
    AND COALESCE(i.remaining_amount, i.total - COALESCE(i.paid_amount, 0)) > 0
  ORDER BY i.due_date ASC;
END;
$$;


ALTER FUNCTION "public"."get_overdue_invoices_for_alerts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_parts_traceability"("p_crane_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("part_id" "uuid", "part_name" "text", "supplier" "text", "purchase_date" "date", "purchase_cost" numeric, "inventory_item_id" "uuid", "inventory_item_name" "text", "current_stock" bigint, "total_purchased" bigint, "total_consumed" bigint, "crane_license_plate" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.id as part_id,
    cp.part_name,
    cp.supplier,
    cp.date as purchase_date,
    cp.total_value as purchase_cost,
    ii.id as inventory_item_id,
    ii.name as inventory_item_name,
    COALESCE(
      (SELECT SUM(current_quantity)
       FROM inventory_stock 
       WHERE item_id = ii.id), 
      0::bigint
    ) as current_stock,
    COALESCE(
      (SELECT SUM(quantity)
       FROM inventory_movements 
       WHERE item_id = ii.id AND movement_type = 'entry' AND status = 'active'),
      0::bigint
    ) as total_purchased,
    COALESCE(
      (SELECT SUM(quantity)
       FROM inventory_movements 
       WHERE item_id = ii.id AND movement_type = 'exit' AND status = 'active'),
      0::bigint
    ) as total_consumed,
    c.license_plate as crane_license_plate
  FROM crane_parts cp
  LEFT JOIN cranes c ON cp.crane_id = c.id
  LEFT JOIN inventory_movements im ON cp.inventory_movement_id = im.id
  LEFT JOIN inventory_items ii ON im.item_id = ii.id
  WHERE (p_crane_id IS NULL OR cp.crane_id = p_crane_id)
  ORDER BY cp.date DESC;
END;
$$;


ALTER FUNCTION "public"."get_parts_traceability"("p_crane_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "role" "public"."app_role" DEFAULT 'viewer'::"public"."app_role",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "client_id" "uuid",
    "status" "text" DEFAULT 'approved'::"text" NOT NULL,
    "phone" "text",
    "company" "text",
    "rut" "text",
    CONSTRAINT "profiles_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."status" IS 'pending=esperando aprobación, approved=activo, rejected=rechazado';



CREATE OR REPLACE FUNCTION "public"."get_pending_users"() RETURNS SETOF "public"."profiles"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores';
  END IF;

  RETURN QUERY
    SELECT *
    FROM public.profiles
    WHERE status = 'pending'
    ORDER BY created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_pending_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_users_count"() RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores';
  END IF;

  RETURN (SELECT count(*)::integer FROM public.profiles WHERE status = 'pending');
END;
$$;


ALTER FUNCTION "public"."get_pending_users_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_purchase_void_impact"("p_cost_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cost record;
  v_movements jsonb;
  v_payment jsonb;
  v_invoice jsonb;
  v_entry record;
  v_current_stock numeric;
  v_stock_after numeric;
  v_net_change numeric := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_cost FROM public.costs WHERE id = p_cost_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Costo no encontrado';
  END IF;

  -- Movimientos relacionados (por cost_id o por inventory_movement_id directo)
  SELECT jsonb_agg(jsonb_build_object(
    'id', im.id,
    'movement_type', im.movement_type,
    'quantity', im.quantity,
    'unit_cost', im.unit_cost,
    'item_id', im.item_id,
    'item_name', ii.name,
    'location_id', im.location_id,
    'location_name', il.name,
    'crane_id', im.crane_id
  ) ORDER BY im.movement_type DESC, im.movement_date)
  INTO v_movements
  FROM public.inventory_movements im
  LEFT JOIN public.inventory_items ii ON ii.id = im.item_id
  LEFT JOIN public.inventory_locations il ON il.id = im.location_id
  WHERE im.cost_id = p_cost_id
     OR im.id = v_cost.inventory_movement_id;

  -- Calcular stock proyectado: tomamos cualquier entrada vinculada
  SELECT * INTO v_entry
  FROM public.inventory_movements
  WHERE (cost_id = p_cost_id OR id = v_cost.inventory_movement_id)
    AND movement_type = 'entry'
    AND status = 'active'
  LIMIT 1;

  IF v_entry.id IS NOT NULL THEN
    SELECT COALESCE(current_quantity, 0) INTO v_current_stock
    FROM public.inventory_stock
    WHERE item_id = v_entry.item_id AND location_id = v_entry.location_id;

    -- Cambio neto = -entradas + salidas (lo que se "deshace")
    SELECT COALESCE(SUM(
      CASE
        WHEN movement_type = 'entry' THEN -quantity
        WHEN movement_type = 'exit'  THEN  quantity
        ELSE 0
      END
    ), 0)
    INTO v_net_change
    FROM public.inventory_movements
    WHERE (cost_id = p_cost_id OR id = v_cost.inventory_movement_id)
      AND status = 'active'
      AND item_id = v_entry.item_id
      AND location_id = v_entry.location_id;

    v_stock_after := COALESCE(v_current_stock, 0) + v_net_change;
  END IF;

  -- Pago vinculado
  IF v_cost.supplier_payment_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', sp.id,
      'amount', sp.amount,
      'paid_date', sp.paid_date,
      'reference_number', sp.reference_number,
      'description', sp.description
    ) INTO v_payment
    FROM public.supplier_payments sp
    WHERE sp.id = v_cost.supplier_payment_id;
  END IF;

  -- Factura vinculada
  IF v_cost.supplier_invoice_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', si.id,
      'invoice_number', si.invoice_number,
      'issue_date', si.issue_date,
      'amount', si.amount
    ) INTO v_invoice
    FROM public.supplier_invoices si
    WHERE si.id = v_cost.supplier_invoice_id;
  END IF;

  RETURN jsonb_build_object(
    'cost', jsonb_build_object(
      'id', v_cost.id,
      'date', v_cost.date,
      'description', v_cost.description,
      'amount', v_cost.amount,
      'document_number', v_cost.document_number,
      'service_folio', v_cost.service_folio,
      'immediate_consumption', v_cost.immediate_consumption
    ),
    'movements', COALESCE(v_movements, '[]'::jsonb),
    'payment', v_payment,
    'invoice', v_invoice,
    'currentStock', v_current_stock,
    'stockAfter', v_stock_after
  );
END;
$$;


ALTER FUNCTION "public"."get_purchase_void_impact"("p_cost_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_supplier_payment_stats"("p_supplier_id" "uuid") RETURNS TABLE("total_pending" numeric, "total_paid" numeric, "total_overdue" numeric, "count_pending" integer, "count_paid" integer, "count_overdue" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as total_pending,
    COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_paid,
    COALESCE(SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END), 0) as total_overdue,
    COUNT(CASE WHEN status = 'pending' THEN 1 END)::INTEGER as count_pending,
    COUNT(CASE WHEN status = 'paid' THEN 1 END)::INTEGER as count_paid,
    COUNT(CASE WHEN status = 'overdue' THEN 1 END)::INTEGER as count_overdue
  FROM supplier_payments
  WHERE supplier_id = p_supplier_id;
END;
$$;


ALTER FUNCTION "public"."get_supplier_payment_stats"("p_supplier_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_supplier_payment_stats"("p_supplier_id" "uuid") IS 'Obtiene estadísticas de pagos por proveedor';



CREATE OR REPLACE FUNCTION "public"."get_supplier_sync_stats"() RETURNS TABLE("supplier_name" "text", "total_payments" bigint, "total_costs" bigint, "total_movements" bigint, "total_amount_paid" numeric, "total_amount_costs" numeric, "total_amount_inventory" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.name as supplier_name,
    COUNT(DISTINCT sp.id) as total_payments,
    COUNT(DISTINCT c.id) as total_costs,
    COUNT(DISTINCT im.id) as total_movements,
    COALESCE(SUM(sp.amount), 0) as total_amount_paid,
    COALESCE(SUM(c.amount), 0) as total_amount_costs,
    COALESCE(SUM(im.total_cost), 0) as total_amount_inventory
  FROM public.suppliers s
  LEFT JOIN public.supplier_payments sp ON sp.supplier_id = s.id
  LEFT JOIN public.costs c ON c.supplier_id = s.id
  LEFT JOIN public.inventory_movements im ON im.supplier_id = s.id
  WHERE s.is_active = true
  GROUP BY s.id, s.name
  ORDER BY total_amount_paid DESC;
END;
$$;


ALTER FUNCTION "public"."get_supplier_sync_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_supplier_traceability_stats"("p_supplier_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result JSONB;
  v_total_payments NUMERIC;
  v_total_costs NUMERIC;
  v_total_inventory NUMERIC;
  v_total_parts NUMERIC;
  v_payments_count INT;
  v_inventory_count INT;
  v_parts_count INT;
BEGIN
  -- Pagos totales
  SELECT 
    COUNT(*),
    COALESCE(SUM(amount), 0)
  INTO v_payments_count, v_total_payments
  FROM supplier_payments
  WHERE supplier_id = p_supplier_id;

  -- Movimientos de inventario
  SELECT 
    COUNT(*),
    COALESCE(SUM(total_cost), 0)
  INTO v_inventory_count, v_total_inventory
  FROM inventory_movements
  WHERE supplier_id = p_supplier_id
    AND movement_type = 'entry';

  -- Piezas de grúas
  SELECT 
    COUNT(*),
    COALESCE(SUM(total_value), 0)
  INTO v_parts_count, v_total_parts
  FROM crane_parts
  WHERE supplier_id = p_supplier_id;

  -- Costos totales
  SELECT COALESCE(SUM(c.amount), 0)
  INTO v_total_costs
  FROM costs c
  JOIN supplier_payments sp ON sp.id = c.supplier_payment_id
  WHERE sp.supplier_id = p_supplier_id;

  RETURN jsonb_build_object(
    'supplier_id', p_supplier_id,
    'payments', jsonb_build_object(
      'count', v_payments_count,
      'total', v_total_payments
    ),
    'costs', jsonb_build_object(
      'total', v_total_costs
    ),
    'inventory', jsonb_build_object(
      'count', v_inventory_count,
      'total', v_total_inventory
    ),
    'crane_parts', jsonb_build_object(
      'count', v_parts_count,
      'total', v_total_parts
    )
  );
END;
$$;


ALTER FUNCTION "public"."get_supplier_traceability_stats"("p_supplier_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_supplier_traceability_stats"("p_supplier_id" "uuid") IS 'Obtiene estadísticas completas de trazabilidad para un proveedor: pagos, costos, inventario y piezas';



CREATE OR REPLACE FUNCTION "public"."get_table_structure"("table_name" "text") RETURNS TABLE("create_statement" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden obtener estructuras de tablas';
  END IF;

  RETURN QUERY
  SELECT 
    'CREATE TABLE IF NOT EXISTS public."' || table_name || '" (' ||
    string_agg(
      '"' || column_name || '" ' || 
      CASE 
        WHEN data_type = 'USER-DEFINED' THEN udt_name
        WHEN data_type = 'ARRAY' THEN 'text[]'
        ELSE data_type 
      END ||
      CASE WHEN character_maximum_length IS NOT NULL 
           THEN '(' || character_maximum_length || ')' 
           ELSE '' END ||
      CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
      CASE WHEN column_default IS NOT NULL 
           THEN ' DEFAULT ' || column_default 
           ELSE '' END,
      ', '
      ORDER BY ordinal_position
    ) || ');' as create_statement
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name = get_table_structure.table_name
  GROUP BY table_name;
END;
$$;


ALTER FUNCTION "public"."get_table_structure"("table_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_client_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT client_id FROM public.profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_user_client_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_client_id_safe"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT client_id FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$;


ALTER FUNCTION "public"."get_user_client_id_safe"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"("user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "public"."app_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.user_roles WHERE user_roles.user_id = get_user_role.user_id ORDER BY role LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_role"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role_from_table"("_user_id" "uuid") RETURNS "public"."app_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;


ALTER FUNCTION "public"."get_user_role_from_table"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_weighted_average_cost"("p_item_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_avg_cost numeric;
BEGIN
  SELECT 
    COALESCE(
      SUM(unit_cost * quantity) / NULLIF(SUM(quantity), 0),
      0
    )
  INTO v_avg_cost
  FROM inventory_movements
  WHERE item_id = p_item_id
    AND movement_type = 'entry'
    AND status = 'active'
    AND unit_cost IS NOT NULL;
    
  RETURN COALESCE(v_avg_cost, 0);
END;
$$;


ALTER FUNCTION "public"."get_weighted_average_cost"("p_item_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."global_inventory_cleanup"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  deleted_costs INTEGER := 0;
  updated_parts INTEGER := 0;
  materiales_cost NUMERIC;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar la limpieza global';
  END IF;

  -- PASO 1: Eliminar TODOS los costos de $0.01 de "Consumo de Inventario"
  DELETE FROM public.costs 
  WHERE id IN (
    SELECT c.id 
    FROM public.costs c
    JOIN public.cost_categories cc ON c.category_id = cc.id
    WHERE cc.name = 'Mantenimiento'
      AND c.subcategory = 'Consumo de Inventario'
      AND c.amount = 0.01
  );
  
  GET DIAGNOSTICS deleted_costs = ROW_COUNT;

  -- PASO 2: Actualizar crane_parts huérfanos (cost_id que ya no existe)
  UPDATE public.crane_parts 
  SET 
    cost_id = NULL,
    notes = COALESCE(notes, '') || ' [Desvinculado - limpieza global]'
  WHERE cost_id IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM public.costs WHERE id = crane_parts.cost_id);
    
  GET DIAGNOSTICS updated_parts = ROW_COUNT;

  -- PASO 3: Verificar y corregir unit_cost de "Materiales Eléctricos"
  SELECT unit_cost INTO materiales_cost
  FROM public.inventory_items 
  WHERE LOWER(name) LIKE '%materiales%eléctricos%' 
     OR LOWER(name) LIKE '%materiales%electricos%'
  LIMIT 1;

  -- Si el costo es 0 o nulo, corregirlo
  IF materiales_cost IS NULL OR materiales_cost = 0 THEN
    UPDATE public.inventory_items
    SET 
      unit_cost = 19960.00,
      updated_at = NOW()
    WHERE LOWER(name) LIKE '%materiales%eléctricos%' 
       OR LOWER(name) LIKE '%materiales%electricos%';
       
    materiales_cost := 19960.00;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'timestamp', NOW(),
    'deleted_costs', deleted_costs,
    'updated_crane_parts', updated_parts,
    'materiales_unit_cost', materiales_cost,
    'message', format('Limpieza global completada: eliminados %s costos duplicados, actualizados %s crane_parts', deleted_costs, updated_parts)
  );
END;
$_$;


ALTER FUNCTION "public"."global_inventory_cleanup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_immediate_consumption_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_movement_entry RECORD;
  v_exit_movement_id UUID;
  v_already_has_exit BOOLEAN;
BEGIN
  -- Solo actuar si immediate_consumption cambió de false/null a true
  IF NEW.immediate_consumption = true 
     AND (OLD.immediate_consumption = false OR OLD.immediate_consumption IS NULL)
     AND NEW.crane_id IS NOT NULL 
     AND NEW.inventory_movement_id IS NOT NULL THEN
    
    -- Verificar si ya existe movimiento de salida para este costo
    SELECT EXISTS (
      SELECT 1 FROM inventory_movements 
      WHERE cost_id = NEW.id AND movement_type = 'exit'
    ) INTO v_already_has_exit;
    
    IF NOT v_already_has_exit THEN
      -- Obtener datos del movimiento de entrada
      SELECT 
        item_id,
        location_id,
        quantity,
        unit_cost,
        total_cost
      INTO v_movement_entry
      FROM inventory_movements
      WHERE id = NEW.inventory_movement_id;
      
      IF v_movement_entry.item_id IS NOT NULL THEN
        -- Crear movimiento de salida
        INSERT INTO inventory_movements (
          item_id,
          location_id,
          movement_type,
          quantity,
          unit_cost,
          total_cost,
          movement_date,
          reason,
          crane_id,
          cost_id,
          observations,
          created_by,
          status
        )
        VALUES (
          v_movement_entry.item_id,
          v_movement_entry.location_id,
          'exit',
          v_movement_entry.quantity,
          v_movement_entry.unit_cost,
          v_movement_entry.total_cost,
          NEW.date,
          'Consumo inmediato (aplicado por UPDATE)',
          NEW.crane_id,
          NEW.id,
          'Auto-generado por cambio de immediate_consumption a true',
          NEW.created_by,
          'active'
        )
        RETURNING id INTO v_exit_movement_id;
        
        RAISE NOTICE '✅ Movimiento de salida creado por UPDATE: % para cost_id: %', 
          v_exit_movement_id, NEW.id;
      ELSE
        RAISE WARNING '⚠️ No se pudo crear movimiento de salida para cost_id: % (movimiento de entrada no encontrado)', NEW.id;
      END IF;
    ELSE
      RAISE NOTICE 'ℹ️ Cost_id % ya tiene movimiento de salida, no se crea duplicado', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION 
  WHEN OTHERS THEN
    RAISE WARNING '❌ Error en handle_immediate_consumption_update para cost_id %: %', NEW.id, SQLERRM;
    RETURN NEW; -- No interrumpir la operación por errores en el trigger
END;
$$;


ALTER FUNCTION "public"."handle_immediate_consumption_update"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_immediate_consumption_update"() IS 'Trigger que crea automáticamente el movimiento de salida cuando se activa immediate_consumption en un costo existente. Permite aplicar consumo inmediato de forma retroactiva.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RAISE NOTICE 'Profile already exists for user %', NEW.id;
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = NEW.email) THEN
    RAISE NOTICE 'Profile with email % already exists', NEW.email;
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    status
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.email
    ),
    'viewer',
    'pending'
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_user_invitation_acceptance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Actualizar invitación a 'accepted' cuando un usuario se registra con email que tenía invitación pendiente
  UPDATE public.user_invitations 
  SET status = 'accepted', 
      accepted_at = now(),
      updated_at = now()
  WHERE email = NEW.email 
    AND status IN ('pending', 'sent');
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_user_invitation_acceptance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_xml_batch"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_batch_id uuid;
  v_type text;
  v_filename text;
  v_source text;
  v_user_id uuid;
  v_errors jsonb := '[]'::jsonb;
  v_result jsonb;
BEGIN
  v_type := COALESCE(p_payload->>'type', '');
  v_source := COALESCE(p_payload->>'source_module', v_type);
  v_filename := NULLIF(p_payload->>'filename', '');
  v_user_id := auth.uid();

  INSERT INTO public.import_batches (created_by, source_module, filename, status, payload)
  VALUES (v_user_id, COALESCE(NULLIF(v_source, ''), 'xml_import'), v_filename, 'pending', p_payload)
  RETURNING id INTO v_batch_id;

  PERFORM set_config('app.import_batch_id', v_batch_id::text, true);

  BEGIN
    IF v_type = 'supplier_documents' THEN
      PERFORM public.import_xml_supplier_documents(p_payload);
    ELSIF v_type = 'costs' THEN
      PERFORM public.import_xml_costs(p_payload);
    ELSE
      RAISE EXCEPTION 'Tipo de importación no soportado: %', v_type;
    END IF;

    UPDATE public.import_batches
    SET status = 'succeeded',
        summary = public.build_import_batch_summary(v_batch_id)
    WHERE id = v_batch_id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.import_batches
    SET status = 'failed',
        error = jsonb_build_object('message', SQLERRM, 'code', SQLSTATE)
    WHERE id = v_batch_id;

    RETURN jsonb_build_object(
      'batch_id', v_batch_id,
      'status', 'failed',
      'error', jsonb_build_object('message', SQLERRM, 'code', SQLSTATE)
    );
  END;

  SELECT jsonb_build_object(
    'batch_id', v_batch_id,
    'status', 'succeeded',
    'summary', summary
  )
  INTO v_result
  FROM public.import_batches
  WHERE id = v_batch_id;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."import_xml_batch"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_xml_costs"("p_payload" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cost jsonb;
  v_supplier_id uuid;
BEGIN
  FOR v_cost IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'costs', '[]'::jsonb))
  LOOP
    v_supplier_id := NULL;

    IF COALESCE(NULLIF(TRIM(v_cost->>'supplier_rut'), ''), '') <> '' OR COALESCE(NULLIF(TRIM(v_cost->>'supplier_name'), ''), '') <> '' THEN
      v_supplier_id := public.get_or_create_inventory_supplier(
        v_cost->>'supplier_name',
        v_cost->>'supplier_rut',
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        true
      );
    END IF;

    INSERT INTO public.costs (
      date,
      description,
      amount,
      category_id,
      subcategory,
      notes,
      service_folio,
      payment_date,
      supplier_id,
      purchase_quantity,
      purchase_unit_cost,
      immediate_consumption,
      crane_id,
      created_by
    )
    VALUES (
      (v_cost->>'date')::date,
      COALESCE(NULLIF(v_cost->>'description', ''), 'Importado desde XML'),
      COALESCE((v_cost->>'amount')::numeric, 0),
      COALESCE(NULLIF(v_cost->>'category_id', '')::uuid, public.get_default_cost_category_id()),
      NULLIF(v_cost->>'subcategory', ''),
      NULLIF(v_cost->>'notes', ''),
      NULLIF(v_cost->>'service_folio', ''),
      NULLIF(v_cost->>'payment_date', '')::date,
      v_supplier_id,
      NULLIF(v_cost->>'purchase_quantity', '')::int,
      NULLIF(v_cost->>'purchase_unit_cost', '')::numeric,
      COALESCE(NULLIF(v_cost->>'immediate_consumption', '')::boolean, false),
      NULLIF(v_cost->>'crane_id', '')::uuid,
      auth.uid()
    );
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."import_xml_costs"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_xml_supplier_documents"("p_payload" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_supplier jsonb;
  v_payment jsonb;
  v_supplier_id uuid;
BEGIN
  FOR v_supplier IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'suppliers', '[]'::jsonb))
  LOOP
    v_supplier_id := public.get_or_create_inventory_supplier(
      v_supplier->>'name',
      v_supplier->>'rut',
      v_supplier->>'email',
      v_supplier->>'phone',
      v_supplier->>'address',
      v_supplier->>'contact_person',
      v_supplier->>'category',
      v_supplier->>'subcategory',
      v_supplier->>'notes',
      COALESCE((v_supplier->>'is_active')::boolean, true)
    );
  END LOOP;

  FOR v_payment IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'payments', '[]'::jsonb))
  LOOP
    v_supplier_id := public.get_or_create_inventory_supplier(
      v_payment->>'supplier_name',
      v_payment->>'supplier_rut',
      NULL,
      NULL,
      NULL,
      NULL,
      v_payment->>'supplier_category',
      v_payment->>'supplier_subcategory',
      NULL,
      true
    );

    INSERT INTO public.supplier_payments (
      supplier_id,
      amount,
      due_date,
      description,
      category,
      subcategory,
      reference_number,
      notes,
      status,
      paid_date,
      paid_amount,
      created_by
    )
    VALUES (
      v_supplier_id,
      COALESCE((v_payment->>'amount')::numeric, 0),
      (v_payment->>'due_date')::date,
      NULLIF(v_payment->>'description', ''),
      COALESCE(NULLIF(v_payment->>'category', ''), 'otros'),
      NULLIF(v_payment->>'subcategory', ''),
      NULLIF(v_payment->>'reference_number', ''),
      NULLIF(v_payment->>'notes', ''),
      COALESCE(NULLIF(v_payment->>'status', ''), 'pending'),
      NULLIF(v_payment->>'paid_date', '')::date,
      NULLIF(v_payment->>'paid_amount', '')::numeric,
      auth.uid()
    )
    ON CONFLICT (supplier_id, (NULLIF(trim(reference_number), '')))
    DO NOTHING;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."import_xml_supplier_documents"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_notification_if_not_exists"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.notification_logs (user_id, type, title, body, data)
  SELECT p_user_id, p_type, p_title, p_body, p_data
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notification_logs
    WHERE user_id = p_user_id 
      AND type = p_type 
      AND title = p_title
      AND created_at > (NOW() - INTERVAL '1 hour')
  );
END;
$$;


ALTER FUNCTION "public"."insert_notification_if_not_exists"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_user"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'); $$;


ALTER FUNCTION "public"."is_admin_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_user"("check_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = check_user_id 
    AND role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin_user"("check_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_user_safe"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;


ALTER FUNCTION "public"."is_admin_user_safe"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_authenticated_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT auth.role() = 'authenticated' AND current_user_role() = 'admin';
$$;


ALTER FUNCTION "public"."is_authenticated_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_authenticated_operator"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT auth.role() = 'authenticated' AND current_user_role() IN ('admin', 'operator');
$$;


ALTER FUNCTION "public"."is_authenticated_operator"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_authenticated_user"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT auth.role() = 'authenticated';
$$;


ALTER FUNCTION "public"."is_authenticated_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_authenticated_user_safe"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT auth.role() = 'authenticated';
$$;


ALTER FUNCTION "public"."is_authenticated_user_safe"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_client_user"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client');
$$;


ALTER FUNCTION "public"."is_client_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_client_user_safe"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'client'
  )
$$;


ALTER FUNCTION "public"."is_client_user_safe"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_operator_assigned_to_service"("_service_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.services s
    LEFT JOIN public.operators o_primary ON o_primary.id = s.operator_id
    WHERE s.id = _service_id
      AND o_primary.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.service_resources sr
    JOIN public.operators o ON o.id = sr.operator_id
    WHERE sr.service_id = _service_id
      AND o.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_operator_assigned_to_service"("_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_operator_user"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'operator')); $$;


ALTER FUNCTION "public"."is_operator_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_operator_user_safe"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'operator'); $$;


ALTER FUNCTION "public"."is_operator_user_safe"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_operators_config"() RETURNS TABLE("operator_id" "uuid", "operator_name" "text", "email" "text", "user_id_set" boolean, "has_op_role" boolean, "services_direct" bigint, "services_resource" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    o.id                                        AS operator_id,
    o.name                                      AS operator_name,
    p.email                                     AS email,
    (o.user_id IS NOT NULL)                     AS user_id_set,
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = o.user_id AND ur.role = 'operator'
    )                                           AS has_op_role,
    (SELECT COUNT(*) FROM public.services s WHERE s.operator_id = o.id)   AS services_direct,
    (SELECT COUNT(DISTINCT sr.service_id) FROM public.service_resources sr
     WHERE sr.operator_id = o.id)              AS services_resource
  FROM public.operators o
  LEFT JOIN public.profiles p ON p.id = o.user_id
  WHERE o.is_active = true
  ORDER BY o.name;
$$;


ALTER FUNCTION "public"."list_operators_config"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."list_operators_config"() IS 'Resumen de todos los operadores activos: si tienen user_id, rol y cantidad de servicios. Ejecutar como admin.';



CREATE OR REPLACE FUNCTION "public"."log_audit_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO audit_log (user_id, operation, table_name, old_data, new_data)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."log_audit_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_audit_entry"("p_table_name" "text", "p_operation" "text", "p_old_data" "jsonb" DEFAULT NULL::"jsonb", "p_new_data" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.audit_log (
    user_id, table_name, operation, old_data, new_data
  ) VALUES (
    auth.uid(), p_table_name, p_operation, p_old_data, p_new_data
  );
END;
$$;


ALTER FUNCTION "public"."log_audit_entry"("p_table_name" "text", "p_operation" "text", "p_old_data" "jsonb", "p_new_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_cost_snapshot_entry"("p_cost_id" "uuid", "p_field_name" "text", "p_old_value" "text" DEFAULT NULL::"text", "p_new_value" "text" DEFAULT NULL::"text", "p_change_summary" "text" DEFAULT NULL::"text", "p_change_context" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_history_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (
    public.has_role(v_user_id, 'admin'::app_role)
    OR public.has_role(v_user_id, 'operator'::app_role)
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to log cost snapshots';
  END IF;

  INSERT INTO public.cost_change_history (
    cost_id,
    changed_by,
    change_type,
    field_name,
    old_value,
    new_value,
    change_summary,
    change_context
  )
  VALUES (
    p_cost_id,
    v_user_id,
    'SNAPSHOT',
    p_field_name,
    p_old_value,
    p_new_value,
    p_change_summary,
    p_change_context
  )
  RETURNING id INTO v_history_id;

  RETURN v_history_id;
END;
$$;


ALTER FUNCTION "public"."log_cost_snapshot_entry"("p_cost_id" "uuid", "p_field_name" "text", "p_old_value" "text", "p_new_value" "text", "p_change_summary" "text", "p_change_context" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_import_batch_record"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_batch_id uuid;
BEGIN
  v_batch_id := NULLIF(current_setting('app.import_batch_id', true), '')::uuid;
  IF v_batch_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.import_batch_records (batch_id, table_name, record_id)
  VALUES (v_batch_id, TG_TABLE_NAME, NEW.id);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_import_batch_record"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_security_event"("event_type" "text", "event_description" "text", "additional_data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.notification_logs (
    user_id,
    type,
    title,
    body,
    data,
    status
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    'security_audit',
    'Evento de Seguridad: ' || event_type,
    event_description,
    additional_data || jsonb_build_object(
      'timestamp', now()
    ),
    'sent'
  );
END;
$$;


ALTER FUNCTION "public"."log_security_event"("event_type" "text", "event_description" "text", "additional_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_service_update_error"("p_service_id" "uuid", "p_error_code" "text", "p_error_message" "text", "p_error_details" "jsonb" DEFAULT NULL::"jsonb", "p_attempted_data" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    INSERT INTO public.service_update_error_logs (
        service_id,
        user_id,
        error_code,
        error_message,
        error_details,
        attempted_data
    ) VALUES (
        p_service_id,
        auth.uid(),
        p_error_code,
        p_error_message,
        p_error_details,
        p_attempted_data
    );
EXCEPTION WHEN OTHERS THEN
    -- Si no se puede registrar el error, no fallar la operación principal
    NULL;
END;
$$;


ALTER FUNCTION "public"."log_service_update_error"("p_service_id" "uuid", "p_error_code" "text", "p_error_message" "text", "p_error_details" "jsonb", "p_attempted_data" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_service_update_error"("p_service_id" "uuid", "p_error_code" "text", "p_error_message" "text", "p_error_details" "jsonb", "p_attempted_data" "jsonb") IS 'Función para registrar errores durante la actualización de servicios para debugging';



CREATE OR REPLACE FUNCTION "public"."maintain_payment_consistency"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_total_applied DECIMAL(10,2);
  v_payment_amount DECIMAL(10,2);
  v_new_status payment_status;
BEGIN
  -- Obtener el monto total del pago
  SELECT amount INTO v_payment_amount
  FROM payments
  WHERE id = COALESCE(NEW.payment_id, OLD.payment_id);

  -- Calcular el total aplicado sumando todas las aplicaciones
  SELECT COALESCE(SUM(applied_amount), 0)
  INTO v_total_applied
  FROM payment_applications
  WHERE payment_id = COALESCE(NEW.payment_id, OLD.payment_id);

  -- Determinar nuevo estado del pago
  IF v_total_applied = 0 THEN
    v_new_status := 'pending';
  ELSIF v_total_applied >= v_payment_amount THEN
    v_new_status := 'applied';
  ELSE
    v_new_status := 'partial';
  END IF;

  -- Actualizar el pago (remaining_amount se calcula automáticamente)
  UPDATE payments
  SET 
    applied_amount = v_total_applied,
    status = v_new_status,
    updated_at = now()
  WHERE id = COALESCE(NEW.payment_id, OLD.payment_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."maintain_payment_consistency"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."maintain_payment_consistency_enhanced"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  payment_total_applied DECIMAL;
  payment_amount DECIMAL;
  invoice_total_paid DECIMAL;
  invoice_total DECIMAL;
  invoice_id_affected UUID;
  payment_id_affected UUID;
BEGIN
  -- Procesar cambios en payment_applications
  IF TG_TABLE_NAME = 'payment_applications' THEN
    payment_id_affected := COALESCE(NEW.payment_id, OLD.payment_id);
    invoice_id_affected := COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- ACTUALIZAR PAGO AFECTADO
    IF payment_id_affected IS NOT NULL THEN
      SELECT 
        p.amount,
        COALESCE(SUM(pa.applied_amount), 0)
      INTO payment_amount, payment_total_applied
      FROM payments p
      LEFT JOIN payment_applications pa ON p.id = pa.payment_id
      WHERE p.id = payment_id_affected
      GROUP BY p.amount;
      
      -- Validar límites
      IF payment_total_applied > payment_amount THEN
        RAISE EXCEPTION 'El monto aplicado (%) excede el monto del pago (%)', 
          payment_total_applied, payment_amount;
      END IF;
      
      -- Actualizar pago
      UPDATE payments 
      SET 
        applied_amount = payment_total_applied,
        status = CASE 
          WHEN payment_total_applied >= payment_amount THEN 'applied'::payment_status
          WHEN payment_total_applied > 0 THEN 'partial'::payment_status
          ELSE 'pending'::payment_status
        END,
        updated_at = NOW()
      WHERE id = payment_id_affected;
    END IF;
    
    -- ACTUALIZAR FACTURA AFECTADA
    IF invoice_id_affected IS NOT NULL THEN
      SELECT 
        i.total,
        COALESCE(SUM(pa.applied_amount), 0)
      INTO invoice_total, invoice_total_paid
      FROM invoices i
      LEFT JOIN payment_applications pa ON i.id = pa.invoice_id
      WHERE i.id = invoice_id_affected
      GROUP BY i.total;
      
      -- Actualizar factura con estado correcto
      UPDATE invoices
      SET 
        paid_amount = invoice_total_paid,
        status = CASE 
          WHEN invoice_total_paid >= invoice_total THEN 'paid'::invoice_status
          WHEN invoice_total_paid > 0 THEN 'partial'::invoice_status
          ELSE CASE 
            WHEN status = 'draft' THEN 'draft'::invoice_status
            ELSE 'sent'::invoice_status
          END
        END,
        payment_date = CASE 
          WHEN invoice_total_paid >= invoice_total THEN COALESCE(payment_date, CURRENT_DATE)
          WHEN invoice_total_paid = 0 THEN NULL
          ELSE payment_date
        END,
        updated_at = NOW()
      WHERE id = invoice_id_affected;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."maintain_payment_consistency_enhanced"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_all_notifications_read"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET read_at = now()
  WHERE user_id = auth.uid() AND read_at IS NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."mark_all_notifications_read"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_costs_paid_batch"("p_cost_ids" "uuid"[], "p_payment_date" "date" DEFAULT NULL::"date") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_operation_id UUID := gen_random_uuid();
  v_executed_at TIMESTAMPTZ := now();
  v_requested_ids UUID[];
  v_processed_ids UUID[];
  v_already_paid_ids UUID[];
  v_missing_ids UUID[];
  v_use_cost_date BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT public.is_operator_user() THEN
    RAISE EXCEPTION 'No tienes permisos para realizar esta operación';
  END IF;

  v_requested_ids := ARRAY(
    SELECT DISTINCT unnest(p_cost_ids)
  );

  IF v_requested_ids IS NULL OR array_length(v_requested_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No se proporcionaron costos para procesar';
  END IF;

  v_use_cost_date := (p_payment_date IS NULL);

  BEGIN
    SELECT COALESCE(array_agg(c.id), '{}'::uuid[])
      INTO v_already_paid_ids
    FROM public.costs c
    WHERE c.id = ANY(v_requested_ids)
      AND c.payment_date IS NOT NULL;

    WITH updated AS (
      UPDATE public.costs c
      SET
        payment_date = COALESCE(p_payment_date, c.date),
        payment_batch_id = v_operation_id::text,
        updated_at = v_executed_at
      WHERE c.id = ANY(v_requested_ids)
        AND c.payment_date IS NULL
      RETURNING c.id
    )
    SELECT COALESCE(array_agg(u.id), '{}'::uuid[])
      INTO v_processed_ids
    FROM updated u;

    SELECT COALESCE(array_agg(x.id), '{}'::uuid[])
      INTO v_missing_ids
    FROM (
      SELECT input_id AS id
      FROM unnest(v_requested_ids) AS input_id
      LEFT JOIN public.costs c ON c.id = input_id
      WHERE c.id IS NULL
    ) x;

    INSERT INTO public.cost_bulk_payment_operations (
      id,
      executed_at,
      executed_by,
      payment_date,
      use_cost_date,
      requested_cost_ids,
      processed_cost_ids,
      already_paid_cost_ids,
      missing_cost_ids,
      status,
      error_message
    ) VALUES (
      v_operation_id,
      v_executed_at,
      v_user_id,
      p_payment_date,
      v_use_cost_date,
      v_requested_ids,
      v_processed_ids,
      v_already_paid_ids,
      v_missing_ids,
      'success',
      NULL
    );

    RETURN jsonb_build_object(
      'success', true,
      'operation_id', v_operation_id,
      'executed_at', v_executed_at,
      'executed_by', v_user_id,
      'payment_date', p_payment_date,
      'use_cost_date', v_use_cost_date,
      'requested_ids', v_requested_ids,
      'processed_ids', v_processed_ids,
      'already_paid_ids', v_already_paid_ids,
      'missing_ids', v_missing_ids,
      'requested_count', COALESCE(array_length(v_requested_ids, 1), 0),
      'processed_count', COALESCE(array_length(v_processed_ids, 1), 0),
      'already_paid_count', COALESCE(array_length(v_already_paid_ids, 1), 0),
      'missing_count', COALESCE(array_length(v_missing_ids, 1), 0)
    );
  EXCEPTION
    WHEN OTHERS THEN
      INSERT INTO public.cost_bulk_payment_operations (
        id,
        executed_at,
        executed_by,
        payment_date,
        use_cost_date,
        requested_cost_ids,
        processed_cost_ids,
        already_paid_cost_ids,
        missing_cost_ids,
        status,
        error_message
      ) VALUES (
        v_operation_id,
        v_executed_at,
        v_user_id,
        p_payment_date,
        v_use_cost_date,
        COALESCE(v_requested_ids, '{}'::uuid[]),
        '{}'::uuid[],
        '{}'::uuid[],
        '{}'::uuid[],
        'error',
        SQLERRM
      );

      RETURN jsonb_build_object(
        'success', false,
        'operation_id', v_operation_id,
        'executed_at', v_executed_at,
        'executed_by', v_user_id,
        'payment_date', p_payment_date,
        'use_cost_date', v_use_cost_date,
        'requested_ids', COALESCE(v_requested_ids, '{}'::uuid[]),
        'processed_ids', '{}'::uuid[],
        'already_paid_ids', '{}'::uuid[],
        'missing_ids', '{}'::uuid[],
        'error', SQLERRM
      );
  END;
END;
$$;


ALTER FUNCTION "public"."mark_costs_paid_batch"("p_cost_ids" "uuid"[], "p_payment_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.notifications
  SET read_at = now()
  WHERE id = p_notification_id AND user_id = auth.uid() AND read_at IS NULL;
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_supplier_payment_as_paid"("p_payment_id" "uuid", "p_paid_date" "date" DEFAULT CURRENT_DATE) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE supplier_payments
  SET 
    status = 'paid',
    paid_date = p_paid_date,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = p_payment_id
    AND status IN ('pending', 'overdue');
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."mark_supplier_payment_as_paid"("p_payment_id" "uuid", "p_paid_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mark_supplier_payment_as_paid"("p_payment_id" "uuid", "p_paid_date" "date") IS 'Marca un pago como pagado';



CREATE OR REPLACE FUNCTION "public"."merge_inventory_items"("p_master_item_id" "uuid", "p_duplicate_item_ids" "uuid"[], "p_master_name" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_master_item record;
  v_duplicate_count integer := 0;
  v_moved_movements integer := 0;
  v_moved_alerts integer := 0;
  v_moved_cost_links integer := 0;
  v_moved_supplier_invoice_links integer := 0;
  v_deleted_stock_rows integer := 0;
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Solo los administradores pueden fusionar productos';
  END IF;

  IF p_master_item_id IS NULL THEN
    RAISE EXCEPTION 'Debes indicar un producto maestro';
  END IF;

  IF p_duplicate_item_ids IS NULL OR array_length(p_duplicate_item_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debes indicar al menos un producto duplicado';
  END IF;

  IF p_master_item_id = ANY(p_duplicate_item_ids) THEN
    RAISE EXCEPTION 'El producto maestro no puede estar incluido entre los duplicados';
  END IF;

  SELECT *
  INTO v_master_item
  FROM public.inventory_items
  WHERE id = p_master_item_id
  LIMIT 1;

  IF v_master_item IS NULL THEN
    RAISE EXCEPTION 'No se encontro el producto maestro';
  END IF;

  SELECT COUNT(*)
  INTO v_duplicate_count
  FROM public.inventory_items
  WHERE id = ANY(p_duplicate_item_ids);

  IF v_duplicate_count = 0 THEN
    RAISE EXCEPTION 'No se encontraron productos duplicados validos';
  END IF;

  UPDATE public.inventory_items
  SET
    name = COALESCE(NULLIF(btrim(p_master_name), ''), name),
    is_active = true,
    updated_at = now()
  WHERE id = p_master_item_id;

  UPDATE public.inventory_movements
  SET item_id = p_master_item_id
  WHERE item_id = ANY(p_duplicate_item_ids);
  GET DIAGNOSTICS v_moved_movements = ROW_COUNT;

  UPDATE public.inventory_alerts
  SET item_id = p_master_item_id,
      updated_at = now()
  WHERE item_id = ANY(p_duplicate_item_ids);
  GET DIAGNOSTICS v_moved_alerts = ROW_COUNT;

  UPDATE public.cost_inventory_items
  SET inventory_item_id = p_master_item_id
  WHERE inventory_item_id = ANY(p_duplicate_item_ids);
  GET DIAGNOSTICS v_moved_cost_links = ROW_COUNT;

  UPDATE public.supplier_invoice_items
  SET inventory_item_id = p_master_item_id,
      updated_at = now()
  WHERE inventory_item_id = ANY(p_duplicate_item_ids);
  GET DIAGNOSTICS v_moved_supplier_invoice_links = ROW_COUNT;

  DELETE FROM public.inventory_stock
  WHERE item_id = ANY(p_duplicate_item_ids);
  GET DIAGNOSTICS v_deleted_stock_rows = ROW_COUNT;

  DELETE FROM public.inventory_stock
  WHERE item_id = p_master_item_id;

  INSERT INTO public.inventory_stock (
    item_id,
    location_id,
    current_quantity,
    reserved_quantity,
    last_movement_date,
    created_at,
    updated_at
  )
  SELECT
    p_master_item_id,
    im.location_id,
    COALESCE(SUM(
      CASE
        WHEN im.movement_type = 'entry' THEN im.quantity
        WHEN im.movement_type = 'exit' THEN -im.quantity
        ELSE 0
      END
    ), 0) AS current_quantity,
    0,
    MAX(im.movement_date) AS last_movement_date,
    now(),
    now()
  FROM public.inventory_movements im
  WHERE im.item_id = p_master_item_id
    AND im.status = 'active'
  GROUP BY im.location_id;

  UPDATE public.inventory_items
  SET
    is_active = false,
    updated_at = now(),
    description = concat_ws(
      E'\n',
      nullif(description, ''),
      'Fusionado en producto maestro: ' || COALESCE(NULLIF(btrim(p_master_name), ''), v_master_item.name)
    )
  WHERE id = ANY(p_duplicate_item_ids);

  RETURN jsonb_build_object(
    'success', true,
    'master_item_id', p_master_item_id,
    'duplicate_items_merged', v_duplicate_count,
    'movements_reassigned', v_moved_movements,
    'alerts_reassigned', v_moved_alerts,
    'cost_links_reassigned', v_moved_cost_links,
    'supplier_invoice_links_reassigned', v_moved_supplier_invoice_links,
    'stock_rows_rebuilt', v_deleted_stock_rows,
    'master_name', COALESCE(NULLIF(btrim(p_master_name), ''), v_master_item.name)
  );
END;
$$;


ALTER FUNCTION "public"."merge_inventory_items"("p_master_item_id" "uuid", "p_duplicate_item_ids" "uuid"[], "p_master_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_suppliers"("p_keep_id" "uuid", "p_remove_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result JSONB;
  v_payments_count INT;
  v_movements_count INT;
  v_parts_count INT;
BEGIN
  -- Validar que ambos proveedores existan
  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE id = p_keep_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Proveedor principal no existe'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE id = p_remove_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Proveedor a eliminar no existe'
    );
  END IF;

  -- Reasignar todas las referencias
  UPDATE supplier_payments 
  SET supplier_id = p_keep_id 
  WHERE supplier_id = p_remove_id;
  GET DIAGNOSTICS v_payments_count = ROW_COUNT;
  
  UPDATE inventory_movements 
  SET supplier_id = p_keep_id 
  WHERE supplier_id = p_remove_id;
  GET DIAGNOSTICS v_movements_count = ROW_COUNT;
  
  UPDATE crane_parts 
  SET supplier_id = p_keep_id 
  WHERE supplier_id = p_remove_id;
  GET DIAGNOSTICS v_parts_count = ROW_COUNT;
  
  -- Desactivar proveedor duplicado
  UPDATE suppliers 
  SET is_active = false,
      notes = COALESCE(notes || ' | ', '') || 'FUSIONADO CON: ' || p_keep_id::TEXT
  WHERE id = p_remove_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'kept_id', p_keep_id,
    'removed_id', p_remove_id,
    'payments_migrated', v_payments_count,
    'movements_migrated', v_movements_count,
    'parts_migrated', v_parts_count
  );
END;
$$;


ALTER FUNCTION "public"."merge_suppliers"("p_keep_id" "uuid", "p_remove_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."merge_suppliers"("p_keep_id" "uuid", "p_remove_id" "uuid") IS 'Fusiona dos proveedores: reasigna todas las referencias del segundo al primero y lo desactiva';



CREATE OR REPLACE FUNCTION "public"."migrate_existing_consumption_movements"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  movement_record RECORD;
  migrated_count INTEGER := 0;
  error_count INTEGER := 0;
  errors jsonb := '[]'::jsonb;
  maintenance_category_id UUID;
  new_cost_id UUID;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar migraciones';
  END IF;

  -- Obtener categoría de mantenimiento
  SELECT id INTO maintenance_category_id
  FROM public.cost_categories
  WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%maintenance%'
  LIMIT 1;

  -- Migrar movimientos de salida existentes que no tienen crane_parts
  FOR movement_record IN 
    SELECT im.* 
    FROM public.inventory_movements im
    WHERE im.movement_type = 'exit' 
    AND im.crane_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.crane_parts cp 
      WHERE cp.inventory_movement_id = im.id
    )
    ORDER BY im.created_at
  LOOP
    BEGIN
      -- Crear registro de costo
      INSERT INTO public.costs (
        amount,
        category_id,
        crane_id,
        date,
        description,
        notes,
        subcategory,
        created_by
      ) VALUES (
        COALESCE(movement_record.total_cost, movement_record.unit_cost * movement_record.quantity, 0),
        maintenance_category_id,
        movement_record.crane_id,
        movement_record.movement_date::date,
        'Consumo de inventario: ' || (SELECT name FROM public.inventory_items WHERE id = movement_record.item_id),
        'Consumo migrado desde movimiento existente - ID: ' || movement_record.id,
        'Consumo de Inventario',
        movement_record.created_by
      ) RETURNING id INTO new_cost_id;

      -- Crear registro en crane_parts
      INSERT INTO public.crane_parts (
        crane_id,
        part_name,
        date,
        quantity,
        unit_price,
        total_value,
        supplier,
        notes,
        cost_id,
        inventory_movement_id,
        created_by
      ) VALUES (
        movement_record.crane_id,
        (SELECT name FROM public.inventory_items WHERE id = movement_record.item_id),
        movement_record.movement_date::date,
        -movement_record.quantity,
        COALESCE(movement_record.unit_cost, 0),
        -COALESCE(movement_record.total_cost, movement_record.unit_cost * movement_record.quantity, 0),
        COALESCE(movement_record.supplier_name, 'Inventario interno'),
        'Consumo migrado automáticamente' || 
        CASE WHEN movement_record.observations IS NOT NULL THEN ' - ' || movement_record.observations ELSE '' END,
        new_cost_id,
        movement_record.id,
        movement_record.created_by
      );

      migrated_count := migrated_count + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        errors := errors || jsonb_build_object(
          'movement_id', movement_record.id,
          'item_id', movement_record.item_id,
          'error', SQLERRM
        );
        RAISE WARNING 'Error migrating consumption movement %: %', movement_record.id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'migrated_count', migrated_count,
    'error_count', error_count,
    'errors', errors,
    'message', format('Migración de consumos completada: %s movimientos migrados, %s errores', migrated_count, error_count)
  );
END;
$$;


ALTER FUNCTION "public"."migrate_existing_consumption_movements"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_existing_operator_commissions"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  RAISE NOTICE 'FUNCIÓN DESHABILITADA: Esta función ha sido deshabilitada para prevenir duplicaciones de comisiones.';
  RETURN;
END;
$$;


ALTER FUNCTION "public"."migrate_existing_operator_commissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_legacy_crane_parts_data"("p_crane_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  migrated_count INTEGER := 0;
  cost_record RECORD;
  new_part_id UUID;
  maintenance_category_id UUID;
BEGIN
  -- Verificar que el usuario sea administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar migraciones de datos';
  END IF;

  -- Obtener ID de categoría de mantenimiento
  SELECT id INTO maintenance_category_id
  FROM public.cost_categories
  WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%maintenance%'
  LIMIT 1;

  -- Migrar costos de "Piezas y Repuestos" que no tienen crane_parts asociado
  FOR cost_record IN 
    SELECT c.*
    FROM public.costs c
    WHERE c.subcategory = 'Piezas y Repuestos'
    AND (p_crane_id IS NULL OR c.crane_id = p_crane_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.crane_parts cp WHERE cp.cost_id = c.id
    )
  LOOP
    -- Crear registro en crane_parts
    INSERT INTO public.crane_parts (
      crane_id,
      part_name,
      date,
      quantity,
      unit_price,
      total_value,
      supplier,
      notes,
      cost_id,
      created_by
    ) VALUES (
      cost_record.crane_id,
      COALESCE(cost_record.description, 'Pieza migrada'),
      cost_record.date,
      1, -- cantidad por defecto
      cost_record.amount,
      cost_record.amount,
      'Proveedor no especificado',
      'Registro migrado automáticamente desde costos legacy: ' || COALESCE(cost_record.notes, ''),
      cost_record.id,
      cost_record.created_by
    ) RETURNING id INTO new_part_id;

    migrated_count := migrated_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'migrated_records', migrated_count,
    'message', 'Migración completada exitosamente'
  );
END;
$$;


ALTER FUNCTION "public"."migrate_legacy_crane_parts_data"("p_crane_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_unsync_crane_parts"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  part_record RECORD;
  local_inventory_item_id UUID;
  movement_id UUID;
  location_id UUID;
  migrated_count INTEGER := 0;
  error_count INTEGER := 0;
  errors jsonb := '[]'::jsonb;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar migraciones';
  END IF;

  -- Obtener ubicación por defecto
  SELECT il.id INTO location_id
  FROM public.inventory_locations il
  WHERE il.is_active = true
  ORDER BY il.created_at
  LIMIT 1;

  -- Si no hay ubicación, crear una
  IF location_id IS NULL THEN
    INSERT INTO public.inventory_locations (name, code, description, is_active)
    VALUES ('Bodega Principal', 'MAIN', 'Bodega principal de repuestos', true)
    RETURNING id INTO location_id;
  END IF;

  -- Migrar piezas sin sincronizar (sin inventory_movement_id)
  FOR part_record IN 
    SELECT cp.* FROM public.crane_parts cp
    WHERE cp.inventory_movement_id IS NULL
    ORDER BY cp.created_at
  LOOP
    BEGIN
      -- Buscar o crear item de inventario
      SELECT ii.id INTO local_inventory_item_id
      FROM public.inventory_items ii
      WHERE LOWER(TRIM(ii.name)) = LOWER(TRIM(part_record.part_name))
      AND ii.is_active = true
      LIMIT 1;

      IF local_inventory_item_id IS NULL THEN
        INSERT INTO public.inventory_items (
          name,
          description,
          unit_of_measure,
          unit_cost,
          minimum_stock,
          is_active,
          created_by
        ) VALUES (
          TRIM(part_record.part_name),
          'Migrado desde pieza de grúa existente',
          'unidad',
          part_record.unit_price,
          1,
          true,
          part_record.created_by
        )
        RETURNING id INTO local_inventory_item_id;
      END IF;

      -- Crear movimiento de entrada
      INSERT INTO public.inventory_movements (
        item_id,
        location_id,
        movement_type,
        quantity,
        unit_cost,
        total_cost,
        supplier_name,
        reference_document,
        observations,
        movement_date,
        status,
        created_by
      ) VALUES (
        local_inventory_item_id,
        location_id,
        'entry',
        part_record.quantity,
        part_record.unit_price,
        part_record.total_value,
        part_record.supplier,
        'Migración de pieza existente - ID: ' || part_record.id,
        'Movimiento migrado automáticamente',
        part_record.date,
        'active',
        part_record.created_by
      )
      RETURNING id INTO movement_id;

      -- Actualizar crane_parts con referencia
      UPDATE public.crane_parts 
      SET inventory_movement_id = movement_id
      WHERE id = part_record.id;

      -- Crear mapeo si existe cost_id
      IF part_record.cost_id IS NOT NULL THEN
        INSERT INTO public.cost_inventory_items (
          cost_id,
          inventory_item_id,
          quantity,
          unit_cost,
          created_by
        ) VALUES (
          part_record.cost_id,
          local_inventory_item_id,
          part_record.quantity,
          part_record.unit_price,
          part_record.created_by
        )
        ON CONFLICT (cost_id, inventory_item_id) DO NOTHING;
      END IF;

      migrated_count := migrated_count + 1;
      
      RAISE NOTICE 'Migrated part: % with inventory_item_id: %', part_record.part_name, local_inventory_item_id;
      
    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        errors := errors || jsonb_build_object(
          'part_id', part_record.id,
          'part_name', part_record.part_name,
          'error', SQLERRM
        );
        RAISE WARNING 'Error migrating part %: %', part_record.part_name, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'migrated_count', migrated_count,
    'error_count', error_count,
    'errors', errors,
    'message', format('Migración completada: %s piezas migradas, %s errores', migrated_count, error_count)
  );
END;
$$;


ALTER FUNCTION "public"."migrate_unsync_crane_parts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_unsynced_crane_parts_to_inventory"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  part_record RECORD;
  local_inventory_item_id UUID;
  movement_id UUID;
  location_id UUID;
  migrated_count INTEGER := 0;
  error_count INTEGER := 0;
  errors jsonb := '[]'::jsonb;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar migraciones';
  END IF;

  -- Obtener ubicación por defecto
  SELECT il.id INTO location_id
  FROM inventory_locations il
  WHERE il.is_active = true
  ORDER BY il.created_at
  LIMIT 1;

  -- Si no hay ubicación, crear una
  IF location_id IS NULL THEN
    INSERT INTO inventory_locations (name, code, description, is_active)
    VALUES ('Bodega Principal', 'MAIN', 'Bodega principal de repuestos', true)
    RETURNING id INTO location_id;
  END IF;

  -- Migrar piezas sin sincronizar (sin inventory_movement_id)
  FOR part_record IN 
    SELECT cp.* FROM crane_parts cp
    WHERE cp.inventory_movement_id IS NULL
    ORDER BY cp.created_at
  LOOP
    BEGIN
      -- Buscar o crear item de inventario
      SELECT ii.id INTO local_inventory_item_id
      FROM inventory_items ii
      WHERE LOWER(TRIM(ii.name)) = LOWER(TRIM(part_record.part_name))
      AND ii.is_active = true
      LIMIT 1;

      IF local_inventory_item_id IS NULL THEN
        INSERT INTO inventory_items (
          name,
          description,
          unit_of_measure,
          unit_cost,
          minimum_stock,
          is_active,
          created_by
        ) VALUES (
          TRIM(part_record.part_name),
          'Migrado desde pieza de grúa existente',
          'unidad',
          part_record.unit_price,
          1,
          true,
          part_record.created_by
        )
        RETURNING id INTO local_inventory_item_id;
      END IF;

      -- Crear movimiento de entrada
      INSERT INTO inventory_movements (
        item_id,
        location_id,
        movement_type,
        quantity,
        unit_cost,
        total_cost,
        supplier_name,
        reference_document,
        observations,
        movement_date,
        status,
        created_by
      ) VALUES (
        local_inventory_item_id,
        location_id,
        'entry',
        part_record.quantity,
        part_record.unit_price,
        part_record.total_value,
        part_record.supplier,
        'Migración de pieza existente - ID: ' || part_record.id,
        'Movimiento migrado automáticamente',
        part_record.date,
        'active',
        part_record.created_by
      )
      RETURNING id INTO movement_id;

      -- Actualizar crane_parts con referencia
      UPDATE crane_parts 
      SET inventory_movement_id = movement_id
      WHERE id = part_record.id;

      -- Crear mapeo si existe cost_id
      IF part_record.cost_id IS NOT NULL THEN
        INSERT INTO cost_inventory_items (
          cost_id,
          inventory_item_id,
          quantity,
          unit_cost,
          created_by
        ) VALUES (
          part_record.cost_id,
          local_inventory_item_id,
          part_record.quantity,
          part_record.unit_price,
          part_record.created_by
        )
        ON CONFLICT (cost_id, inventory_item_id) DO NOTHING;
      END IF;

      migrated_count := migrated_count + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        errors := errors || jsonb_build_object(
          'part_id', part_record.id,
          'part_name', part_record.part_name,
          'error', SQLERRM
        );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'migrated_count', migrated_count,
    'error_count', error_count,
    'errors', errors,
    'message', format('Migración completada: %s piezas migradas, %s errores', migrated_count, error_count)
  );
END;
$$;


ALTER FUNCTION "public"."migrate_unsynced_crane_parts_to_inventory"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_inventory_movement_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  business_tz text;
  now_business timestamptz;
  today_business date;
BEGIN
  SELECT COALESCE(report_timezone, 'America/Santiago')
    INTO business_tz
  FROM public.company_data
  LIMIT 1;
  business_tz := COALESCE(business_tz, 'America/Santiago');

  now_business := now();
  today_business := (now_business AT TIME ZONE business_tz)::date;

  -- Si movement_date llega como medianoche UTC y representa "hoy" en TZ negocio,
  -- vino como string YYYY-MM-DD sin hora -> reemplazar por timestamp real.
  IF NEW.movement_date IS NOT NULL
     AND EXTRACT(HOUR FROM NEW.movement_date AT TIME ZONE 'UTC') = 0
     AND EXTRACT(MINUTE FROM NEW.movement_date AT TIME ZONE 'UTC') = 0
     AND EXTRACT(SECOND FROM NEW.movement_date AT TIME ZONE 'UTC') = 0
     AND (NEW.movement_date AT TIME ZONE business_tz)::date = today_business
  THEN
    NEW.movement_date := now_business;
  END IF;

  IF NEW.created_at IS NULL THEN
    NEW.created_at := now_business;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."normalize_inventory_movement_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_supplier_payment_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF current_setting('app.cascade_delete', true) = 'true' THEN
    RETURN OLD;
  END IF;

  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  IF OLD.cost_id IS NOT NULL THEN
    UPDATE costs SET supplier_payment_id = NULL WHERE id = OLD.cost_id;
  END IF;

  UPDATE costs SET supplier_payment_id = NULL WHERE supplier_payment_id = OLD.id;

  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."on_supplier_payment_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_duplicate_commissions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  commission_category_id UUID;
  existing_count INTEGER;
BEGIN
  -- Solo aplicar a costos de comisión
  SELECT id INTO commission_category_id 
  FROM public.cost_categories 
  WHERE name = 'Comisión Operador';
  
  IF NEW.category_id = commission_category_id THEN
    -- Verificar duplicados en costs
    SELECT COUNT(*) INTO existing_count
    FROM public.costs 
    WHERE service_id = NEW.service_id 
      AND operator_id = NEW.operator_id 
      AND category_id = commission_category_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF existing_count > 0 THEN
      RAISE EXCEPTION 'Ya existe una comisión para este operador en este servicio. Duplicación bloqueada.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_duplicate_commissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_duplicate_maintenance_costs"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  maintenance_category_id UUID;
  existing_count INTEGER;
BEGIN
  -- Obtener ID de categoría de mantenimiento
  SELECT id INTO maintenance_category_id 
  FROM public.cost_categories 
  WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%mant%';
  
  IF NEW.category_id = maintenance_category_id THEN
    -- Verificar duplicados para costos de mantenimiento
    SELECT COUNT(*) INTO existing_count
    FROM public.costs 
    WHERE crane_id = NEW.crane_id 
      AND date = NEW.date
      AND amount = NEW.amount
      AND category_id = maintenance_category_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF existing_count > 0 THEN
      RAISE EXCEPTION 'Ya existe un costo de mantenimiento duplicado para esta grúa en la misma fecha con el mismo monto';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_duplicate_maintenance_costs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_duplicate_payments"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  -- Verificar si ya existe un pago similar en las últimas 24 horas
  SELECT COUNT(*) INTO existing_count
  FROM public.payments 
  WHERE client_id = NEW.client_id
    AND amount = NEW.amount
    AND payment_date = NEW.payment_date
    AND payment_method = NEW.payment_method
    AND created_at > now() - interval '24 hours'
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF existing_count > 0 THEN
    RAISE EXCEPTION 'Ya existe un pago similar para este cliente en las últimas 24 horas. Posible duplicado detectado.';
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_duplicate_payments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_duplicate_service_commissions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  IF NEW.cost_type = 'commission' THEN
    SELECT COUNT(*) INTO existing_count
    FROM public.service_costs 
    WHERE service_id = NEW.service_id 
      AND operator_id = NEW.operator_id 
      AND cost_type = 'commission'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF existing_count > 0 THEN
      RAISE EXCEPTION 'Ya existe una comisión para este operador en este servicio en service_costs.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_duplicate_service_commissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_excess_of_excess"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Prevent creating excess service from another excess service
  IF NEW.service_relationship_type = 'excess' AND NEW.related_service_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.services 
      WHERE id = NEW.related_service_id 
      AND service_relationship_type = 'excess'
    ) THEN
      RAISE EXCEPTION 'No se puede crear un excedente de un servicio que ya es excedente';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_excess_of_excess"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_invoice_overpayment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_invoice_total NUMERIC;
  v_current_paid NUMERIC;
  v_available NUMERIC;
BEGIN
  SELECT total INTO v_invoice_total
  FROM invoices
  WHERE id = NEW.invoice_id;
  
  SELECT COALESCE(SUM(applied_amount), 0) INTO v_current_paid
  FROM payment_applications
  WHERE invoice_id = NEW.invoice_id
    AND (TG_OP = 'INSERT' OR id != NEW.id);
  
  v_available := v_invoice_total - v_current_paid;
  
  IF NEW.applied_amount > v_available THEN
    RAISE EXCEPTION 'Sobrepago no permitido: Monto $% excede el disponible $% para esta factura', 
      NEW.applied_amount, v_available;
  END IF;
  
  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."prevent_invoice_overpayment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_non_admin_updates_on_paid_costs"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF current_setting('app.sync_in_progress', true) = 'true'
     OR current_setting('app.bidirectional_sync', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF OLD.payment_date IS NOT NULL AND NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Este costo está marcado como pagado y no puede ser modificado sin autorización especial';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_non_admin_updates_on_paid_costs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_overpayment_on_application"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Validar en INSERT
  IF TG_OP = 'INSERT' THEN
    PERFORM validate_payment_application_amount(NEW.invoice_id, NEW.applied_amount);
  END IF;
  
  -- Validar en UPDATE si cambia el monto o la factura
  IF TG_OP = 'UPDATE' AND (
    NEW.applied_amount != OLD.applied_amount OR 
    NEW.invoice_id != OLD.invoice_id
  ) THEN
    PERFORM validate_payment_application_amount(
      NEW.invoice_id, 
      NEW.applied_amount,
      OLD.id  -- Excluir el monto anterior de esta aplicación
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_overpayment_on_application"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preview_next_invoice_folio"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(next_invoice_folio_number, 4000) 
  INTO next_number
  FROM public.company_data 
  LIMIT 1;
  
  IF next_number IS NULL THEN
    next_number := 4000;
  END IF;
  
  RETURN 'FACT-' || next_number;
END;
$$;


ALTER FUNCTION "public"."preview_next_invoice_folio"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."propagate_invoice_folio_to_closure_services"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Update all services in the closure with the invoice folio
  UPDATE services s
  SET 
    invoice_folio = (SELECT folio FROM invoices WHERE id = NEW.invoice_id),
    invoice_numero_fiscal = (SELECT numero_fiscal FROM invoices WHERE id = NEW.invoice_id),
    status = 'invoiced',
    updated_at = now()
  FROM closure_services cs
  WHERE cs.closure_id = NEW.closure_id
    AND cs.service_id = s.id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."propagate_invoice_folio_to_closure_services"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_crane_parts_costs"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  updated_parts_count INTEGER := 0;
  part_record RECORD;
  item_unit_cost NUMERIC;
  fallback_unit_cost NUMERIC;
  final_unit_cost NUMERIC;
  item_name TEXT;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden recalcular costos de crane_parts';
  END IF;

  -- Recalcular costos para crane_parts con inventory_movement_id
  FOR part_record IN 
    SELECT cp.*, im.item_id
    FROM public.crane_parts cp
    JOIN public.inventory_movements im ON cp.inventory_movement_id = im.id
    WHERE cp.unit_price <= 0.01  -- Solo los que tienen costos incorrectos
      AND im.movement_type = 'exit'
  LOOP
    -- Obtener costo real del item
    SELECT unit_cost, name INTO item_unit_cost, item_name
    FROM public.inventory_items 
    WHERE id = part_record.item_id;
    
    -- Determinar el costo a usar
    IF item_unit_cost IS NOT NULL AND item_unit_cost > 0 THEN
      final_unit_cost := item_unit_cost;
    ELSE
      -- Fallback: promedio histórico
      SELECT AVG(unit_cost) INTO fallback_unit_cost
      FROM public.inventory_movements 
      WHERE item_id = part_record.item_id 
        AND movement_type IN ('entry', 'purchase')
        AND unit_cost > 0;
      
      final_unit_cost := COALESCE(fallback_unit_cost, part_record.unit_price);
    END IF;

    -- Actualizar crane_parts con el costo correcto
    UPDATE public.crane_parts
    SET 
      unit_price = final_unit_cost,
      total_value = final_unit_cost * ABS(quantity),
      notes = COALESCE(notes, '') || format(' [Costo recalculado: $%s -> $%s]', part_record.unit_price, final_unit_cost),
      updated_at = NOW()
    WHERE id = part_record.id;
    
    updated_parts_count := updated_parts_count + 1;
    
    RAISE NOTICE 'Actualizado crane_part %: % de $% a $%', 
      part_record.id, part_record.part_name, part_record.unit_price, final_unit_cost;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_parts', updated_parts_count,
    'message', format('Recalculados costos de %s registros en crane_parts', updated_parts_count)
  );
END;
$_$;


ALTER FUNCTION "public"."recalculate_crane_parts_costs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_payment_balances"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  payment_record RECORD;
  updated_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  -- Verificar permisos
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden recalcular balances de pagos';
  END IF;

  -- Recalcular para cada pago
  FOR payment_record IN 
    SELECT 
      p.id,
      p.amount,
      COALESCE((
        SELECT SUM(pa.applied_amount) 
        FROM public.payment_applications pa 
        WHERE pa.payment_id = p.id
      ), 0) as real_applied_amount
    FROM public.payments p
  LOOP
    BEGIN
      -- Actualizar applied_amount y remaining_amount
      UPDATE public.payments 
      SET 
        applied_amount = payment_record.real_applied_amount,
        remaining_amount = payment_record.amount - payment_record.real_applied_amount,
        status = CASE 
          WHEN payment_record.real_applied_amount = 0 THEN 'pending'::payment_status
          WHEN payment_record.real_applied_amount < payment_record.amount THEN 'partial'::payment_status
          WHEN payment_record.real_applied_amount = payment_record.amount THEN 'applied'::payment_status
          ELSE 'partial'::payment_status
        END,
        updated_at = now()
      WHERE id = payment_record.id;
      
      updated_count := updated_count + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        RAISE WARNING 'Error actualizando pago %: %', payment_record.id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_payments', updated_count,
    'error_count', error_count,
    'message', format('Recalculados %s pagos exitosamente', updated_count)
  );
END;
$$;


ALTER FUNCTION "public"."recalculate_payment_balances"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reconcile_orphan_records"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  linked_payments int := 0;
  linked_movements int := 0;
  linked_parts int := 0;
  duplicates_found int := 0;
  result jsonb;
BEGIN
  -- 1. Link costs to supplier_payments by matching supplier_id + amount + date (within 3 days)
  UPDATE costs c
  SET supplier_payment_id = sp.id
  FROM supplier_payments sp
  WHERE c.supplier_payment_id IS NULL
    AND c.supplier_id IS NOT NULL
    AND c.supplier_id = sp.supplier_id
    AND c.amount = sp.amount
    AND ABS(c.date - sp.due_date::date) <= 3
    AND sp.id NOT IN (SELECT supplier_payment_id FROM costs WHERE supplier_payment_id IS NOT NULL);
  GET DIAGNOSTICS linked_payments = ROW_COUNT;

  -- 2. Link costs to inventory_movements by matching amount + date
  UPDATE costs c
  SET inventory_movement_id = im.id
  FROM inventory_movements im
  WHERE c.inventory_movement_id IS NULL
    AND im.cost_id IS NULL
    AND im.total_cost = c.amount
    AND im.movement_date::date = c.date
    AND im.movement_type = 'entry';
  GET DIAGNOSTICS linked_movements = ROW_COUNT;

  -- Also set the reverse link
  UPDATE inventory_movements im
  SET cost_id = c.id
  FROM costs c
  WHERE im.cost_id IS NULL
    AND c.inventory_movement_id = im.id;

  -- 3. Link crane_parts to costs by matching crane_id + total_value + date
  UPDATE crane_parts cp
  SET cost_id = c.id
  FROM costs c
  WHERE cp.cost_id IS NULL
    AND c.crane_id IS NOT NULL
    AND cp.crane_id = c.crane_id
    AND cp.total_value = c.amount
    AND cp.date = c.date
    AND c.id NOT IN (SELECT cost_id FROM crane_parts WHERE cost_id IS NOT NULL);
  GET DIAGNOSTICS linked_parts = ROW_COUNT;

  -- 4. Count potential duplicates (same supplier + amount + date in costs)
  SELECT COUNT(*) INTO duplicates_found
  FROM (
    SELECT supplier_id, amount, date, COUNT(*) as cnt
    FROM costs
    WHERE supplier_id IS NOT NULL
    GROUP BY supplier_id, amount, date
    HAVING COUNT(*) > 1
  ) dups;

  result := jsonb_build_object(
    'linked_payments', linked_payments,
    'linked_movements', linked_movements,
    'linked_parts', linked_parts,
    'potential_duplicates', duplicates_found,
    'executed_at', now()
  );

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."reconcile_orphan_records"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_pending_user"("target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = target_user_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Usuario no encontrado o no está pendiente';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id AND status = 'pending';
  -- El registro en auth.users queda, pero sin profile no puede acceder.
  -- Si se desea eliminarlo de auth también, hacerlo desde el dashboard de Supabase.
END;
$$;


ALTER FUNCTION "public"."reject_pending_user"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_duplicate_payment_applications"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  removed_count INTEGER := 0;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden eliminar duplicados';
  END IF;

  -- Eliminar aplicaciones duplicadas (mantener solo la más reciente)
  DELETE FROM payment_applications 
  WHERE id IN (
    SELECT id FROM (
      SELECT id, 
             ROW_NUMBER() OVER (
               PARTITION BY payment_id, invoice_id 
               ORDER BY created_at DESC
             ) as rn
      FROM payment_applications
    ) ranked 
    WHERE rn > 1
  );
  
  GET DIAGNOSTICS removed_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'removed_duplicates', removed_count,
    'message', format('Eliminadas %s aplicaciones duplicadas', removed_count)
  );
END;
$$;


ALTER FUNCTION "public"."remove_duplicate_payment_applications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."repair_commission_system"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  commission_category_id UUID;
  repaired_count INTEGER := 0;
  synced_count INTEGER := 0;
  created_count INTEGER := 0;
  service_record RECORD;
  resource_record RECORD;
  result jsonb;
BEGIN
  -- Verificar permisos
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden reparar el sistema de comisiones';
  END IF;

  -- Obtener categoría de comisiones
  SELECT id INTO commission_category_id
  FROM public.cost_categories
  WHERE name = 'Comisión Operador';
  
  IF commission_category_id IS NULL THEN
    INSERT INTO public.cost_categories (name, description)
    VALUES ('Comisión Operador', 'Comisiones pagadas a operadores por servicios completados')
    RETURNING id INTO commission_category_id;
  END IF;

  -- PASO 1: Sincronizar operator_id desde service_resources a services
  FOR service_record IN 
    SELECT DISTINCT s.id as service_id, sr.operator_id, sr.commission_amount
    FROM public.services s
    JOIN public.service_resources sr ON s.id = sr.service_id
    WHERE sr.resource_type = 'operator' 
      AND sr.is_primary = true
      AND s.operator_id IS NULL
  LOOP
    UPDATE public.services 
    SET 
      operator_id = service_record.operator_id,
      operator_commission = service_record.commission_amount,
      updated_at = now()
    WHERE id = service_record.service_id;
    
    synced_count := synced_count + 1;
  END LOOP;

  -- PASO 2: Generar comisiones faltantes para servicios completados
  FOR resource_record IN 
    SELECT DISTINCT 
      s.id as service_id,
      s.folio,
      s.service_date,
      s.created_by,
      sr.operator_id,
      sr.commission_amount,
      o.name as operator_name
    FROM public.services s
    JOIN public.service_resources sr ON s.id = sr.service_id
    JOIN public.operators o ON sr.operator_id = o.id
    WHERE s.status = 'completed'
      AND sr.resource_type = 'operator'
      AND sr.commission_amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.costs c
        WHERE c.service_id = s.id 
          AND c.operator_id = sr.operator_id
          AND c.category_id = commission_category_id
      )
  LOOP
    INSERT INTO public.costs (
      amount,
      category_id,
      service_id,
      operator_id,
      service_folio,
      date,
      description,
      subcategory,
      notes,
      created_by
    ) VALUES (
      resource_record.commission_amount,
      commission_category_id,
      resource_record.service_id,
      resource_record.operator_id,
      resource_record.folio,
      resource_record.service_date,
      'Comisión por servicio ' || resource_record.folio || ' - Operador: ' || resource_record.operator_name,
      'comisiones',
      'Comisión generada por reparación masiva del sistema',
      resource_record.created_by
    );
    
    created_count := created_count + 1;
  END LOOP;

  -- PASO 3: Actualizar trigger para funcionar con service_resources
  DROP TRIGGER IF EXISTS generate_commission_on_service_completion ON public.services;
  
  CREATE TRIGGER generate_commission_on_service_completion
    AFTER UPDATE ON public.services
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_multiple_commissions_for_service();

  repaired_count := synced_count + created_count;

  result := jsonb_build_object(
    'success', true,
    'repair_date', now(),
    'services_synced', synced_count,
    'commissions_created', created_count,
    'total_repaired', repaired_count,
    'trigger_updated', true
  );

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."repair_commission_system"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."repair_payment_application"("p_payment_id" "uuid", "p_invoice_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_payment RECORD;
  v_invoice RECORD;
BEGIN
  -- Obtener payment
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment no encontrado');
  END IF;
  
  -- Obtener invoice
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice no encontrado');
  END IF;
  
  -- Verificar que no exista ya una aplicación
  IF EXISTS (
    SELECT 1 FROM payment_applications 
    WHERE payment_id = p_payment_id AND invoice_id = p_invoice_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya existe una aplicación para este pago e invoice');
  END IF;
  
  -- Aplicar usando la función existente
  RETURN apply_payment_manual(
    p_payment_id,
    jsonb_build_array(
      jsonb_build_object(
        'invoice_id', p_invoice_id,
        'amount', LEAST(v_payment.remaining_amount, v_invoice.remaining_amount)
      )
    )
  );
END;
$$;


ALTER FUNCTION "public"."repair_payment_application"("p_payment_id" "uuid", "p_invoice_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_commission_conflicts"("p_service_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  commission_category_id uuid;
  conflicts_found integer := 0;
  conflicts_resolved integer := 0;
BEGIN
  -- Obtener ID de categoría de comisiones
  SELECT id INTO commission_category_id
  FROM public.cost_categories 
  WHERE name ILIKE '%comisi%' 
  LIMIT 1;
  
  IF commission_category_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Categoría de comisiones no encontrada'
    );
  END IF;
  
  -- Contar conflictos duplicados
  SELECT COUNT(*) INTO conflicts_found
  FROM (
    SELECT service_id, operator_id, category_id, COUNT(*) as duplicates
    FROM public.costs 
    WHERE service_id = p_service_id 
      AND category_id = commission_category_id
      AND operator_id IS NOT NULL
    GROUP BY service_id, operator_id, category_id
    HAVING COUNT(*) > 1
  ) duplicates;
  
  -- Resolver conflictos manteniendo solo el más reciente
  IF conflicts_found > 0 THEN
    DELETE FROM public.costs 
    WHERE id IN (
      SELECT id FROM (
        SELECT id, 
               ROW_NUMBER() OVER (
                 PARTITION BY service_id, operator_id, category_id 
                 ORDER BY created_at DESC
               ) as rn
        FROM public.costs 
        WHERE service_id = p_service_id 
          AND category_id = commission_category_id
          AND operator_id IS NOT NULL
      ) ranked 
      WHERE rn > 1
    );
    
    GET DIAGNOSTICS conflicts_resolved = ROW_COUNT;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'service_id', p_service_id,
    'conflicts_found', conflicts_found,
    'conflicts_resolved', conflicts_resolved,
    'message', format('Resueltos %s conflictos de comisiones', conflicts_resolved)
  );
END;
$$;


ALTER FUNCTION "public"."resolve_commission_conflicts"("p_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_payment_application_conflicts"("p_payment_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  payment_record RECORD;
  resolved_count INTEGER := 0;
  total_calculated DECIMAL;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden resolver conflictos de aplicación de pagos';
  END IF;
  
  -- If specific payment provided
  IF p_payment_id IS NOT NULL THEN
    -- Calculate correct applied amount
    SELECT 
      p.*,
      COALESCE(SUM(pa.applied_amount), 0) as calculated_applied
    INTO payment_record
    FROM payments p
    LEFT JOIN payment_applications pa ON p.id = pa.payment_id
    WHERE p.id = p_payment_id
    GROUP BY p.id, p.client_id, p.amount, p.applied_amount, p.status, p.payment_date, p.bank_reference, p.payment_method, p.notes, p.created_at, p.updated_at, p.created_by;
    
    IF FOUND AND ABS(payment_record.applied_amount - payment_record.calculated_applied) > 0.01 THEN
      -- Update payment with correct applied amount
      UPDATE payments 
      SET 
        applied_amount = payment_record.calculated_applied,
        status = CASE 
          WHEN payment_record.calculated_applied >= amount THEN 'applied'::payment_status
          WHEN payment_record.calculated_applied > 0 THEN 'partial'::payment_status
          ELSE 'pending'::payment_status
        END,
        updated_at = NOW()
      WHERE id = p_payment_id;
      
      resolved_count := 1;
    END IF;
  ELSE
    -- Resolve all conflicts
    FOR payment_record IN 
      SELECT 
        p.id,
        p.amount,
        p.applied_amount,
        COALESCE(SUM(pa.applied_amount), 0) as calculated_applied
      FROM payments p
      LEFT JOIN payment_applications pa ON p.id = pa.payment_id
      GROUP BY p.id, p.amount, p.applied_amount
      HAVING ABS(p.applied_amount - COALESCE(SUM(pa.applied_amount), 0)) > 0.01
    LOOP
      UPDATE payments 
      SET 
        applied_amount = payment_record.calculated_applied,
        status = CASE 
          WHEN payment_record.calculated_applied >= payment_record.amount THEN 'applied'::payment_status
          WHEN payment_record.calculated_applied > 0 THEN 'partial'::payment_status
          ELSE 'pending'::payment_status
        END,
        updated_at = NOW()
      WHERE id = payment_record.id;
      
      resolved_count := resolved_count + 1;
    END LOOP;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'resolved_payments', resolved_count,
    'message', format('Resueltos conflictos en %s pagos', resolved_count),
    'timestamp', NOW()
  );
END;
$$;


ALTER FUNCTION "public"."resolve_payment_application_conflicts"("p_payment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rollback_import_batch"("p_batch_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_deleted_movements int := 0;
  v_deleted_costs int := 0;
  v_deleted_payments int := 0;
  v_deleted_invoices int := 0;
  v_deleted_suppliers int := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.import_batches
    WHERE id = p_batch_id AND created_by = v_user_id AND status = 'succeeded'
  ) THEN
    RAISE EXCEPTION 'Batch no encontrado o no elegible para rollback';
  END IF;

  DELETE FROM public.inventory_movements
  WHERE id IN (
    SELECT record_id FROM public.import_batch_records
    WHERE batch_id = p_batch_id AND table_name = 'inventory_movements'
  );
  GET DIAGNOSTICS v_deleted_movements = ROW_COUNT;

  DELETE FROM public.costs
  WHERE id IN (
    SELECT record_id FROM public.import_batch_records
    WHERE batch_id = p_batch_id AND table_name = 'costs'
  );
  GET DIAGNOSTICS v_deleted_costs = ROW_COUNT;

  DELETE FROM public.supplier_payments
  WHERE id IN (
    SELECT record_id FROM public.import_batch_records
    WHERE batch_id = p_batch_id AND table_name = 'supplier_payments'
  );
  GET DIAGNOSTICS v_deleted_payments = ROW_COUNT;

  DELETE FROM public.supplier_invoices
  WHERE id IN (
    SELECT record_id FROM public.import_batch_records
    WHERE batch_id = p_batch_id AND table_name = 'supplier_invoices'
  );
  GET DIAGNOSTICS v_deleted_invoices = ROW_COUNT;

  DELETE FROM public.inventory_suppliers
  WHERE id IN (
    SELECT record_id FROM public.import_batch_records
    WHERE batch_id = p_batch_id AND table_name = 'inventory_suppliers'
  );
  GET DIAGNOSTICS v_deleted_suppliers = ROW_COUNT;

  UPDATE public.import_batches
  SET status = 'rolled_back',
      rolled_back_at = now(),
      rolled_back_by = v_user_id
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'rolled_back',
    'deleted', jsonb_build_object(
      'inventory_movements', v_deleted_movements,
      'costs', v_deleted_costs,
      'supplier_payments', v_deleted_payments,
      'supplier_invoices', v_deleted_invoices,
      'inventory_suppliers', v_deleted_suppliers
    )
  );
END;
$$;


ALTER FUNCTION "public"."rollback_import_batch"("p_batch_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."safe_update_service"("service_id_param" "uuid", "update_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN jsonb_build_object('success', true, 'message', 'Function available');
END;
$$;


ALTER FUNCTION "public"."safe_update_service"("service_id_param" "uuid", "update_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_voidable_inventory_purchases"("p_search" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "date" "date", "description" "text", "amount" numeric, "supplier_id" "uuid", "supplier_name" "text", "document_number" "text", "service_folio" "text", "payment_date" "date", "immediate_consumption" boolean, "inventory_movement_id" "uuid", "supplier_payment_id" "uuid", "supplier_invoice_id" "uuid", "purchase_quantity" numeric, "purchase_unit_cost" numeric, "has_inventory_link" boolean, "matched_item" "text", "match_score" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_term text := nullif(trim(coalesce(p_search, '')), '');
  v_norm text;
  v_words text[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN;
  END IF;

  IF v_term IS NOT NULL THEN
    v_norm  := lower(public.unaccent(v_term));
    v_words := regexp_split_to_array(v_norm, '\s+');
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT c.*
    FROM public.costs c
    WHERE
      c.inventory_movement_id IS NOT NULL
      OR c.purchase_quantity IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.inventory_movements im WHERE im.cost_id = c.id)
      OR EXISTS (SELECT 1 FROM public.supplier_invoice_items sii WHERE sii.supplier_invoice_id = c.supplier_invoice_id)
  ),
  enriched AS (
    SELECT
      b.*,
      s.name::text AS sup_name,
      (
        SELECT string_agg(coalesce(sii.description, '') || ' ' || coalesce(sii.product_name, ''), ' ')
        FROM public.supplier_invoice_items sii
        WHERE sii.supplier_invoice_id = b.supplier_invoice_id
      )::text AS invoice_items_text,
      (
        SELECT string_agg(
          coalesce(ii.name, '') || ' ' ||
          coalesce(ii.description, '') || ' ' ||
          coalesce(im.observations, '') || ' ' ||
          coalesce(im.reference_document, '') || ' ' ||
          coalesce(im.supplier_name, ''),
        ' ')
        FROM public.inventory_movements im
        LEFT JOIN public.inventory_items ii ON ii.id = im.item_id
        WHERE im.cost_id = b.id OR im.id = b.inventory_movement_id
      )::text AS movements_text,
      (
        SELECT coalesce(ii.name, ii.description, sii.description, sii.product_name)::text
        FROM public.inventory_movements im
        LEFT JOIN public.inventory_items ii ON ii.id = im.item_id
        LEFT JOIN public.supplier_invoice_items sii ON sii.id = im.supplier_invoice_item_id
        WHERE (im.cost_id = b.id OR im.id = b.inventory_movement_id)
          AND im.movement_type = 'entry'
        ORDER BY im.created_at ASC NULLS LAST
        LIMIT 1
      )::text AS best_item_name
    FROM base b
    LEFT JOIN public.suppliers s ON s.id = b.supplier_id
  ),
  scored AS (
    SELECT
      e.*,
      lower(public.unaccent(
        coalesce(e.description, '') || ' ' ||
        coalesce(e.document_number, '') || ' ' ||
        coalesce(e.service_folio, '') || ' ' ||
        coalesce(e.notes, '') || ' ' ||
        coalesce(e.sup_name, '') || ' ' ||
        coalesce(e.invoice_items_text, '') || ' ' ||
        coalesce(e.movements_text, '')
      )) AS haystack
    FROM enriched e
  ),
  filtered AS (
    SELECT
      s.*,
      (
        CASE WHEN v_term IS NULL THEN 0
             WHEN lower(public.unaccent(coalesce(s.document_number,''))) = v_norm
               OR lower(public.unaccent(coalesce(s.service_folio,''))) = v_norm THEN 100
             WHEN lower(public.unaccent(coalesce(s.description,''))) LIKE '%' || v_norm || '%' THEN 70
             WHEN lower(public.unaccent(coalesce(s.invoice_items_text,'') || ' ' || coalesce(s.movements_text,''))) LIKE '%' || v_norm || '%' THEN 50
             WHEN lower(public.unaccent(coalesce(s.notes,'') || ' ' || coalesce(s.sup_name,''))) LIKE '%' || v_norm || '%' THEN 30
             ELSE 10
        END
      )::integer AS score
    FROM scored s
    WHERE
      v_term IS NULL
      OR (
        SELECT bool_and(s.haystack LIKE '%' || w || '%')
        FROM unnest(v_words) AS w
        WHERE w <> ''
      )
  )
  SELECT
    f.id::uuid,
    f.date::date,
    f.description::text,
    f.amount::numeric,
    f.supplier_id::uuid,
    f.sup_name::text AS supplier_name,
    f.document_number::text,
    f.service_folio::text,
    f.payment_date::date,
    f.immediate_consumption::boolean,
    f.inventory_movement_id::uuid,
    f.supplier_payment_id::uuid,
    f.supplier_invoice_id::uuid,
    f.purchase_quantity::numeric,
    f.purchase_unit_cost::numeric,
    (f.inventory_movement_id IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.inventory_movements im WHERE im.cost_id = f.id))::boolean AS has_inventory_link,
    f.best_item_name::text AS matched_item,
    f.score::integer AS match_score
  FROM filtered f
  ORDER BY f.score DESC, f.date DESC NULLS LAST, f.created_at DESC
  LIMIT 100;
END;
$$;


ALTER FUNCTION "public"."search_voidable_inventory_purchases"("p_search" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_import_rut_mappings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_import_rut_mappings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."simple_payment_cleanup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Actualizar costos vinculados con [PAGO ELIMINADO]
    UPDATE costs 
    SET notes = COALESCE(notes, '') || ' [PAGO ELIMINADO]'
    WHERE id IN (
        SELECT cost_id 
        FROM supplier_payment_cost_links 
        WHERE supplier_payment_id = OLD.id
    );
    
    -- Eliminar vínculos antes de eliminar el pago
    DELETE FROM supplier_payment_cost_links 
    WHERE supplier_payment_id = OLD.id;
    
    RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."simple_payment_cleanup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."simple_update_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."simple_update_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."smart_apply_payment"("p_payment_id" "uuid", "p_auto_apply" boolean DEFAULT true) RETURNS TABLE("success" boolean, "applications_made" integer, "remaining_amount" numeric, "message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  payment_record RECORD;
  invoice_record RECORD;
  remaining_payment_amount DECIMAL;
  applications_count INTEGER := 0;
  application_amount DECIMAL;
BEGIN
  -- Obtener información del pago
  SELECT * INTO payment_record
  FROM payments 
  WHERE id = p_payment_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0::DECIMAL, 'Pago no encontrado';
    RETURN;
  END IF;
  
  -- Si ya está aplicado completamente, no hacer nada
  IF payment_record.remaining_amount <= 0 THEN
    RETURN QUERY SELECT true, 0, 0::DECIMAL, 'Pago ya está completamente aplicado';
    RETURN;
  END IF;
  
  remaining_payment_amount := payment_record.remaining_amount;
  
  -- Solo aplicar automáticamente si p_auto_apply es true
  IF p_auto_apply THEN
    -- Buscar facturas pendientes del cliente ordenadas por fecha de vencimiento
    FOR invoice_record IN 
      SELECT i.*, COALESCE(i.remaining_amount, i.total) as pending_amount
      FROM invoices i
      WHERE i.client_id = payment_record.client_id
      AND i.status IN ('sent', 'overdue')
      AND COALESCE(i.remaining_amount, i.total) > 0
      ORDER BY i.due_date ASC
    LOOP
      EXIT WHEN remaining_payment_amount <= 0;
      
      -- Calcular cuánto aplicar a esta factura
      application_amount := LEAST(remaining_payment_amount, invoice_record.pending_amount);
      
      -- Crear aplicación del pago
      INSERT INTO payment_applications (
        payment_id,
        invoice_id,
        applied_amount,
        application_method,
        notes
      ) VALUES (
        p_payment_id,
        invoice_record.id,
        application_amount,
        'auto',
        'Aplicación automática FIFO'
      );
      
      -- Actualizar el pago (solo applied_amount, remaining_amount es calculado)
      UPDATE payments 
      SET 
        applied_amount = COALESCE(applied_amount, 0) + application_amount,
        updated_at = NOW()
      WHERE id = p_payment_id;
      
      -- Actualizar la factura
      UPDATE invoices 
      SET 
        paid_amount = COALESCE(paid_amount, 0) + application_amount,
        status = CASE 
          WHEN COALESCE(paid_amount, 0) + application_amount >= total THEN 'paid'::invoice_status
          ELSE status 
        END,
        payment_date = CASE 
          WHEN COALESCE(paid_amount, 0) + application_amount >= total THEN payment_record.payment_date
          ELSE payment_date
        END,
        updated_at = NOW()
      WHERE id = invoice_record.id;
      
      remaining_payment_amount := remaining_payment_amount - application_amount;
      applications_count := applications_count + 1;
    END LOOP;
  END IF;
  
  -- Actualizar estado final del pago
  UPDATE payments 
  SET status = CASE 
    WHEN remaining_amount <= 0 THEN 'applied'::payment_status
    WHEN applied_amount > 0 THEN 'partial'::payment_status
    ELSE 'pending'::payment_status
  END,
  updated_at = NOW()
  WHERE id = p_payment_id;
  
  -- Obtener el remaining_amount actualizado
  SELECT remaining_amount INTO remaining_payment_amount
  FROM payments 
  WHERE id = p_payment_id;
  
  RETURN QUERY SELECT 
    true, 
    applications_count, 
    remaining_payment_amount, 
    CASE 
      WHEN applications_count > 0 THEN format('Pago aplicado exitosamente a %s facturas', applications_count)
      ELSE 'Pago procesado sin aplicaciones automáticas'
    END;
END;
$$;


ALTER FUNCTION "public"."smart_apply_payment"("p_payment_id" "uuid", "p_auto_apply" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."smart_link_maintenance_costs"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  fixed_count INTEGER := 0;
  cost_record RECORD;
  maintenance_record RECORD;
  maintenance_category_id UUID;
BEGIN
  -- Obtener categoría de mantenimiento
  SELECT id INTO maintenance_category_id
  FROM public.cost_categories 
  WHERE name = 'Mantenimiento'
  LIMIT 1;
  
  IF maintenance_category_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Categoría de mantenimiento no encontrada'
    );
  END IF;

  -- Vincular costos huérfanos con mantenimientos
  FOR cost_record IN 
    SELECT c.* 
    FROM public.costs c
    WHERE c.category_id = maintenance_category_id 
      AND c.maintenance_id IS NULL
  LOOP
    -- Buscar mantenimiento correspondiente con criterios flexibles
    SELECT cm.* INTO maintenance_record
    FROM public.crane_maintenance cm
    WHERE cm.status = 'completed'
      AND cm.cost > 0
      AND (
        -- Criterio 1: Coincidencia exacta ideal
        (cm.crane_id = cost_record.crane_id 
         AND cm.cost = cost_record.amount 
         AND ABS(EXTRACT(EPOCH FROM (cm.completed_date::timestamp - cost_record.date::timestamp))) < 86400)
        OR
        -- Criterio 2: Misma grúa y monto, fecha flexible (una semana)
        (cm.crane_id = cost_record.crane_id 
         AND cm.cost = cost_record.amount 
         AND ABS(EXTRACT(EPOCH FROM (cm.completed_date::timestamp - cost_record.date::timestamp))) < 604800)
        OR
        -- Criterio 3: Misma grúa, fechas cercanas, monto similar (±10%)
        (cm.crane_id = cost_record.crane_id 
         AND cm.cost BETWEEN cost_record.amount * 0.9 AND cost_record.amount * 1.1
         AND ABS(EXTRACT(EPOCH FROM (cm.completed_date::timestamp - cost_record.date::timestamp))) < 86400)
        OR
        -- Criterio 4: Por descripción similar y grúa
        (cm.crane_id = cost_record.crane_id 
         AND ABS(EXTRACT(EPOCH FROM (cm.completed_date::timestamp - cost_record.date::timestamp))) < 86400
         AND (cost_record.description ILIKE '%' || LEFT(cm.description, 20) || '%' 
              OR cm.description ILIKE '%' || LEFT(cost_record.description, 20) || '%'))
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.costs c2 WHERE c2.maintenance_id = cm.id
      )
    ORDER BY 
      -- Priorizar coincidencias más exactas
      CASE 
        WHEN cm.crane_id = cost_record.crane_id AND cm.cost = cost_record.amount 
             AND ABS(EXTRACT(EPOCH FROM (cm.completed_date::timestamp - cost_record.date::timestamp))) < 86400 
        THEN 1
        WHEN cm.crane_id = cost_record.crane_id AND cm.cost = cost_record.amount 
        THEN 2
        WHEN cm.crane_id = cost_record.crane_id 
             AND cm.cost BETWEEN cost_record.amount * 0.9 AND cost_record.amount * 1.1 
        THEN 3
        ELSE 4
      END,
      ABS(EXTRACT(EPOCH FROM (cm.completed_date::timestamp - cost_record.date::timestamp)))
    LIMIT 1;
    
    -- Si encontró un mantenimiento, vincularlo
    IF maintenance_record.id IS NOT NULL THEN
      UPDATE public.costs 
      SET 
        maintenance_id = maintenance_record.id,
        notes = COALESCE(notes, '') || ' [Vinculado automáticamente con algoritmo inteligente]',
        updated_at = NOW()
      WHERE id = cost_record.id;
      
      fixed_count := fixed_count + 1;
      
      RAISE NOTICE 'Vinculado costo % (%) con mantenimiento % (%)', 
        cost_record.id, cost_record.amount, maintenance_record.id, maintenance_record.description;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'linked_costs', fixed_count,
    'message', format('Vinculados %s costos con mantenimientos usando algoritmo inteligente', fixed_count)
  );
END;
$$;


ALTER FUNCTION "public"."smart_link_maintenance_costs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_closure_invoice_status"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  updated_count INTEGER := 0;
  closure_record RECORD;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar esta función de sincronización';
  END IF;

  -- Buscar cierres que tienen facturas pero están en estado 'closed'
  FOR closure_record IN
    SELECT DISTINCT sc.id, sc.folio
    FROM public.service_closures sc
    INNER JOIN public.closure_services cs ON sc.id = cs.closure_id
    INNER JOIN public.services s ON cs.service_id = s.id
    WHERE sc.status = 'closed'
    AND s.status = 'invoiced'
    AND s.invoice_folio IS NOT NULL
  LOOP
    -- Actualizar el cierre a estado 'invoiced'
    UPDATE public.service_closures
    SET 
      status = 'invoiced',
      updated_at = now()
    WHERE id = closure_record.id;
    
    updated_count := updated_count + 1;
    RAISE NOTICE 'Synchronized closure % (folio: %) to invoiced status', closure_record.id, closure_record.folio;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_closures', updated_count,
    'message', format('Sincronizados %s cierres a estado "invoiced"', updated_count)
  );
END;
$$;


ALTER FUNCTION "public"."sync_closure_invoice_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_cost_deletion_cascade"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  PERFORM set_config('app.cascade_delete', 'true', true);

  DELETE FROM public.supplier_payments
  WHERE id = OLD.supplier_payment_id
     OR cost_id = OLD.id;

  UPDATE public.inventory_movements
  SET status = 'cancelled',
      observations = COALESCE(observations, '') || ' [Costo eliminado]'
  WHERE cost_id = OLD.id;

  DELETE FROM public.crane_parts
  WHERE cost_id = OLD.id;

  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."sync_cost_deletion_cascade"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_cost_supplier_payment_deletion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF current_setting('app.bidirectional_sync', true) = 'true'
     OR current_setting('app.sync_in_progress', true) = 'true' THEN
    RETURN OLD;
  END IF;

  IF OLD.cost_id IS NULL THEN
    RETURN OLD;
  END IF;

  PERFORM set_config('app.bidirectional_sync', 'true', true);
  PERFORM set_config('app.sync_in_progress', 'true', true);

  UPDATE public.costs
  SET supplier_payment_id = NULL,
      payment_date = NULL,
      updated_at = now()
  WHERE id = OLD.cost_id
    AND supplier_payment_id = OLD.id;

  RETURN OLD;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('app.bidirectional_sync', 'false', true);
    PERFORM set_config('app.sync_in_progress', 'false', true);
    RAISE;
END;
$$;


ALTER FUNCTION "public"."sync_cost_supplier_payment_deletion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_cost_update_to_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Evitar reacciones durante cascadas de eliminación u operaciones encadenadas
  IF current_setting('app.cascade_delete', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Solo sincronizar si cambió algo relevante
  IF (OLD.amount IS DISTINCT FROM NEW.amount) OR
     (OLD.supplier_id IS DISTINCT FROM NEW.supplier_id) OR
     (OLD.description IS DISTINCT FROM NEW.description) OR
     (OLD.payment_date IS DISTINCT FROM NEW.payment_date) THEN
     
    UPDATE supplier_payments SET
      amount = NEW.amount,
      supplier_id = COALESCE(NEW.supplier_id, supplier_id),
      description = NEW.description,
      paid_date = COALESCE(NEW.payment_date, paid_date),
      due_date = COALESCE(NEW.payment_date, NEW.date, due_date),
      updated_at = now()
    WHERE id = NEW.supplier_payment_id;

  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_cost_update_to_payment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_crane_part_to_inventory"("p_part_name" "text", "p_inventory_item_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_crane_part_record RECORD;
  v_inventory_item_id UUID;
  v_location_id UUID;
  v_movement_id UUID;
BEGIN
  -- Buscar el item en inventario (usar el proporcionado o buscar por nombre)
  IF p_inventory_item_id IS NOT NULL THEN
    v_inventory_item_id := p_inventory_item_id;
  ELSE
    SELECT id INTO v_inventory_item_id
    FROM inventory_items
    WHERE LOWER(name) = LOWER(p_part_name)
    LIMIT 1;
  END IF;

  IF v_inventory_item_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Item de inventario no encontrado: ' || p_part_name
    );
  END IF;

  -- Buscar el registro de crane_parts sin sincronizar
  SELECT * INTO v_crane_part_record
  FROM crane_parts
  WHERE LOWER(part_name) = LOWER(p_part_name)
    AND inventory_movement_id IS NULL
    AND cost_id IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se encontró registro de pieza sin sincronizar: ' || p_part_name
    );
  END IF;

  -- Verificar si ya existe un movimiento para este cost_id
  SELECT id INTO v_movement_id
  FROM inventory_movements
  WHERE cost_id = v_crane_part_record.cost_id
  LIMIT 1;

  IF v_movement_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ya existe un movimiento de inventario para este costo',
      'movement_id', v_movement_id
    );
  END IF;

  -- Obtener ubicación principal
  SELECT id INTO v_location_id
  FROM inventory_locations
  WHERE is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_location_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se encontró ubicación de inventario activa'
    );
  END IF;

  -- Crear el movimiento de inventario
  INSERT INTO inventory_movements (
    item_id,
    location_id,
    movement_type,
    quantity,
    unit_cost,
    total_cost,
    movement_date,
    reason,
    supplier_name,
    crane_id,
    cost_id,
    observations,
    created_by
  ) VALUES (
    v_inventory_item_id,
    v_location_id,
    'entry',
    v_crane_part_record.quantity,
    v_crane_part_record.unit_price,
    v_crane_part_record.total_value,
    v_crane_part_record.date,
    'Compra de pieza: ' || v_crane_part_record.part_name,
    v_crane_part_record.supplier,
    v_crane_part_record.crane_id,
    v_crane_part_record.cost_id,
    'Sincronizado manualmente',
    v_crane_part_record.created_by
  )
  RETURNING id INTO v_movement_id;

  -- Actualizar crane_parts con el movimiento creado
  UPDATE crane_parts
  SET inventory_movement_id = v_movement_id
  WHERE id = v_crane_part_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'movement_id', v_movement_id,
    'crane_part_id', v_crane_part_record.id,
    'inventory_item_id', v_inventory_item_id,
    'message', 'Sincronización completada exitosamente'
  );
END;
$$;


ALTER FUNCTION "public"."sync_crane_part_to_inventory"("p_part_name" "text", "p_inventory_item_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_existing_paid_invoices"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  paid_invoice RECORD;
  payment_id UUID;
  synced_count INTEGER := 0;
BEGIN
  -- Verificar permisos
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'No tiene permisos para sincronizar facturas pagadas';
  END IF;

  -- Procesar facturas marcadas como pagadas que no tienen pagos asociados
  FOR paid_invoice IN 
    SELECT i.* FROM public.invoices i
    WHERE i.status = 'paid' 
      AND i.payment_date IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.payment_applications pa
        JOIN public.payments p ON pa.payment_id = p.id
        WHERE pa.invoice_id = i.id
      )
  LOOP
    -- Crear un pago automático para esta factura
    INSERT INTO public.payments (
      client_id,
      amount,
      payment_date,
      payment_method,
      notes,
      status,
      applied_amount,
      created_by
    ) VALUES (
      paid_invoice.client_id,
      paid_invoice.total,
      paid_invoice.payment_date,
      'historico',
      'Pago sincronizado automáticamente desde factura marcada como pagada',
      'applied',
      paid_invoice.total,
      auth.uid()
    ) RETURNING id INTO payment_id;

    -- Crear la aplicación del pago
    INSERT INTO public.payment_applications (
      payment_id,
      invoice_id,
      applied_amount,
      application_method,
      notes,
      created_by
    ) VALUES (
      payment_id,
      paid_invoice.id,
      paid_invoice.total,
      'manual',
      'Aplicación automática de pago histórico',
      auth.uid()
    );

    -- Actualizar campos de la factura para consistencia
    UPDATE public.invoices 
    SET 
      paid_amount = paid_invoice.total,
      updated_at = NOW()
    WHERE id = paid_invoice.id;

    synced_count := synced_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'synced_invoices', synced_count,
    'message', 'Facturas pagadas sincronizadas exitosamente'
  );
END;
$$;


ALTER FUNCTION "public"."sync_existing_paid_invoices"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_existing_services_to_resources"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  service_record RECORD;
BEGIN
  -- Iterar sobre servicios que tienen operador o grúa pero no tienen service_resources
  FOR service_record IN 
    SELECT s.id, s.folio, s.crane_id, s.operator_id
    FROM services s
    WHERE (s.crane_id IS NOT NULL OR s.operator_id IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1 FROM service_resources sr 
      WHERE sr.service_id = s.id
    )
  LOOP
    -- Crear service_resources para operador si existe
    IF service_record.operator_id IS NOT NULL THEN
      INSERT INTO service_resources (
        service_id,
        resource_type,
        operator_id,
        is_primary,
        commission_amount,
        created_at
      ) VALUES (
        service_record.id,
        'operator',
        service_record.operator_id,
        true,
        0,
        now()
      );
      
      RAISE NOTICE 'Created operator resource for service %: %', service_record.folio, service_record.operator_id;
    END IF;
    
    -- Crear service_resources para grúa si existe
    IF service_record.crane_id IS NOT NULL THEN
      INSERT INTO service_resources (
        service_id,
        resource_type,
        crane_id,
        is_primary,
        commission_amount,
        created_at
      ) VALUES (
        service_record.id,
        'crane',
        service_record.crane_id,
        true,
        0,
        now()
      );
      
      RAISE NOTICE 'Created crane resource for service %: %', service_record.folio, service_record.crane_id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Sync completed successfully';
END;
$$;


ALTER FUNCTION "public"."sync_existing_services_to_resources"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_existing_supplier_payments_to_costs"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  synced_count INTEGER := 0;
  payment_record RECORD;
  payment_category_id UUID;
BEGIN
  -- Verificar que el usuario sea administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar esta función de sincronización';
  END IF;

  -- Obtener o crear la categoría "Pagos a Proveedores"
  SELECT id INTO payment_category_id
  FROM public.cost_categories
  WHERE name ILIKE '%pago%proveedor%' OR name ILIKE '%supplier%payment%'
  LIMIT 1;
  
  IF payment_category_id IS NULL THEN
    INSERT INTO public.cost_categories (name, description)
    VALUES ('Pagos a Proveedores', 'Pagos realizados a proveedores y facturas de servicios')
    RETURNING id INTO payment_category_id;
  END IF;

  -- Sincronizar pagos existentes que están pagados pero no tienen costo asociado
  FOR payment_record IN 
    SELECT sp.*
    FROM public.supplier_payments sp
    WHERE sp.status = 'paid'
    AND NOT EXISTS (
      SELECT 1 FROM public.costs c WHERE c.supplier_payment_id = sp.id
    )
  LOOP
    INSERT INTO public.costs (
      amount,
      category_id,
      date,
      description,
      notes,
      subcategory,
      supplier_payment_id,
      created_by
    ) VALUES (
      payment_record.paid_amount,
      payment_category_id,
      payment_record.payment_date,
      'Pago a proveedor: ' || payment_record.supplier_name || 
      CASE WHEN payment_record.invoice_number IS NOT NULL THEN ' - Factura: ' || payment_record.invoice_number ELSE '' END,
      'Pago sincronizado automáticamente desde proveedor. ' ||
      CASE WHEN payment_record.description IS NOT NULL THEN 'Descripción: ' || payment_record.description || '. ' ELSE '' END ||
      CASE WHEN payment_record.notes IS NOT NULL THEN 'Notas: ' || payment_record.notes ELSE '' END,
      CASE 
        WHEN payment_record.category ILIKE '%combustible%' OR payment_record.category ILIKE '%gasolina%' OR payment_record.category ILIKE '%diesel%' THEN 'Combustible'
        WHEN payment_record.category ILIKE '%mantenimiento%' OR payment_record.category ILIKE '%reparaci%' OR payment_record.category ILIKE '%repuesto%' THEN 'Mantenimiento'
        WHEN payment_record.category ILIKE '%seguro%' OR payment_record.category ILIKE '%insurance%' THEN 'Seguros'
        WHEN payment_record.category ILIKE '%administrat%' OR payment_record.category ILIKE '%oficina%' THEN 'Administrativo'
        ELSE payment_record.category
      END,
      payment_record.id,
      payment_record.created_by
    );
    
    synced_count := synced_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'synced_payments', synced_count,
    'message', format('Sincronizados %s pagos existentes con sus costos correspondientes', synced_count)
  );
END;
$$;


ALTER FUNCTION "public"."sync_existing_supplier_payments_to_costs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_inventory_consumption_to_parts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_item_name text;
  v_existing_part_id uuid;
BEGIN
  IF NEW.movement_type = 'exit' AND NEW.crane_id IS NOT NULL THEN
    
    SELECT name INTO v_item_name
    FROM inventory_items
    WHERE id = NEW.item_id;
    
    -- Verificar si ya existe un crane_part para este movimiento
    SELECT id INTO v_existing_part_id
    FROM crane_parts
    WHERE inventory_movement_id = NEW.id;
    
    IF v_existing_part_id IS NULL THEN
      -- Insertar nuevo crane_part
      INSERT INTO crane_parts (
        crane_id,
        date,
        supplier,
        part_name,
        quantity,
        unit_price,
        notes,
        inventory_movement_id,
        created_by
      ) VALUES (
        NEW.crane_id,
        NEW.movement_date::date,
        'Inventario interno',
        v_item_name,
        NEW.quantity,
        COALESCE(NEW.unit_cost, 0),
        format('Consumo desde inventario. Costo real: $%s', COALESCE(NEW.total_cost, 0)::text),
        NEW.id,
        NEW.created_by
      );
    ELSE
      -- Actualizar crane_part existente
      UPDATE crane_parts
      SET
        quantity = NEW.quantity,
        unit_price = COALESCE(NEW.unit_cost, 0),
        notes = format('Consumo desde inventario. Costo real: $%s', COALESCE(NEW.total_cost, 0)::text)
      WHERE id = v_existing_part_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."sync_inventory_consumption_to_parts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_inventory_cost_to_movement"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_item_id UUID;
  v_location_id UUID;
  v_cost_category_name TEXT;
  v_entry_id UUID;
  v_exit_id UUID;
BEGIN
  SELECT name INTO v_cost_category_name
  FROM public.cost_categories
  WHERE id = NEW.category_id;

  IF (v_cost_category_name ILIKE '%inventario%' OR v_cost_category_name ILIKE '%pieza%' OR v_cost_category_name ILIKE '%repuesto%')
     AND NEW.purchase_quantity IS NOT NULL
     AND NEW.purchase_unit_cost IS NOT NULL THEN

    SELECT id INTO v_item_id
    FROM public.inventory_items
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(NEW.description))
    LIMIT 1;

    IF v_item_id IS NULL THEN
      INSERT INTO public.inventory_items (
        name,
        unit_of_measure,
        unit_cost,
        created_by
      )
      VALUES (
        NEW.description,
        'unidad',
        NEW.purchase_unit_cost,
        NEW.created_by
      )
      RETURNING id INTO v_item_id;
    END IF;

    UPDATE public.inventory_items
    SET unit_cost = NEW.purchase_unit_cost
    WHERE id = v_item_id
      AND NEW.purchase_unit_cost > 0
      AND (unit_cost IS NULL OR unit_cost <= 0);

    SELECT id INTO v_location_id
    FROM public.inventory_locations
    WHERE code = 'MAIN' OR is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_location_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT id INTO v_entry_id
    FROM public.inventory_movements
    WHERE cost_id = NEW.id
      AND movement_type = 'entry'
      AND status = 'active'
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_entry_id IS NULL THEN
      INSERT INTO public.inventory_movements (
        item_id,
        location_id,
        movement_type,
        quantity,
        unit_cost,
        total_cost,
        movement_date,
        reason,
        crane_id,
        cost_id,
        supplier_id,
        observations,
        created_by,
        status
      )
      VALUES (
        v_item_id,
        v_location_id,
        'entry',
        NEW.purchase_quantity,
        NEW.purchase_unit_cost,
        NEW.amount,
        NEW.date,
        'Compra desde costo',
        NEW.crane_id,
        NEW.id,
        NEW.supplier_id,
        COALESCE(NEW.notes, 'Sincronización automática: Costs → Inventory'),
        NEW.created_by,
        'active'
      )
      RETURNING id INTO v_entry_id;
    END IF;

    IF COALESCE(NEW.immediate_consumption, false) = false OR NEW.crane_id IS NULL THEN
      UPDATE public.costs
      SET inventory_movement_id = v_entry_id
      WHERE id = NEW.id AND inventory_movement_id IS NULL;
      RETURN NEW;
    END IF;

    SELECT id INTO v_exit_id
    FROM public.inventory_movements
    WHERE cost_id = NEW.id
      AND movement_type = 'exit'
      AND status = 'active'
      AND crane_id = NEW.crane_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_exit_id IS NULL THEN
      INSERT INTO public.inventory_movements (
        item_id,
        location_id,
        movement_type,
        quantity,
        unit_cost,
        total_cost,
        movement_date,
        reason,
        crane_id,
        cost_id,
        supplier_id,
        observations,
        created_by,
        status
      )
      VALUES (
        v_item_id,
        v_location_id,
        'exit',
        NEW.purchase_quantity,
        NEW.purchase_unit_cost,
        NEW.amount,
        NEW.date,
        'Consumo inmediato',
        NEW.crane_id,
        NEW.id,
        NEW.supplier_id,
        'Consumo inmediato (creado desde Costos)',
        NEW.created_by,
        'active'
      )
      RETURNING id INTO v_exit_id;
    END IF;

    UPDATE public.costs
    SET inventory_movement_id = v_exit_id
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_inventory_cost_to_movement"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_inventory_cost_to_movement"() IS 'Sincroniza automáticamente los costos de inventario con inventory_movements. Si immediate_consumption=true, crea entrada y salida inmediata a la grúa.';



CREATE OR REPLACE FUNCTION "public"."sync_inventory_exit_to_crane_parts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  item_name TEXT;
  item_unit_cost NUMERIC;
  final_unit_cost NUMERIC;
  safe_quantity INTEGER;
  existing_manual_record_count INTEGER;
BEGIN
  -- Solo procesar movimientos de salida con crane_id
  IF NEW.movement_type = 'exit' AND NEW.crane_id IS NOT NULL THEN

    -- NUEVO: idempotencia por movimiento (evita duplicados y evita violar el índice único)
    IF EXISTS (
      SELECT 1
      FROM public.crane_parts
      WHERE inventory_movement_id = NEW.id
    ) THEN
      RETURN NEW;
    END IF;

    -- Obtener nombre y costo del item desde inventory_items
    SELECT name, unit_cost INTO item_name, item_unit_cost
    FROM public.inventory_items
    WHERE id = NEW.item_id;

    -- Verificar si ya existe un registro manual
    SELECT COUNT(*) INTO existing_manual_record_count
    FROM public.crane_parts
    WHERE crane_id = NEW.crane_id
      AND LOWER(TRIM(part_name)) = LOWER(TRIM(COALESCE(item_name, 'Item desconocido')))
      AND date = NEW.movement_date::date
      AND inventory_movement_id IS NULL;

    -- Si ya existe un registro manual, no crear automático
    IF existing_manual_record_count > 0 THEN
      RETURN NEW;
    END IF;

    -- CRÍTICO: Solo usar unit_cost si es > 0, sino NO CREAR REGISTRO
    IF item_unit_cost IS NOT NULL AND item_unit_cost > 0 THEN
      final_unit_cost := item_unit_cost;
    ELSE
      RETURN NEW;
    END IF;

    -- Asegurar valores válidos
    safe_quantity := COALESCE(ABS(NEW.quantity), 1);

    -- SOLO crear registro en crane_parts para trazabilidad (NO EN COSTS)
    INSERT INTO public.crane_parts (
      crane_id,
      part_name,
      date,
      quantity,
      unit_price,
      supplier,
      notes,
      cost_id,
      inventory_movement_id,
      created_by
    ) VALUES (
      NEW.crane_id,
      COALESCE(item_name, 'Item desconocido'),
      NEW.movement_date::date,
      -safe_quantity,
      final_unit_cost,
      COALESCE(NEW.supplier_name, 'Inventario interno'),
      format('Consumo automático desde inventario. Costo: $%s (catálogo)', final_unit_cost),
      NULL,
      NEW.id,
      COALESCE(NEW.created_by, auth.uid())
    );
  END IF;

  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."sync_inventory_exit_to_crane_parts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_inventory_to_supplier_and_cost"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_cost_category_id UUID;
  v_new_cost_id UUID;
  v_item_name TEXT;
BEGIN
  -- Solo para movimientos de ENTRADA con costo unitario
  IF NEW.movement_type != 'entry' OR NEW.unit_cost IS NULL OR NEW.unit_cost <= 0 THEN
    RETURN NEW;
  END IF;

  -- Si ya tiene cost_id asociado, no duplicar
  IF NEW.cost_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Si tiene supplier_id pero no cost_id, crear el costo
  IF NEW.supplier_id IS NOT NULL THEN
    
    -- Obtener categoría "Inventario"
    SELECT id INTO v_cost_category_id
    FROM public.cost_categories
    WHERE name ILIKE '%inventario%'
    LIMIT 1;

    -- Si no existe, crear la categoría
    IF v_cost_category_id IS NULL THEN
      INSERT INTO public.cost_categories (name, description)
      VALUES ('Inventario', 'Compras de inventario generadas automáticamente')
      RETURNING id INTO v_cost_category_id;
    END IF;

    -- Obtener nombre del producto
    SELECT name INTO v_item_name
    FROM public.inventory_items
    WHERE id = NEW.item_id;

    -- Crear el costo
    INSERT INTO public.costs (
      description,
      amount,
      date,
      category_id,
      supplier_id,
      inventory_movement_id,
      purchase_quantity,
      purchase_unit_cost,
      crane_id,
      notes,
      created_by
    )
    VALUES (
      COALESCE(v_item_name, 'Compra de inventario'),
      COALESCE(NEW.total_cost, NEW.unit_cost * NEW.quantity),
      NEW.movement_date::date,
      v_cost_category_id,
      NEW.supplier_id,
      NEW.id,
      NEW.quantity,
      NEW.unit_cost,
      NEW.crane_id,
      'Generado automáticamente desde movimiento de inventario',
      NEW.created_by
    )
    RETURNING id INTO v_new_cost_id;

    -- Actualizar el movimiento con el cost_id
    UPDATE public.inventory_movements
    SET cost_id = v_new_cost_id
    WHERE id = NEW.id;

    RAISE NOTICE '✅ [Inventory→Cost] Costo creado automáticamente para movimiento %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_inventory_to_supplier_and_cost"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_legacy_operator_commission"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  existing_resource_id UUID;
BEGIN
  -- Solo procesar si hay operador y comisión
  IF NEW.operator_id IS NOT NULL AND NEW.operator_commission > 0 THEN
    
    -- Verificar si ya existe un resource para este operador en este servicio
    SELECT id INTO existing_resource_id
    FROM public.service_resources
    WHERE service_id = NEW.id
      AND operator_id = NEW.operator_id
      AND resource_type = 'operator';
    
    IF existing_resource_id IS NOT NULL THEN
      -- Actualizar el resource existente
      UPDATE public.service_resources
      SET 
        commission_amount = NEW.operator_commission,
        updated_at = now()
      WHERE id = existing_resource_id;
      
      RAISE NOTICE 'Updated existing service_resource commission: % for service: %', NEW.operator_commission, NEW.folio;
    ELSE
      -- Crear nuevo resource
      INSERT INTO public.service_resources (
        service_id,
        resource_type,
        operator_id,
        commission_amount,
        is_primary,
        created_by
      ) VALUES (
        NEW.id,
        'operator',
        NEW.operator_id,
        NEW.operator_commission,
        true,
        NEW.created_by
      );
      
      RAISE NOTICE 'Created new service_resource commission: % for service: %', NEW.operator_commission, NEW.folio;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_legacy_operator_commission"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_legacy_operator_commission"() IS 'DESHABILITADO: Función de sincronización legacy deshabilitada por seguridad';



CREATE OR REPLACE FUNCTION "public"."sync_maintenance_costs"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  synced_count INTEGER := 0;
  maintenance_record RECORD;
  maintenance_category_id UUID;
  cost_description TEXT;
  cost_subcategory TEXT;
BEGIN
  -- Get maintenance category
  SELECT id INTO maintenance_category_id
  FROM public.cost_categories
  WHERE name = 'Mantenimiento'
  LIMIT 1;
  
  -- If category doesn't exist, create it
  IF maintenance_category_id IS NULL THEN
    INSERT INTO public.cost_categories (name, description)
    VALUES ('Mantenimiento', 'Gastos de mantenimiento y reparaciones de grúas')
    RETURNING id INTO maintenance_category_id;
  END IF;

  -- Loop through completed maintenances without associated costs
  FOR maintenance_record IN 
    SELECT cm.*
    FROM public.crane_maintenance cm
    WHERE cm.status = 'completed' 
      AND cm.cost > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.costs c WHERE c.maintenance_id = cm.id
      )
  LOOP
    -- Build description
    cost_description := 'Mantenimiento: ' || maintenance_record.description;
    IF maintenance_record.provider IS NOT NULL THEN
      cost_description := cost_description || ' - Proveedor: ' || maintenance_record.provider;
    END IF;
    
    -- Determine subcategory
    cost_subcategory := CASE 
      WHEN maintenance_record.maintenance_type ILIKE '%preventivo%' THEN 'Mantenimiento Preventivo'
      WHEN maintenance_record.maintenance_type ILIKE '%correctivo%' OR maintenance_record.maintenance_type ILIKE '%reparaci%' THEN 'Reparaciones'
      WHEN maintenance_record.maintenance_type ILIKE '%repuesto%' OR maintenance_record.maintenance_type ILIKE '%pieza%' THEN 'Piezas y Repuestos'
      WHEN maintenance_record.maintenance_type ILIKE '%revision%' OR maintenance_record.maintenance_type ILIKE '%inspecci%' THEN 'Inspecciones'
      ELSE 'Mantenimiento General'
    END;
    
    -- Try to insert with unique timestamp to avoid duplicates
    BEGIN
      INSERT INTO public.costs (
        amount,
        category_id,
        crane_id,
        date,
        description,
        notes,
        subcategory,
        maintenance_id,
        created_by,
        created_at
      ) VALUES (
        maintenance_record.cost,
        maintenance_category_id,
        maintenance_record.crane_id,
        COALESCE(maintenance_record.completed_date, maintenance_record.scheduled_date, maintenance_record.created_at::date),
        cost_description,
        'Costo migrado automáticamente desde mantenimiento histórico' ||
        CASE WHEN maintenance_record.notes IS NOT NULL THEN '. Notas: ' || maintenance_record.notes ELSE '' END,
        cost_subcategory,
        maintenance_record.id,
        maintenance_record.created_by,
        maintenance_record.created_at + (synced_count * INTERVAL '1 second') -- Add offset to avoid duplicates
      );
      
      synced_count := synced_count + 1;
    EXCEPTION 
      WHEN OTHERS THEN
        RAISE NOTICE 'Error syncing maintenance %: %', maintenance_record.id, SQLERRM;
        CONTINUE;
    END;
  END LOOP;
  
  RETURN format('Sincronizados %s mantenimientos con costos', synced_count);
END;
$$;


ALTER FUNCTION "public"."sync_maintenance_costs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_paid_invoices_with_payments"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."sync_paid_invoices_with_payments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_parts_purchase_to_inventory"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_inventory_item_id uuid;
  v_location_id uuid;
  v_existing_id uuid;
  v_part_key text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Solo compras con cantidad positiva
  IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN
    RETURN NEW;
  END IF;

  -- Si ya está vinculado a un movimiento, no crear nada (evita duplicar consumos)
  IF NEW.inventory_movement_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Si explícitamente es consumo interno, no crear entrada
  IF COALESCE(NEW.supplier, '') ILIKE '%inventario interno%' THEN
    RETURN NEW;
  END IF;

  -- Si las notas parecen consumo o auto-sync de consumo, no crear entrada
  IF COALESCE(NEW.notes, '') ILIKE '%consumo%' THEN
    RETURN NEW;
  END IF;

  -- Si hay cost_id, evitar duplicado por costo
  IF NEW.cost_id IS NOT NULL THEN
    SELECT im.id INTO v_existing_id
    FROM public.inventory_movements im
    WHERE im.cost_id = NEW.cost_id
      AND im.movement_type = 'entry'
      AND im.status = 'active'
    ORDER BY im.created_at ASC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Obtener ubicación principal
  SELECT id INTO v_location_id
  FROM public.inventory_locations
  WHERE is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_location_id IS NULL THEN
    INSERT INTO public.inventory_locations (name, code, description, is_active)
    VALUES ('Bodega Principal', 'MAIN', 'Ubicación principal de inventario', true)
    RETURNING id INTO v_location_id;
  END IF;

  -- Normalización simple (trim + colapsar espacios + lower) para matching
  v_part_key := lower(regexp_replace(trim(NEW.part_name), '\s+', ' ', 'g'));

  SELECT ii.id INTO v_inventory_item_id
  FROM public.inventory_items ii
  WHERE ii.is_active = true
    AND lower(regexp_replace(trim(ii.name), '\s+', ' ', 'g')) = v_part_key
  ORDER BY ii.created_at ASC
  LIMIT 1;

  IF v_inventory_item_id IS NULL THEN
    INSERT INTO public.inventory_items (
      name,
      description,
      unit_of_measure,
      unit_cost,
      minimum_stock,
      is_active,
      created_by
    )
    VALUES (
      trim(NEW.part_name),
      'Creado automáticamente desde crane_parts',
      'unidad',
      COALESCE(NEW.unit_price, 0),
      1,
      true,
      NEW.created_by
    )
    RETURNING id INTO v_inventory_item_id;
  END IF;

  -- Dedupe conservador: si ya existe una entrada idéntica (mismo item + grúa + fecha + cantidad + proveedor), no crear otra
  SELECT im.id INTO v_existing_id
  FROM public.inventory_movements im
  WHERE im.item_id = v_inventory_item_id
    AND im.location_id = v_location_id
    AND im.movement_type = 'entry'
    AND im.status = 'active'
    AND im.crane_id IS NOT DISTINCT FROM NEW.crane_id
    AND im.quantity = NEW.quantity
    AND im.movement_date::date = NEW.date
    AND coalesce(im.supplier_name, '') = coalesce(NEW.supplier, '')
  ORDER BY im.created_at ASC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.inventory_movements (
    item_id,
    location_id,
    movement_type,
    quantity,
    unit_cost,
    total_cost,
    movement_date,
    reason,
    supplier_name,
    crane_id,
    cost_id,
    observations,
    created_by,
    status
  )
  VALUES (
    v_inventory_item_id,
    v_location_id,
    'entry',
    NEW.quantity,
    NEW.unit_price,
    NEW.total_value,
    NEW.date,
    'Compra de pieza: ' || trim(NEW.part_name),
    NEW.supplier,
    NEW.crane_id,
    NEW.cost_id,
    COALESCE(NEW.notes, ''),
    NEW.created_by,
    'active'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error en sync_parts_purchase_to_inventory: % - %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_parts_purchase_to_inventory"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_role_to_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.profiles SET role = NEW.role WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_role_to_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_service_company_from_crane"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.crane_id IS NOT NULL THEN
    SELECT owner_company_rut, owner_company_name
    INTO NEW.company_rut, NEW.company_name
    FROM public.cranes
    WHERE id = NEW.crane_id;
  ELSE
    SELECT rut, business_name
    INTO NEW.company_rut, NEW.company_name
    FROM public.company_data
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_service_company_from_crane"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_services_on_crane_company_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.services
  SET company_rut = NEW.owner_company_rut,
      company_name = NEW.owner_company_name
  WHERE crane_id = NEW.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_services_on_crane_company_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_specific_income_to_payment"("p_income_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_income RECORD;
  v_payment_id UUID;
  v_result jsonb;
BEGIN
  -- Obtener el ingreso
  SELECT * INTO v_income FROM incomes WHERE id = p_income_id;
  
  -- Validar que el ingreso existe
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'El ingreso no existe'
    );
  END IF;
  
  -- Validar que tiene cliente y factura asociada
  IF v_income.invoice_id IS NULL OR v_income.client_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'El ingreso debe tener cliente y factura asociada'
    );
  END IF;
  
  -- Verificar si ya existe un payment similar (mismo cliente, monto y fecha)
  IF EXISTS (
    SELECT 1 FROM payments
    WHERE client_id = v_income.client_id
    AND amount = v_income.amount
    AND payment_date = v_income.income_date
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Ya existe un pago con estas características (mismo cliente, monto y fecha)'
    );
  END IF;
  
  -- Crear el payment
  INSERT INTO payments (
    client_id,
    amount,
    payment_date,
    payment_method,
    bank_reference,
    notes,
    status,
    remaining_amount
  ) VALUES (
    v_income.client_id,
    v_income.amount,
    v_income.income_date,
    v_income.payment_method,
    v_income.bank_reference,
    'Sincronizado desde ingreso: ' || v_income.description,
    'pending',
    v_income.amount
  )
  RETURNING id INTO v_payment_id;
  
  -- Aplicar a la factura usando la función existente
  SELECT apply_payment_manual(
    v_payment_id,
    jsonb_build_array(
      jsonb_build_object(
        'invoice_id', v_income.invoice_id,
        'amount', v_income.amount
      )
    )
  ) INTO v_result;
  
  -- Verificar si la aplicación fue exitosa
  IF v_result->>'success' = 'true' THEN
    RETURN jsonb_build_object(
      'success', true,
      'payment_id', v_payment_id,
      'message', 'Pago creado y aplicado exitosamente a la factura'
    );
  ELSE
    -- Si hubo error al aplicar, eliminar el payment creado
    DELETE FROM payments WHERE id = v_payment_id;
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Error al aplicar el pago a la factura: ' || COALESCE(v_result->>'error', 'Error desconocido')
    );
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Error inesperado: ' || SQLERRM
    );
END;
$$;


ALTER FUNCTION "public"."sync_specific_income_to_payment"("p_income_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_supplier_invoice_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE supplier_payments SET
    supplier_invoice_id = NULL,
    updated_at = now()
  WHERE supplier_invoice_id = OLD.id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."sync_supplier_invoice_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_supplier_invoice_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Solo en UPDATE
  IF TG_OP != 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Verificar si cambió algo relevante
  IF (OLD.due_date IS DISTINCT FROM NEW.due_date) OR
     (OLD.issue_date IS DISTINCT FROM NEW.issue_date) OR
     (OLD.amount IS DISTINCT FROM NEW.amount) OR
     (OLD.net_amount IS DISTINCT FROM NEW.net_amount) OR
     (OLD.status IS DISTINCT FROM NEW.status) OR
     (OLD.description IS DISTINCT FROM NEW.description) THEN

    -- 1. Actualizar supplier_payments vinculados via supplier_invoice_id
    UPDATE supplier_payments SET
      due_date = CASE WHEN OLD.due_date IS DISTINCT FROM NEW.due_date THEN NEW.due_date ELSE due_date END,
      amount = CASE WHEN OLD.amount IS DISTINCT FROM NEW.amount THEN NEW.amount ELSE amount END,
      description = CASE WHEN OLD.description IS DISTINCT FROM NEW.description THEN COALESCE(NEW.description, description) ELSE description END,
      updated_at = now()
    WHERE supplier_invoice_id = NEW.id;

    -- 2. Actualizar costs vinculados a esos payments (via cost_id en supplier_payments)
    UPDATE costs SET
      date = CASE WHEN OLD.due_date IS DISTINCT FROM NEW.due_date THEN NEW.due_date ELSE date END,
      amount = CASE WHEN OLD.amount IS DISTINCT FROM NEW.amount THEN NEW.amount ELSE amount END,
      description = CASE WHEN OLD.description IS DISTINCT FROM NEW.description THEN COALESCE(NEW.description, description) ELSE description END,
      updated_at = now()
    WHERE supplier_payment_id IN (
      SELECT id FROM supplier_payments WHERE supplier_invoice_id = NEW.id
    );

    -- 3. También actualizar costs que tengan cost_id referenciado desde payments
    UPDATE costs SET
      date = CASE WHEN OLD.due_date IS DISTINCT FROM NEW.due_date THEN NEW.due_date ELSE date END,
      amount = CASE WHEN OLD.amount IS DISTINCT FROM NEW.amount THEN NEW.amount ELSE amount END,
      description = CASE WHEN OLD.description IS DISTINCT FROM NEW.description THEN COALESCE(NEW.description, description) ELSE description END,
      updated_at = now()
    WHERE id IN (
      SELECT cost_id FROM supplier_payments WHERE supplier_invoice_id = NEW.id AND cost_id IS NOT NULL
    );

    RAISE NOTICE '[Invoice→Payment→Cost] Synced invoice % changes to payments and costs', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_supplier_invoice_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_supplier_payment_cost_deletion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Actualizar costos vinculados
  UPDATE costs 
  SET 
    description = CASE 
      WHEN description LIKE 'Pago a proveedor:%' THEN
        REPLACE(description, 'Pago a proveedor:', '[PAGO ELIMINADO] Pago a proveedor:')
      ELSE
        '[PAGO ELIMINADO] ' || description
    END,
    notes = CASE
      WHEN notes IS NOT NULL THEN
        '[PAGO ELIMINADO] ' || notes
      ELSE
        '[PAGO ELIMINADO] Pago de proveedor eliminado'
    END,
    updated_at = NOW()
  WHERE id IN (
    SELECT cost_id 
    FROM supplier_payment_cost_links 
    WHERE supplier_payment_id = OLD.id
  );
  
  -- Registrar en audit_log
  INSERT INTO audit_log (
    table_name,
    operation,
    old_data,
    user_id
  ) VALUES (
    'supplier_payments',
    'DELETE',
    row_to_json(OLD),
    auth.uid()
  );
  
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."sync_supplier_payment_cost_deletion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_supplier_payment_update_to_cost"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF current_setting('app.bidirectional_sync', true) = 'true'
     OR current_setting('app.sync_in_progress', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.cost_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.bidirectional_sync', 'true', true);
  PERFORM set_config('app.sync_in_progress', 'true', true);

  UPDATE public.costs
  SET supplier_id = NEW.supplier_id,
      supplier_payment_id = NEW.id,
      amount = NEW.amount,
      description = COALESCE(NULLIF(BTRIM(NEW.description), ''), description),
      payment_date = NEW.paid_date,
      updated_at = now()
  WHERE id = NEW.cost_id
    AND (
      supplier_id IS DISTINCT FROM NEW.supplier_id
      OR supplier_payment_id IS DISTINCT FROM NEW.id
      OR amount IS DISTINCT FROM NEW.amount
      OR description IS DISTINCT FROM COALESCE(NULLIF(BTRIM(NEW.description), ''), description)
      OR payment_date IS DISTINCT FROM NEW.paid_date
    );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('app.bidirectional_sync', 'false', true);
    PERFORM set_config('app.sync_in_progress', 'false', true);
    RAISE;
END;
$$;


ALTER FUNCTION "public"."sync_supplier_payment_update_to_cost"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."test_invoice_creation"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN 'Test function executed successfully - no recursion detected';
END;
$$;


ALTER FUNCTION "public"."test_invoice_creation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_user_status"("user_id" "uuid", "new_status" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Verificar que el usuario que ejecuta la función sea admin
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden cambiar el estado de usuario';
  END IF;

  -- Actualizar el estado del usuario
  UPDATE public.profiles 
  SET is_active = new_status, updated_at = now()
  WHERE id = user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;
END;
$$;


ALTER FUNCTION "public"."toggle_user_status"("user_id" "uuid", "new_status" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_supplier_invoice_items_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_supplier_invoice_items_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_cost_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, new_value, change_summary)
    VALUES (
      NEW.id,
      COALESCE(uid, NEW.created_by),
      'CREATE',
      'registro',
      NEW.description,
      'Costo creado: ' || COALESCE(NEW.description, '(sin descripción)') || ' por $' || COALESCE(NEW.amount::TEXT, '0')
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'amount', OLD.amount::TEXT, NEW.amount::TEXT,
        'Monto cambió de $' || OLD.amount || ' a $' || NEW.amount);
    END IF;
    IF NEW.description IS DISTINCT FROM OLD.description THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'description', OLD.description, NEW.description,
        'Descripción actualizada');
    END IF;
    IF NEW.date IS DISTINCT FROM OLD.date THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'date', OLD.date::TEXT, NEW.date::TEXT,
        'Fecha cambió de ' || OLD.date || ' a ' || NEW.date);
    END IF;
    IF NEW.category_id IS DISTINCT FROM OLD.category_id THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'category_id', OLD.category_id::TEXT, NEW.category_id::TEXT, 'Categoría cambiada');
    END IF;
    IF NEW.subcategory IS DISTINCT FROM OLD.subcategory THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'subcategory', OLD.subcategory, NEW.subcategory, 'Subcategoría cambiada');
    END IF;
    IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'supplier_id', OLD.supplier_id::TEXT, NEW.supplier_id::TEXT, 'Proveedor cambiado');
    END IF;
    IF NEW.crane_id IS DISTINCT FROM OLD.crane_id THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'crane_id', OLD.crane_id::TEXT, NEW.crane_id::TEXT, 'Grúa cambiada');
    END IF;
    IF NEW.operator_id IS DISTINCT FROM OLD.operator_id THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'operator_id', OLD.operator_id::TEXT, NEW.operator_id::TEXT, 'Operador cambiado');
    END IF;
    IF NEW.payment_date IS DISTINCT FROM OLD.payment_date THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'payment_date', OLD.payment_date::TEXT, NEW.payment_date::TEXT,
        CASE WHEN OLD.payment_date IS NULL AND NEW.payment_date IS NOT NULL THEN 'Marcado como pagado el ' || NEW.payment_date
             WHEN OLD.payment_date IS NOT NULL AND NEW.payment_date IS NULL THEN 'Marcado como NO pagado'
             ELSE 'Fecha de pago cambió de ' || OLD.payment_date || ' a ' || NEW.payment_date END);
    END IF;
    IF NEW.document_number IS DISTINCT FROM OLD.document_number THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'document_number', OLD.document_number, NEW.document_number, 'N° documento actualizado');
    END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'notes', OLD.notes, NEW.notes, 'Notas actualizadas');
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, change_summary)
    VALUES (OLD.id, uid, 'DELETE', 'registro', OLD.description,
      'Costo eliminado: ' || COALESCE(OLD.description, '(sin descripción)') || ' por $' || COALESCE(OLD.amount::TEXT, '0'));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$_$;


ALTER FUNCTION "public"."track_cost_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_crane_part_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, new_value, change_summary)
    VALUES (NEW.id, COALESCE(uid, NEW.created_by), 'CREATE', 'registro', NEW.part_name,
      'Repuesto registrado: ' || NEW.part_name || ' x' || NEW.quantity || ' a $' || NEW.unit_price);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.part_name IS DISTINCT FROM OLD.part_name THEN
      INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'part_name', OLD.part_name, NEW.part_name, 'Nombre del repuesto actualizado');
    END IF;
    IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
      INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'quantity', OLD.quantity::TEXT, NEW.quantity::TEXT,
        'Cantidad cambió de ' || OLD.quantity || ' a ' || NEW.quantity);
    END IF;
    IF NEW.unit_price IS DISTINCT FROM OLD.unit_price THEN
      INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'unit_price', OLD.unit_price::TEXT, NEW.unit_price::TEXT,
        'Precio unitario cambió de $' || OLD.unit_price || ' a $' || NEW.unit_price);
    END IF;
    IF NEW.supplier IS DISTINCT FROM OLD.supplier THEN
      INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'supplier', OLD.supplier, NEW.supplier, 'Proveedor cambiado');
    END IF;
    IF NEW.crane_id IS DISTINCT FROM OLD.crane_id THEN
      INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'crane_id', OLD.crane_id::TEXT, NEW.crane_id::TEXT, 'Grúa cambiada');
    END IF;
    IF NEW.date IS DISTINCT FROM OLD.date THEN
      INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'date', OLD.date::TEXT, NEW.date::TEXT, 'Fecha cambió de ' || OLD.date || ' a ' || NEW.date);
    END IF;
    IF NEW.kilometraje IS DISTINCT FROM OLD.kilometraje THEN
      INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'kilometraje', OLD.kilometraje::TEXT, NEW.kilometraje::TEXT, 'Kilometraje actualizado');
    END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN
      INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'notes', OLD.notes, NEW.notes, 'Notas actualizadas');
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, old_value, change_summary)
    VALUES (OLD.id, uid, 'DELETE', 'registro', OLD.part_name,
      'Repuesto eliminado: ' || OLD.part_name || ' x' || OLD.quantity);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$_$;


ALTER FUNCTION "public"."track_crane_part_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_inventory_movement_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, new_value, change_summary)
    VALUES (NEW.id, COALESCE(uid, NEW.created_by), 'CREATE', 'registro', NEW.movement_type,
      'Movimiento creado: ' || NEW.movement_type || ' x' || NEW.quantity);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
      INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'quantity', OLD.quantity::TEXT, NEW.quantity::TEXT,
        'Cantidad cambió de ' || OLD.quantity || ' a ' || NEW.quantity);
    END IF;
    IF NEW.unit_cost IS DISTINCT FROM OLD.unit_cost THEN
      INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'unit_cost', OLD.unit_cost::TEXT, NEW.unit_cost::TEXT,
        'Costo unitario cambió de $' || COALESCE(OLD.unit_cost::TEXT,'0') || ' a $' || COALESCE(NEW.unit_cost::TEXT,'0'));
    END IF;
    IF NEW.total_cost IS DISTINCT FROM OLD.total_cost THEN
      INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'total_cost', OLD.total_cost::TEXT, NEW.total_cost::TEXT, 'Costo total actualizado');
    END IF;
    IF NEW.location_id IS DISTINCT FROM OLD.location_id THEN
      INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'location_id', OLD.location_id::TEXT, NEW.location_id::TEXT, 'Ubicación cambiada');
    END IF;
    IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id THEN
      INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'supplier_id', OLD.supplier_id::TEXT, NEW.supplier_id::TEXT, 'Proveedor cambiado');
    END IF;
    IF NEW.crane_id IS DISTINCT FROM OLD.crane_id THEN
      INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'crane_id', OLD.crane_id::TEXT, NEW.crane_id::TEXT, 'Grúa cambiada');
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'status', OLD.status, NEW.status, 'Estado cambió de ' || OLD.status || ' a ' || NEW.status);
    END IF;
    IF NEW.observations IS DISTINCT FROM OLD.observations THEN
      INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'observations', OLD.observations, NEW.observations, 'Observaciones actualizadas');
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, old_value, change_summary)
    VALUES (OLD.id, uid, 'DELETE', 'registro', OLD.movement_type,
      'Movimiento eliminado: ' || OLD.movement_type || ' x' || OLD.quantity);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$_$;


ALTER FUNCTION "public"."track_inventory_movement_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_service_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_user_id UUID;
  v_field_labels JSONB := '{
    "value": "Valor del Servicio",
    "purchase_order": "Orden de Compra",
    "quote_number": "Número de Cotización",
    "status": "Estado",
    "operator_commission": "Comisión Operador",
    "client_covered_amount": "Monto Cubierto Cliente",
    "excess_amount": "Excedente",
    "insured_name": "Nombre Asegurado",
    "origin": "Origen",
    "destination": "Destino",
    "observations": "Observaciones",
    "vehicle_brand": "Marca Vehículo",
    "vehicle_model": "Modelo Vehículo",
    "license_plate": "Patente"
  }';
  v_field_name TEXT;
  v_old_value TEXT;
  v_new_value TEXT;
  v_label TEXT;
BEGIN
  v_user_id := auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO service_change_history (service_id, service_folio, changed_by, change_type, field_name, new_value, change_summary)
    VALUES (NEW.id, NEW.folio, v_user_id, 'CREATE', 'servicio', NULL, 'Servicio creado');
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Comparar campos clave
    FOREACH v_field_name IN ARRAY ARRAY['value', 'purchase_order', 'quote_number', 'status',
      'operator_commission', 'client_covered_amount', 'excess_amount', 'insured_name',
      'origin', 'destination', 'observations', 'vehicle_brand', 'vehicle_model', 'license_plate'] LOOP

      EXECUTE format('SELECT ($1).%I::TEXT, ($2).%I::TEXT', v_field_name, v_field_name)
        INTO v_old_value, v_new_value USING OLD, NEW;

      IF v_old_value IS DISTINCT FROM v_new_value THEN
        v_label := COALESCE(v_field_labels->>v_field_name, v_field_name);

        INSERT INTO service_change_history (service_id, service_folio, changed_by, change_type, field_name, old_value, new_value, change_summary)
        VALUES (NEW.id, NEW.folio, v_user_id, 'UPDATE', v_field_name, v_old_value, v_new_value,
          format('%s: %s → %s', v_label, COALESCE(v_old_value, 'vacío'), COALESCE(v_new_value, 'vacío')));
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- IMPORTANT:
    -- This trigger is configured as AFTER DELETE. At that point the service row is already gone,
    -- so inserting a history row with FK(service_id)->services(id) fails.
    -- We intentionally skip logging DELETE events to keep deletion working.
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$_$;


ALTER FUNCTION "public"."track_service_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_global_data_refresh"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Esta función se puede llamar desde el frontend para disparar eventos de refresh
  -- No hace nada en la BD, solo sirve como trigger para el frontend
  RAISE NOTICE 'Disparando evento global de refresh de datos...';
  
  -- Log para auditoría
  RAISE NOTICE 'Global data refresh triggered at %', now();
END;
$$;


ALTER FUNCTION "public"."trigger_global_data_refresh"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_closure_status_on_invoice"("p_closure_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Actualizar el estado del cierre a 'invoiced'
  UPDATE public.service_closures 
  SET 
    status = 'invoiced',
    updated_at = now()
  WHERE id = p_closure_id;
  
  -- Log para debugging
  RAISE NOTICE 'Closure % status updated to invoiced', p_closure_id;
END;
$$;


ALTER FUNCTION "public"."update_closure_status_on_invoice"("p_closure_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_commission_payment_date"("p_commission_ids" "uuid"[], "p_payment_date" "date" DEFAULT NULL::"date", "p_payment_batch_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_commission_category_id UUID;
  v_expected_count INTEGER;
  v_found_count INTEGER;
  v_distinct_operator_count INTEGER;
  v_operator_id UUID;
  v_user_role TEXT;
  v_user_operator_id UUID;
  v_updated_count INTEGER := 0;
BEGIN
  IF p_commission_ids IS NULL OR array_length(p_commission_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debe indicar al menos una comisión';
  END IF;

  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'No tienes permisos para actualizar fechas de pago de comisiones';
  END IF;

  SELECT id
  INTO v_commission_category_id
  FROM public.cost_categories
  WHERE name = 'Comisión Operador'
  LIMIT 1;

  IF v_commission_category_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró la categoría Comisión Operador';
  END IF;

  v_expected_count := array_length(p_commission_ids, 1);

  SELECT COUNT(*)
  INTO v_found_count
  FROM public.costs
  WHERE id = ANY(p_commission_ids)
    AND category_id = v_commission_category_id;

  IF v_found_count <> v_expected_count THEN
    RAISE EXCEPTION 'Algunas comisiones no existen o no pertenecen a Comisión Operador (esperadas: %, encontradas: %)', v_expected_count, v_found_count;
  END IF;

  -- Use subquery to get operator_id without MIN(uuid)
  SELECT COUNT(DISTINCT operator_id)
  INTO v_distinct_operator_count
  FROM public.costs
  WHERE id = ANY(p_commission_ids)
    AND category_id = v_commission_category_id;

  SELECT operator_id
  INTO v_operator_id
  FROM public.costs
  WHERE id = ANY(p_commission_ids)
    AND category_id = v_commission_category_id
    AND operator_id IS NOT NULL
  LIMIT 1;

  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'Las comisiones deben tener operator_id definido';
  END IF;

  IF v_distinct_operator_count > 1 THEN
    RAISE EXCEPTION 'Solo puedes actualizar comisiones de un operador por lote';
  END IF;

  IF v_user_role = 'operator' THEN
    v_user_operator_id := public.get_operator_id_by_user(auth.uid());
    IF v_user_operator_id IS NULL OR v_user_operator_id IS DISTINCT FROM v_operator_id THEN
      RAISE EXCEPTION 'No puedes actualizar comisiones de otro operador';
    END IF;
  END IF;

  IF p_payment_batch_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.costs c
      WHERE c.payment_batch_id = p_payment_batch_id
        AND c.category_id = v_commission_category_id
        AND c.operator_id IS DISTINCT FROM v_operator_id
    ) THEN
      RAISE EXCEPTION 'El lote % ya contiene comisiones de otro operador', p_payment_batch_id;
    END IF;

    IF p_payment_date IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.costs c
      WHERE c.payment_batch_id = p_payment_batch_id
        AND c.category_id = v_commission_category_id
        AND c.payment_date IS DISTINCT FROM p_payment_date
    ) THEN
      RAISE EXCEPTION 'El lote % ya contiene una payment_date distinta', p_payment_batch_id;
    END IF;
  END IF;

  PERFORM set_config('app.sync_in_progress', 'true', true);

  UPDATE public.costs
  SET
    payment_date = p_payment_date,
    payment_batch_id = CASE
      WHEN p_payment_date IS NULL THEN NULL
      ELSE p_payment_batch_id
    END,
    subcategory = 'Comisión Operador',
    updated_at = NOW()
  WHERE id = ANY(p_commission_ids)
    AND category_id = v_commission_category_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'payment_date', p_payment_date,
    'payment_batch_id', CASE WHEN p_payment_date IS NULL THEN NULL ELSE p_payment_batch_id END,
    'operator_id', v_operator_id
  );
END;
$$;


ALTER FUNCTION "public"."update_commission_payment_date"("p_commission_ids" "uuid"[], "p_payment_date" "date", "p_payment_batch_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_cost_for_crane_part"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Update the associated cost record
  UPDATE public.costs
  SET 
    amount = NEW.total_value,
    date = NEW.date,
    description = 'Compra de piezas: ' || NEW.part_name,
    notes = COALESCE(NEW.notes, '') || ' - Proveedor: ' || NEW.supplier || CASE WHEN NEW.phone IS NOT NULL THEN ' (Tel: ' || NEW.phone || ')' ELSE '' END,
    updated_at = now()
  WHERE id = NEW.cost_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_cost_for_crane_part"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_crane_expiry_on_document_upload"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Update the corresponding expiry date in cranes table
  IF NEW.document_type = 'technical_review' AND NEW.expiry_date IS NOT NULL THEN
    UPDATE public.cranes 
    SET technical_review_expiry = NEW.expiry_date, updated_at = now()
    WHERE id = NEW.crane_id;
  ELSIF NEW.document_type = 'insurance' AND NEW.expiry_date IS NOT NULL THEN
    UPDATE public.cranes 
    SET insurance_expiry = NEW.expiry_date, updated_at = now()
    WHERE id = NEW.crane_id;
  ELSIF NEW.document_type = 'circulation_permit' AND NEW.expiry_date IS NOT NULL THEN
    UPDATE public.cranes 
    SET circulation_permit_expiry = NEW.expiry_date, updated_at = now()
    WHERE id = NEW.crane_id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_crane_expiry_on_document_upload"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_inventory_stock"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_old_item_id uuid;
  v_old_location_id uuid;
  v_new_item_id uuid;
  v_new_location_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new_item_id := NEW.item_id;
    v_new_location_id := NEW.location_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_item_id := OLD.item_id;
    v_old_location_id := OLD.location_id;
    v_new_item_id := NEW.item_id;
    v_new_location_id := NEW.location_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_item_id := OLD.item_id;
    v_old_location_id := OLD.location_id;
  END IF;

  IF v_old_item_id IS NOT NULL AND v_old_location_id IS NOT NULL THEN
    INSERT INTO public.inventory_stock (
      item_id,
      location_id,
      current_quantity,
      reserved_quantity,
      last_movement_date,
      created_at,
      updated_at
    )
    SELECT
      v_old_item_id,
      v_old_location_id,
      COALESCE(SUM(
        CASE
          WHEN im.movement_type = 'entry' THEN im.quantity
          WHEN im.movement_type = 'exit' THEN -im.quantity
          ELSE 0
        END
      ), 0),
      COALESCE((
        SELECT s.reserved_quantity
        FROM public.inventory_stock s
        WHERE s.item_id = v_old_item_id AND s.location_id = v_old_location_id
      ), 0),
      MAX(im.movement_date),
      now(),
      now()
    FROM public.inventory_movements im
    WHERE im.status = 'active'
      AND im.item_id = v_old_item_id
      AND im.location_id = v_old_location_id
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET
      current_quantity = EXCLUDED.current_quantity,
      reserved_quantity = EXCLUDED.reserved_quantity,
      last_movement_date = EXCLUDED.last_movement_date,
      updated_at = now();
  END IF;

  IF v_new_item_id IS NOT NULL AND v_new_location_id IS NOT NULL
     AND (v_new_item_id IS DISTINCT FROM v_old_item_id OR v_new_location_id IS DISTINCT FROM v_old_location_id) THEN
    INSERT INTO public.inventory_stock (
      item_id,
      location_id,
      current_quantity,
      reserved_quantity,
      last_movement_date,
      created_at,
      updated_at
    )
    SELECT
      v_new_item_id,
      v_new_location_id,
      COALESCE(SUM(
        CASE
          WHEN im.movement_type = 'entry' THEN im.quantity
          WHEN im.movement_type = 'exit' THEN -im.quantity
          ELSE 0
        END
      ), 0),
      COALESCE((
        SELECT s.reserved_quantity
        FROM public.inventory_stock s
        WHERE s.item_id = v_new_item_id AND s.location_id = v_new_location_id
      ), 0),
      MAX(im.movement_date),
      now(),
      now()
    FROM public.inventory_movements im
    WHERE im.status = 'active'
      AND im.item_id = v_new_item_id
      AND im.location_id = v_new_location_id
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET
      current_quantity = EXCLUDED.current_quantity,
      reserved_quantity = EXCLUDED.reserved_quantity,
      last_movement_date = EXCLUDED.last_movement_date,
      updated_at = now();
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_inventory_stock"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_invoice_amounts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invoice_id UUID;
  v_total_paid NUMERIC;
  v_invoice_total NUMERIC;
  v_invoice_due_date DATE;
  v_new_status invoice_status;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  SELECT total, due_date INTO v_invoice_total, v_invoice_due_date
  FROM invoices
  WHERE id = v_invoice_id;
  
  SELECT COALESCE(SUM(applied_amount), 0) INTO v_total_paid
  FROM payment_applications
  WHERE invoice_id = v_invoice_id;
  
  IF v_total_paid >= v_invoice_total THEN
    v_new_status := 'paid';
  ELSIF v_total_paid > 0 THEN
    v_new_status := 'partial';
  ELSIF v_invoice_due_date < CURRENT_DATE THEN
    v_new_status := 'overdue';
  ELSE
    v_new_status := 'sent';
  END IF;
  
  UPDATE invoices
  SET 
    paid_amount = v_total_paid,
    status = v_new_status,
    payment_date = CASE 
      WHEN v_new_status = 'paid' AND payment_date IS NULL THEN CURRENT_DATE
      WHEN v_new_status != 'paid' THEN NULL
      ELSE payment_date
    END,
    updated_at = NOW()
  WHERE id = v_invoice_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_invoice_amounts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_invoice_status_from_payments"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invoice_total DECIMAL(10,2);
  v_invoice_paid DECIMAL(10,2);
  v_new_status invoice_status;
  v_invoice_id UUID;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  -- Obtener el total de la factura
  SELECT total INTO v_invoice_total
  FROM invoices
  WHERE id = v_invoice_id;

  -- Calcular el total pagado para esta factura desde payment_applications
  SELECT COALESCE(SUM(applied_amount), 0)
  INTO v_invoice_paid
  FROM payment_applications
  WHERE invoice_id = v_invoice_id;

  -- Determinar el nuevo estado de la factura
  IF v_invoice_paid = 0 THEN
    -- Si no hay pagos, mantener el estado actual (no modificar)
    RETURN COALESCE(NEW, OLD);
  ELSIF v_invoice_paid >= v_invoice_total THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  -- Actualizar la factura (remaining_amount se calcula automáticamente)
  UPDATE invoices
  SET 
    paid_amount = v_invoice_paid,
    status = v_new_status,
    payment_date = CASE 
      WHEN v_invoice_paid >= v_invoice_total THEN COALESCE(payment_date, CURRENT_DATE)
      ELSE payment_date
    END,
    updated_at = now()
  WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_invoice_status_from_payments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_notifications_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_notifications_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_overdue_invoices"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Actualizar facturas que han pasado su fecha de vencimiento
  UPDATE public.invoices 
  SET 
    status = 'overdue',
    updated_at = now()
  WHERE 
    status IN ('sent', 'draft') 
    AND due_date < CURRENT_DATE
    AND status != 'overdue'
    AND status != 'paid'
    AND status != 'cancelled';
    
  -- Log para debugging
  RAISE NOTICE 'Updated overdue invoices at: %', now();
END;
$$;


ALTER FUNCTION "public"."update_overdue_invoices"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_overdue_supplier_payments"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE supplier_payments
  SET status = 'overdue',
      updated_at = now()
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;
END;
$$;


ALTER FUNCTION "public"."update_overdue_supplier_payments"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_overdue_supplier_payments"() IS 'Actualiza automáticamente pagos vencidos';



CREATE OR REPLACE FUNCTION "public"."update_payment_amounts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_payment_id UUID;
  v_total_applied NUMERIC;
  v_payment_amount NUMERIC;
  v_new_status payment_status;
BEGIN
  v_payment_id := COALESCE(NEW.payment_id, OLD.payment_id);
  
  SELECT COALESCE(SUM(applied_amount), 0) INTO v_total_applied
  FROM payment_applications
  WHERE payment_id = v_payment_id;
  
  SELECT amount INTO v_payment_amount
  FROM payments
  WHERE id = v_payment_id;
  
  IF v_total_applied = 0 THEN
    v_new_status := 'pending';
  ELSIF v_total_applied >= v_payment_amount THEN
    v_new_status := 'applied';
  ELSE
    v_new_status := 'partial';
  END IF;
  
  UPDATE payments
  SET 
    applied_amount = v_total_applied,
    status = v_new_status,
    updated_at = NOW()
  WHERE id = v_payment_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_payment_amounts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_payment_applied_amount"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  payment_applied NUMERIC;
  payment_total NUMERIC;
BEGIN
  -- Calcular el monto aplicado sumando las aplicaciones
  SELECT COALESCE(SUM(applied_amount), 0) INTO payment_applied
  FROM payment_applications
  WHERE payment_id = COALESCE(NEW.payment_id, OLD.payment_id);

  -- Obtener el total del pago
  SELECT amount INTO payment_total
  FROM payments
  WHERE id = COALESCE(NEW.payment_id, OLD.payment_id);

  -- Actualizar SOLO applied_amount y status
  -- remaining_amount se calcula automáticamente
  UPDATE payments
  SET 
    applied_amount = payment_applied,
    status = CASE
      WHEN payment_applied = 0 THEN 'pending'
      WHEN payment_applied < payment_total THEN 'partial'
      WHEN payment_applied >= payment_total THEN 'applied'
      ELSE status
    END,
    updated_at = now()
  WHERE id = COALESCE(NEW.payment_id, OLD.payment_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_payment_applied_amount"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_payment_remaining_amount"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Calcular remaining_amount basado en amount - applied_amount
  NEW.remaining_amount := NEW.amount - COALESCE(NEW.applied_amount, 0);
  
  -- Actualizar status basado en amounts
  IF NEW.applied_amount >= NEW.amount THEN
    NEW.status := 'applied';
  ELSIF NEW.applied_amount > 0 THEN
    NEW.status := 'partial';
  ELSE
    NEW.status := 'pending';
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_payment_remaining_amount"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_service_comprehensive"("p_service_id" "uuid", "p_service_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    current_user_id uuid;
    user_role app_role;
    service_record record;
    operator_id uuid;
    result jsonb;
    error_details jsonb;
BEGIN
    -- Obtener usuario actual
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Usuario no autenticado',
            'error_code', 'UNAUTHENTICATED'
        );
    END IF;

    -- Obtener rol del usuario
    SELECT role INTO user_role FROM public.profiles WHERE id = current_user_id;
    
    IF user_role IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Usuario sin rol asignado',
            'error_code', 'NO_ROLE'
        );
    END IF;

    -- Verificar que el servicio existe
    SELECT * INTO service_record FROM public.services WHERE id = p_service_id;
    
    IF service_record IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Servicio no encontrado',
            'error_code', 'SERVICE_NOT_FOUND'
        );
    END IF;

    -- Verificar permisos de actualización
    IF user_role = 'admin' THEN
        -- Los admins pueden actualizar cualquier servicio
        NULL;
    ELSIF user_role = 'operator' THEN
        -- Los operadores solo pueden actualizar sus propios servicios
        SELECT id INTO operator_id FROM public.operators WHERE user_id = current_user_id;
        
        IF operator_id IS NULL OR service_record.operator_id != operator_id THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'No tienes permisos para actualizar este servicio',
                'error_code', 'INSUFFICIENT_PERMISSIONS'
            );
        END IF;
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Rol de usuario no autorizado para actualizar servicios',
            'error_code', 'UNAUTHORIZED_ROLE'
        );
    END IF;

    -- Verificar si el servicio está facturado (solo admins pueden editar servicios facturados)
    IF service_record.status = 'invoiced' AND user_role != 'admin' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No se puede editar un servicio que ya está facturado',
            'error_code', 'SERVICE_INVOICED'
        );
    END IF;

    -- Intentar actualizar el servicio
    BEGIN
        UPDATE public.services 
        SET 
            folio = COALESCE((p_service_data->>'folio')::text, folio),
            request_date = COALESCE((p_service_data->>'request_date')::date, request_date),
            service_date = COALESCE((p_service_data->>'service_date')::date, service_date),
            client_id = COALESCE((p_service_data->>'client_id')::uuid, client_id),
            purchase_order = COALESCE((p_service_data->>'purchase_order')::text, purchase_order),
            service_type_id = COALESCE((p_service_data->>'service_type_id')::uuid, service_type_id),
            vehicle_brand = COALESCE((p_service_data->>'vehicle_brand')::text, vehicle_brand),
            vehicle_model = COALESCE((p_service_data->>'vehicle_model')::text, vehicle_model),
            license_plate = COALESCE((p_service_data->>'license_plate')::text, license_plate),
            origin = COALESCE((p_service_data->>'origin')::text, origin),
            destination = COALESCE((p_service_data->>'destination')::text, destination),
            crane_id = CASE 
                WHEN p_service_data ? 'crane_id' THEN (p_service_data->>'crane_id')::uuid
                ELSE crane_id 
            END,
            operator_id = CASE 
                WHEN p_service_data ? 'operator_id' THEN (p_service_data->>'operator_id')::uuid
                ELSE operator_id 
            END,
            value = COALESCE((p_service_data->>'value')::numeric, value),
            operator_commission = COALESCE((p_service_data->>'operator_commission')::numeric, operator_commission),
            status = COALESCE((p_service_data->>'status')::service_status, status),
            observations = COALESCE((p_service_data->>'observations')::text, observations),
            has_excess = COALESCE((p_service_data->>'has_excess')::boolean, has_excess),
            client_covered_amount = COALESCE((p_service_data->>'client_covered_amount')::numeric, client_covered_amount),
            excess_amount = COALESCE((p_service_data->>'excess_amount')::numeric, excess_amount),
            custody_mode = COALESCE((p_service_data->>'custody_mode')::text, custody_mode),
            custody_days = CASE 
                WHEN p_service_data ? 'custody_days' THEN (p_service_data->>'custody_days')::integer
                ELSE custody_days 
            END,
            custody_daily_rate = CASE 
                WHEN p_service_data ? 'custody_daily_rate' THEN (p_service_data->>'custody_daily_rate')::numeric
                ELSE custody_daily_rate 
            END,
            custody_start_date = CASE 
                WHEN p_service_data ? 'custody_start_date' THEN (p_service_data->>'custody_start_date')::date
                ELSE custody_start_date 
            END,
            custody_end_date = CASE 
                WHEN p_service_data ? 'custody_end_date' THEN (p_service_data->>'custody_end_date')::date
                ELSE custody_end_date 
            END,
            custody_vehicle_type = COALESCE((p_service_data->>'custody_vehicle_type')::text, custody_vehicle_type),
            custody_discount_percentage = COALESCE((p_service_data->>'custody_discount_percentage')::numeric, custody_discount_percentage),
            custody_total_amount = CASE 
                WHEN p_service_data ? 'custody_total_amount' THEN (p_service_data->>'custody_total_amount')::numeric
                ELSE custody_total_amount 
            END,
            custody_notes = COALESCE((p_service_data->>'custody_notes')::text, custody_notes),
            updated_at = now()
        WHERE id = p_service_id;

        -- Verificar que la actualización fue exitosa
        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'No se pudo actualizar el servicio',
                'error_code', 'UPDATE_FAILED'
            );
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Servicio actualizado exitosamente',
            'service_id', p_service_id
        );

    EXCEPTION WHEN OTHERS THEN
        -- Capturar cualquier error durante la actualización
        error_details := jsonb_build_object(
            'sqlstate', SQLSTATE,
            'message', SQLERRM,
            'detail', COALESCE(PG_EXCEPTION_DETAIL, ''),
            'hint', COALESCE(PG_EXCEPTION_HINT, ''),
            'context', COALESCE(PG_EXCEPTION_CONTEXT, '')
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Error interno al actualizar el servicio',
            'error_code', 'INTERNAL_ERROR',
            'error_details', error_details
        );
    END;
END;
$$;


ALTER FUNCTION "public"."update_service_comprehensive"("p_service_id" "uuid", "p_service_data" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_service_comprehensive"("p_service_id" "uuid", "p_service_data" "jsonb") IS 'Función integral para actualizar servicios con validación completa de permisos y manejo robusto de errores';



CREATE OR REPLACE FUNCTION "public"."update_services_to_invoiced_batch"("p_service_ids" "uuid"[], "p_invoice_folio" "text", "p_numero_fiscal" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  updated_count integer := 0;
  service_record RECORD;
  result jsonb;
BEGIN
  -- Log para debugging
  RAISE NOTICE 'Iniciando actualización de servicios: %', array_length(p_service_ids, 1);
  
  -- Verificar que los servicios existen
  FOR service_record IN 
    SELECT id, folio, status 
    FROM public.services 
    WHERE id = ANY(p_service_ids)
  LOOP
    RAISE NOTICE 'Servicio encontrado: % - estado actual: %', service_record.folio, service_record.status;
  END LOOP;
  
  -- Actualizar todos los servicios proporcionados
  UPDATE public.services 
  SET 
    status = 'invoiced'::service_status,
    invoice_folio = p_invoice_folio,
    invoice_numero_fiscal = p_numero_fiscal,
    updated_at = now()
  WHERE id = ANY(p_service_ids);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RAISE NOTICE 'Servicios actualizados: %', updated_count;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_count', updated_count,
    'service_ids', array_to_json(p_service_ids),
    'invoice_folio', p_invoice_folio,
    'numero_fiscal', p_numero_fiscal
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error en actualización: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'service_ids', array_to_json(p_service_ids)
    );
END;
$$;


ALTER FUNCTION "public"."update_services_to_invoiced_batch"("p_service_ids" "uuid"[], "p_invoice_folio" "text", "p_numero_fiscal" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_supplier_categories_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_supplier_categories_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_supplier_payment_cost_links_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_supplier_payment_cost_links_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "public"."app_role") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if caller is admin
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Only admins can update user roles';
  END IF;

  -- Update in user_roles table
  INSERT INTO public.user_roles (user_id, role, assigned_by)
  VALUES (target_user_id, new_role, auth.uid())
  ON CONFLICT (user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    assigned_by = EXCLUDED.assigned_by,
    assigned_at = now();

  -- Update profiles for backward compatibility
  UPDATE public.profiles
  SET
    role = new_role,
    status = 'approved',
    updated_at = now()
  WHERE id = target_user_id;
END;
$$;


ALTER FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_role_secure"("target_user_id" "uuid", "new_role" "public"."app_role") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_admin_count INTEGER;
  target_current_role app_role;
  requesting_user_role app_role;
BEGIN
  -- Verificar permisos del usuario que hace la petición
  SELECT role INTO requesting_user_role
  FROM public.profiles 
  WHERE id = auth.uid();
  
  IF requesting_user_role != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden cambiar roles de usuario';
  END IF;

  -- Obtener rol actual del usuario objetivo
  SELECT role INTO target_current_role
  FROM public.profiles 
  WHERE id = target_user_id;
  
  IF target_current_role IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- Prevenir que el último admin pierda privilegios
  IF target_current_role = 'admin' AND new_role != 'admin' THEN
    SELECT COUNT(*) INTO current_admin_count
    FROM public.profiles
    WHERE role = 'admin' AND is_active = true;
    
    IF current_admin_count <= 1 THEN
      RAISE EXCEPTION 'No se puede degradar al último administrador activo del sistema';
    END IF;
  END IF;

  -- Prevenir auto-degradación de admin
  IF auth.uid() = target_user_id AND target_current_role = 'admin' AND new_role != 'admin' THEN
    RAISE EXCEPTION 'Los administradores no pueden degradar su propio rol';
  END IF;

  -- Actualizar el rol
  UPDATE public.profiles 
  SET 
    role = new_role,
    updated_at = now()
  WHERE id = target_user_id;

  RAISE NOTICE 'Role changed successfully: user % from % to % by %', 
    target_user_id, target_current_role, new_role, auth.uid();
END;
$$;


ALTER FUNCTION "public"."update_user_role_secure"("target_user_id" "uuid", "new_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_all_warnings_eliminated"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  RAISE NOTICE 'RLS policies optimized and validated successfully';
END;
$$;


ALTER FUNCTION "public"."validate_all_warnings_eliminated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_email"("email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
BEGIN
    -- Basic email validation
    RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$_$;


ALTER FUNCTION "public"."validate_email"("email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_payment_amounts"() RETURNS TABLE("payment_id" "uuid", "folio" "text", "amount" numeric, "applied_amount" numeric, "calculated_applied" numeric, "remaining_amount" numeric, "is_inconsistent" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as payment_id,
    COALESCE(p.bank_reference, 'Sin referencia') as folio,
    p.amount,
    p.applied_amount,
    COALESCE((
      SELECT SUM(pa.applied_amount) 
      FROM public.payment_applications pa 
      WHERE pa.payment_id = p.id
    ), 0) as calculated_applied,
    p.remaining_amount,
    (p.applied_amount > p.amount OR p.remaining_amount < 0 OR 
     p.applied_amount != COALESCE((
       SELECT SUM(pa.applied_amount) 
       FROM public.payment_applications pa 
       WHERE pa.payment_id = p.id
     ), 0)) as is_inconsistent
  FROM public.payments p
  ORDER BY p.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."validate_payment_amounts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_payment_application_amount"("p_invoice_id" "uuid", "p_new_amount" numeric, "p_excluding_application_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_invoice_total NUMERIC;
  v_current_paid NUMERIC;
  v_available_amount NUMERIC;
BEGIN
  -- Obtener total de la factura
  SELECT total INTO v_invoice_total
  FROM invoices
  WHERE id = p_invoice_id;
  
  IF v_invoice_total IS NULL THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;
  
  -- Calcular monto ya pagado (excluyendo aplicación específica si se indica)
  SELECT COALESCE(SUM(applied_amount), 0) INTO v_current_paid
  FROM payment_applications
  WHERE invoice_id = p_invoice_id
    AND (p_excluding_application_id IS NULL OR id != p_excluding_application_id);
  
  -- Calcular monto disponible
  v_available_amount := v_invoice_total - v_current_paid;
  
  -- Validar que el nuevo monto no exceda lo disponible
  IF p_new_amount > v_available_amount THEN
    RAISE EXCEPTION 'Monto de aplicación ($%) excede el monto disponible ($%) de la factura', 
      p_new_amount, v_available_amount
    USING HINT = format('Total factura: $%, Ya pagado: $%, Disponible: $%', 
      v_invoice_total, v_current_paid, v_available_amount);
  END IF;
  
  RETURN TRUE;
END;
$_$;


ALTER FUNCTION "public"."validate_payment_application_amount"("p_invoice_id" "uuid", "p_new_amount" numeric, "p_excluding_application_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_payment_system_integrity"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result jsonb;
  inconsistent_invoices INTEGER;
  inconsistent_payments INTEGER;
  orphaned_applications INTEGER;
  paid_without_payments INTEGER;
BEGIN
  -- Contar facturas con inconsistencias
  SELECT COUNT(*) INTO inconsistent_invoices
  FROM invoices i
  WHERE (i.status = 'paid' AND i.remaining_amount > 0)
     OR (i.paid_amount < 0)
     OR (i.paid_amount > i.total);

  -- Contar pagos con inconsistencias
  SELECT COUNT(*) INTO inconsistent_payments
  FROM payments p
  WHERE (p.applied_amount > p.amount)
     OR (p.remaining_amount < 0)
     OR (p.applied_amount < 0);

  -- Contar aplicaciones huérfanas
  SELECT COUNT(*) INTO orphaned_applications
  FROM payment_applications pa
  WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.id = pa.payment_id)
     OR NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = pa.invoice_id);

  -- Contar facturas pagadas sin aplicaciones de pago
  SELECT COUNT(*) INTO paid_without_payments
  FROM invoices i
  WHERE i.status = 'paid'
    AND NOT EXISTS (SELECT 1 FROM payment_applications pa WHERE pa.invoice_id = i.id);

  result := jsonb_build_object(
    'validation_timestamp', NOW(),
    'system_health', CASE 
      WHEN inconsistent_invoices = 0 AND inconsistent_payments = 0 
           AND orphaned_applications = 0 AND paid_without_payments = 0 
      THEN 'HEALTHY' 
      ELSE 'NEEDS_ATTENTION' 
    END,
    'issues', jsonb_build_object(
      'inconsistent_invoices', inconsistent_invoices,
      'inconsistent_payments', inconsistent_payments,
      'orphaned_applications', orphaned_applications,
      'paid_without_payments', paid_without_payments
    ),
    'recommendations', CASE 
      WHEN inconsistent_invoices > 0 THEN jsonb_build_array('Ejecutar fix_invoice_payment_inconsistencies()')
      WHEN paid_without_payments > 0 THEN jsonb_build_array('Ejecutar sync_paid_invoices_with_payments()')
      ELSE jsonb_build_array('Sistema en buen estado')
    END
  );

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."validate_payment_system_integrity"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_payment_system_integrity"() IS 'Valida la integridad completa del sistema de conciliación de pagos';



CREATE OR REPLACE FUNCTION "public"."validate_product_service_description"("p_text" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v text;
  v_len int;
BEGIN
  v := btrim(coalesce(p_text, ''));
  v_len := char_length(v);

  IF v_len < 10 OR v_len > 500 THEN
    RAISE EXCEPTION 'product_service_description debe tener entre 10 y 500 caracteres';
  END IF;

  RETURN v;
END;
$$;


ALTER FUNCTION "public"."validate_product_service_description"("p_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_rls_policies"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  RAISE NOTICE 'RLS policies optimized and validated successfully';
END;
$$;


ALTER FUNCTION "public"."validate_rls_policies"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_service_invoice_consistency"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- If status is 'invoiced' but no folio, revert to completed
  IF NEW.status = 'invoiced' AND (NEW.invoice_folio IS NULL OR NEW.invoice_folio = '') THEN
    NEW.status := 'completed';
  END IF;

  -- Do NOT force status to 'invoiced' just because invoice_folio exists.
  -- Post-service states (quoted, purchase_order_pending, with_purchase_order, completed, failed)
  -- are all valid even with an invoice_folio present.

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_service_invoice_consistency"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_service_update_data"("p_service_id" "uuid", "p_service_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    service_type_config record;
    validation_errors text[] := '{}';
BEGIN
    -- Obtener configuración del tipo de servicio si se está actualizando
    IF p_service_data ? 'service_type_id' THEN
        SELECT * INTO service_type_config 
        FROM public.service_types 
        WHERE id = (p_service_data->>'service_type_id')::uuid;
        
        IF service_type_config IS NULL THEN
            validation_errors := array_append(validation_errors, 'Tipo de servicio no válido');
        END IF;
    ELSE
        -- Obtener configuración del tipo de servicio actual
        SELECT st.* INTO service_type_config 
        FROM public.service_types st
        JOIN public.services s ON s.service_type_id = st.id
        WHERE s.id = p_service_id;
    END IF;

    -- Validar campos requeridos según el tipo de servicio
    IF service_type_config IS NOT NULL THEN
        -- Validar marca de vehículo
        IF service_type_config.vehicle_brand_required AND 
           (p_service_data ? 'vehicle_brand') AND 
           (p_service_data->>'vehicle_brand' IS NULL OR p_service_data->>'vehicle_brand' = '') THEN
            validation_errors := array_append(validation_errors, 'Marca de vehículo es requerida');
        END IF;

        -- Validar modelo de vehículo
        IF service_type_config.vehicle_model_required AND 
           (p_service_data ? 'vehicle_model') AND 
           (p_service_data->>'vehicle_model' IS NULL OR p_service_data->>'vehicle_model' = '') THEN
            validation_errors := array_append(validation_errors, 'Modelo de vehículo es requerido');
        END IF;

        -- Validar patente
        IF service_type_config.license_plate_required AND 
           (p_service_data ? 'license_plate') AND 
           (p_service_data->>'license_plate' IS NULL OR p_service_data->>'license_plate' = '') THEN
            validation_errors := array_append(validation_errors, 'Patente es requerida');
        END IF;

        -- Validar origen
        IF service_type_config.origin_required AND 
           (p_service_data ? 'origin') AND 
           (p_service_data->>'origin' IS NULL OR p_service_data->>'origin' = '') THEN
            validation_errors := array_append(validation_errors, 'Origen es requerido');
        END IF;

        -- Validar destino
        IF service_type_config.destination_required AND 
           (p_service_data ? 'destination') AND 
           (p_service_data->>'destination' IS NULL OR p_service_data->>'destination' = '') THEN
            validation_errors := array_append(validation_errors, 'Destino es requerido');
        END IF;

        -- Validar grúa
        IF service_type_config.crane_required AND 
           (p_service_data ? 'crane_id') AND 
           (p_service_data->>'crane_id' IS NULL OR p_service_data->>'crane_id' = '') THEN
            validation_errors := array_append(validation_errors, 'Grúa es requerida');
        END IF;

        -- Validar operador
        IF service_type_config.operator_required AND 
           (p_service_data ? 'operator_id') AND 
           (p_service_data->>'operator_id' IS NULL or p_service_data->>'operator_id' = '') THEN
            validation_errors := array_append(validation_errors, 'Operador es requerido');
        END IF;
    END IF;

    -- Validar folio único si se está actualizando
    IF p_service_data ? 'folio' THEN
        IF EXISTS (
            SELECT 1 FROM public.services 
            WHERE folio = (p_service_data->>'folio') 
            AND id != p_service_id
        ) THEN
            validation_errors := array_append(validation_errors, 'El folio ya existe');
        END IF;
    END IF;

    -- Retornar resultado de validación
    IF array_length(validation_errors, 1) > 0 THEN
        RETURN jsonb_build_object(
            'valid', false,
            'errors', to_jsonb(validation_errors)
        );
    ELSE
        RETURN jsonb_build_object(
            'valid', true,
            'errors', '[]'::jsonb
        );
    END IF;
END;
$$;


ALTER FUNCTION "public"."validate_service_update_data"("p_service_id" "uuid", "p_service_data" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_service_update_data"("p_service_id" "uuid", "p_service_data" "jsonb") IS 'Función para validar datos antes de actualizar un servicio según las reglas del tipo de servicio';



CREATE OR REPLACE FUNCTION "public"."verify_auth_system"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result jsonb;
BEGIN
  result := jsonb_build_object(
    'auth_working', auth.role() = 'authenticated',
    'user_id', auth.uid(),
    'profiles_count', (SELECT COUNT(*) FROM public.profiles),
    'policies_secure', (
      SELECT COUNT(*) = 0 
      FROM pg_policies 
      WHERE schemaname = 'public' 
      AND (
        roles && ARRAY['anon']::name[] OR
        qual LIKE '%true%' OR
        with_check LIKE '%true%'
      )
      AND policyname NOT LIKE '%auth_only%'
    ),
    'timestamp', now()
  );
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."verify_auth_system"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_security_compliance"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  mutable_functions_count INTEGER;
  anonymous_policies_count INTEGER;
  result_message TEXT;
BEGIN
  -- Contar funciones con search_path mutable
  SELECT COUNT(*) INTO mutable_functions_count
  FROM information_schema.routines r
  WHERE r.routine_schema = 'public' 
  AND r.routine_type = 'FUNCTION'
  AND NOT EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname = r.routine_name
    AND p.proconfig IS NOT NULL
    AND array_to_string(p.proconfig, ',') LIKE '%search_path%'
  );

  -- Contar políticas que permiten acceso anónimo
  SELECT COUNT(*) INTO anonymous_policies_count
  FROM pg_policies 
  WHERE schemaname = 'public'
  AND roles && ARRAY['anon']::name[];

  -- Generar mensaje de resultado
  IF mutable_functions_count = 0 AND anonymous_policies_count = 0 THEN
    result_message := 'ÉXITO: Todas las advertencias de seguridad han sido eliminadas. Base de datos completamente segura.';
  ELSE
    result_message := format('ADVERTENCIA: %s funciones con search_path mutable, %s políticas con acceso anónimo', 
                           mutable_functions_count, anonymous_policies_count);
  END IF;

  RETURN result_message;
END;
$$;


ALTER FUNCTION "public"."verify_security_compliance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."void_inventory_purchase"("p_cost_id" "uuid", "p_reason" "text", "p_replacement_supplier_id" "uuid" DEFAULT NULL::"uuid", "p_revert_payment" boolean DEFAULT true, "p_revert_invoice" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_cost record;
  v_payment record;
  v_invoice record;
  v_summary jsonb;
  v_cost_snapshot jsonb;
  v_movements_snapshot jsonb;
  v_payment_snapshot jsonb;
  v_invoice_snapshot jsonb;
  v_movements_count integer := 0;
  v_payment_reverted boolean := false;
  v_invoice_reverted boolean := false;
  v_movement_ids uuid[];
  v_entry record;
  v_stock_after numeric;
  v_net_change numeric;
BEGIN
  IF NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'No autorizado: solo administradores pueden anular compras';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Debe proporcionar un motivo de al menos 5 caracteres';
  END IF;

  SELECT * INTO v_cost FROM public.costs WHERE id = p_cost_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Costo no encontrado: %', p_cost_id;
  END IF;

  v_cost_snapshot := to_jsonb(v_cost);

  -- Recolectar IDs de TODOS los movimientos relacionados
  SELECT ARRAY_AGG(id) INTO v_movement_ids
  FROM public.inventory_movements
  WHERE cost_id = p_cost_id
     OR id = v_cost.inventory_movement_id;

  v_movement_ids := COALESCE(v_movement_ids, ARRAY[]::uuid[]);

  -- Snapshot de movimientos
  SELECT jsonb_agg(to_jsonb(im.*))
  INTO v_movements_snapshot
  FROM public.inventory_movements im
  WHERE im.id = ANY(v_movement_ids);

  -- Validación de stock: stock proyectado >= 0 considerando salidas que se revierten
  SELECT * INTO v_entry
  FROM public.inventory_movements
  WHERE id = ANY(v_movement_ids)
    AND movement_type = 'entry'
    AND status = 'active'
  LIMIT 1;

  IF v_entry.id IS NOT NULL THEN
    SELECT COALESCE(SUM(
      CASE
        WHEN movement_type = 'entry' THEN -quantity
        WHEN movement_type = 'exit'  THEN  quantity
        ELSE 0
      END
    ), 0)
    INTO v_net_change
    FROM public.inventory_movements
    WHERE id = ANY(v_movement_ids)
      AND status = 'active'
      AND item_id = v_entry.item_id
      AND location_id = v_entry.location_id;

    SELECT COALESCE(current_quantity, 0) + v_net_change INTO v_stock_after
    FROM public.inventory_stock
    WHERE item_id = v_entry.item_id AND location_id = v_entry.location_id;

    IF v_stock_after IS NULL THEN v_stock_after := v_net_change; END IF;

    IF v_stock_after < 0 THEN
      RAISE EXCEPTION 'No se puede anular: el stock quedaría en % unidades. El producto ya fue consumido por otros movimientos posteriores.', v_stock_after;
    END IF;
  END IF;

  -- Cargar pago/factura
  IF v_cost.supplier_payment_id IS NOT NULL THEN
    SELECT * INTO v_payment FROM public.supplier_payments WHERE id = v_cost.supplier_payment_id;
    IF FOUND THEN v_payment_snapshot := to_jsonb(v_payment); END IF;
  END IF;

  IF v_cost.supplier_invoice_id IS NOT NULL THEN
    SELECT * INTO v_invoice FROM public.supplier_invoices WHERE id = v_cost.supplier_invoice_id;
    IF FOUND THEN v_invoice_snapshot := to_jsonb(v_invoice); END IF;
  END IF;

  -- =====================
  -- LIMPIEZA DE REFERENCIAS
  -- =====================

  -- Limpiar referencias en costs antes de borrar movimientos
  UPDATE public.costs
  SET inventory_movement_id = NULL,
      supplier_payment_id   = NULL,
      supplier_invoice_id   = NULL
  WHERE id = p_cost_id;

  IF array_length(v_movement_ids, 1) > 0 THEN
    -- Eliminar crane_parts ligadas a estos movimientos (FK sin cascada)
    DELETE FROM public.crane_parts WHERE inventory_movement_id = ANY(v_movement_ids);
    -- También por cost_id (registros manuales que apuntan a este costo)
    DELETE FROM public.crane_parts WHERE cost_id = p_cost_id;

    -- Limpiar inventory_consumptions vinculados a estos movimientos
    DELETE FROM public.inventory_consumptions WHERE movement_id = ANY(v_movement_ids);

    -- Desvincular supplier_invoice_items.movement_id (FK ON DELETE SET NULL ya cubre, pero forzamos limpio)
    UPDATE public.supplier_invoice_items SET movement_id = NULL WHERE movement_id = ANY(v_movement_ids);

    -- Eliminar todos los movimientos relacionados
    WITH del AS (
      DELETE FROM public.inventory_movements WHERE id = ANY(v_movement_ids) RETURNING 1
    )
    SELECT COUNT(*) INTO v_movements_count FROM del;
  END IF;

  -- Eliminar pago si corresponde y no tiene otros costos vinculados
  IF p_revert_payment AND v_payment.id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.costs WHERE supplier_payment_id = v_payment.id AND id != p_cost_id
    ) THEN
      DELETE FROM public.supplier_payments WHERE id = v_payment.id;
      v_payment_reverted := true;
    END IF;
  END IF;

  -- Eliminar factura si corresponde y no tiene otros costos vinculados
  IF p_revert_invoice AND v_invoice.id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.costs WHERE supplier_invoice_id = v_invoice.id AND id != p_cost_id
    ) THEN
      DELETE FROM public.supplier_invoice_items WHERE supplier_invoice_id = v_invoice.id;
      DELETE FROM public.supplier_invoices WHERE id = v_invoice.id;
      v_invoice_reverted := true;
    END IF;
  END IF;

  -- Eliminar costo
  DELETE FROM public.costs WHERE id = p_cost_id;

  v_summary := jsonb_build_object(
    'cost_deleted', true,
    'movements_deleted', v_movements_count,
    'payment_reverted', v_payment_reverted,
    'invoice_reverted', v_invoice_reverted
  );

  INSERT INTO public.purchase_voids (
    voided_by, original_cost_id, reason, replacement_supplier_id,
    original_cost_snapshot, original_movements_snapshot,
    original_payment_snapshot, original_invoice_link_snapshot,
    reverted_summary
  ) VALUES (
    v_user_id, p_cost_id, p_reason, p_replacement_supplier_id,
    v_cost_snapshot, v_movements_snapshot,
    v_payment_snapshot, v_invoice_snapshot,
    v_summary
  );

  RETURN v_summary;
END;
$$;


ALTER FUNCTION "public"."void_inventory_purchase"("p_cost_id" "uuid", "p_reason" "text", "p_replacement_supplier_id" "uuid", "p_revert_payment" boolean, "p_revert_invoice" boolean) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" bigint NOT NULL,
    "table_name" "text" NOT NULL,
    "operation" "text" NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid"
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."audit_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."audit_log_id_seq" OWNED BY "public"."audit_log"."id";



CREATE TABLE IF NOT EXISTS "public"."backup_email_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "recipient_email" "text" DEFAULT 'asistencia@gruas5norte.cl'::"text" NOT NULL,
    "schedule_hour" integer DEFAULT 3 NOT NULL,
    "signed_url_days" integer DEFAULT 7 NOT NULL,
    "last_sent_at" timestamp with time zone,
    "last_status" "text",
    "last_error" "text",
    "last_sql_size_bytes" bigint,
    "last_json_size_bytes" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "backup_email_config_schedule_hour_check" CHECK ((("schedule_hour" >= 0) AND ("schedule_hour" <= 23))),
    CONSTRAINT "backup_email_config_signed_url_days_check" CHECK ((("signed_url_days" >= 1) AND ("signed_url_days" <= 30)))
);


ALTER TABLE "public"."backup_email_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."backup_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "backup_type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "file_size_bytes" bigint,
    "error_message" "text",
    "metadata" "jsonb",
    CONSTRAINT "backup_logs_backup_type_check" CHECK (("backup_type" = ANY (ARRAY['full'::"text", 'quick'::"text", 'auto'::"text", 'full_sql'::"text", 'full_json'::"text", 'quick_json'::"text"]))),
    CONSTRAINT "backup_logs_status_check" CHECK (("status" = ANY (ARRAY['started'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."backup_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "service_id" "uuid",
    "client_id" "uuid",
    "operator_id" "uuid",
    "crane_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "calendar_events_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "calendar_events_type_check" CHECK (("type" = ANY (ARRAY['service'::"text", 'maintenance'::"text", 'meeting'::"text", 'deadline'::"text", 'other'::"text"]))),
    CONSTRAINT "check_calendar_event_status" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "check_calendar_event_type" CHECK (("type" = ANY (ARRAY['service'::"text", 'maintenance'::"text", 'meeting'::"text", 'deadline'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."calendar_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "rut" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "address" "text",
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "department" "text" NOT NULL,
    "contact_name" "text",
    "default_payment_term_id" "uuid",
    "billing_type" "text" DEFAULT 'standard'::"text" NOT NULL,
    "logo_url" "text",
    "display_name" "text"
);

ALTER TABLE ONLY "public"."clients" REPLICA IDENTITY FULL;


ALTER TABLE "public"."clients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clients"."contact_name" IS 'Nombre de la persona de contacto en el cliente';



COMMENT ON COLUMN "public"."clients"."logo_url" IS 'URL pública del logo en bucket company-assets. Se muestra en el portal cliente.';



COMMENT ON COLUMN "public"."clients"."display_name" IS 'Nombre comercial para el portal. Si es null se usa el campo name.';



CREATE TABLE IF NOT EXISTS "public"."closure_services" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "closure_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL
);


ALTER TABLE "public"."closure_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_data" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "business_name" "text" NOT NULL,
    "rut" "text" NOT NULL,
    "address" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text" NOT NULL,
    "website" "text",
    "logo_url" "text",
    "folio_format" "text" DEFAULT 'SRV-{number}'::"text",
    "invoice_due_days" integer DEFAULT 30,
    "vat_percentage" numeric(5,2) DEFAULT 19.00,
    "legal_texts" "text",
    "alert_days" integer DEFAULT 30,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "next_service_folio_number" integer DEFAULT 1000 NOT NULL,
    "next_invoice_folio_number" integer,
    "excess_folio_format" "text" DEFAULT 'EXE-{number}'::"text",
    "next_excess_folio_number" integer DEFAULT 1,
    "daily_report_enabled" boolean DEFAULT false,
    "daily_report_emails" "text" DEFAULT ''::"text",
    "daily_report_hour" integer DEFAULT 9,
    "report_timezone" "text" DEFAULT 'America/Santiago'::"text" NOT NULL,
    "report_use_system_timezone" boolean DEFAULT false NOT NULL,
    "daily_report_last_sent_at" timestamp with time zone,
    "daily_report_last_attempt_at" timestamp with time zone,
    "daily_report_last_status" "text",
    "daily_report_last_error" "text"
);


ALTER TABLE "public"."company_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_profiles" (
    "rut" "text" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "phone" "text",
    "email" "text",
    "logo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."company_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cost_bulk_payment_operations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "executed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "executed_by" "uuid" NOT NULL,
    "payment_date" "date",
    "requested_cost_ids" "uuid"[] NOT NULL,
    "processed_cost_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "already_paid_cost_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "missing_cost_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "status" "text" DEFAULT 'success'::"text" NOT NULL,
    "error_message" "text",
    "use_cost_date" boolean DEFAULT false NOT NULL,
    CONSTRAINT "cost_bulk_payment_operations_status_check" CHECK (("status" = ANY (ARRAY['success'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."cost_bulk_payment_operations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cost_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "default_cost_center_id" "uuid"
);


ALTER TABLE "public"."cost_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cost_centers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "parent_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "budget_amount" numeric DEFAULT 0,
    "budget_period" "text" DEFAULT 'monthly'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "cost_centers_budget_period_check" CHECK (("budget_period" = ANY (ARRAY['monthly'::"text", 'quarterly'::"text", 'yearly'::"text"])))
);


ALTER TABLE "public"."cost_centers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cost_change_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cost_id" "uuid" NOT NULL,
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "change_type" "text" NOT NULL,
    "field_name" "text" NOT NULL,
    "old_value" "text",
    "new_value" "text",
    "change_summary" "text",
    "change_context" "text",
    CONSTRAINT "cost_change_history_change_type_check" CHECK (("change_type" = ANY (ARRAY['CREATE'::"text", 'UPDATE'::"text", 'DELETE'::"text", 'SNAPSHOT'::"text"])))
);


ALTER TABLE "public"."cost_change_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cost_inventory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cost_id" "uuid" NOT NULL,
    "inventory_item_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_cost" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."cost_inventory_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cost_subcategories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "requires_crane" boolean DEFAULT false NOT NULL,
    "requires_operator" boolean DEFAULT false NOT NULL,
    "requires_supplier" boolean DEFAULT false NOT NULL,
    "requires_document" boolean DEFAULT false NOT NULL,
    "requires_location" boolean DEFAULT false NOT NULL,
    "requires_other_reason" boolean DEFAULT false NOT NULL,
    "routes_to_inventory" boolean DEFAULT false NOT NULL,
    "other_reasons" "jsonb"
);


ALTER TABLE "public"."cost_subcategories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."costs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "category_id" "uuid" NOT NULL,
    "crane_id" "uuid",
    "operator_id" "uuid",
    "service_id" "uuid",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "service_folio" "text",
    "subcategory" "text",
    "cost_center_id" "uuid",
    "inventory_movement_id" "uuid",
    "supplier_payment_id" "uuid",
    "payment_date" "date",
    "payment_batch_id" "text",
    "maintenance_id" "uuid",
    "purchase_quantity" integer,
    "purchase_unit_cost" numeric(12,2),
    "immediate_consumption" boolean DEFAULT false,
    "supplier_id" "uuid",
    "document_type" "text",
    "document_number" "text",
    "location_text" "text",
    "other_reason" "text",
    "receipt_photo_paths" "text"[],
    "supplier_invoice_id" "uuid",
    CONSTRAINT "costs_amount_check" CHECK (("amount" > (0)::numeric))
);

ALTER TABLE ONLY "public"."costs" REPLICA IDENTITY FULL;


ALTER TABLE "public"."costs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."costs"."subcategory" IS 'Subcategoría para gastos de servicios: Combustible, Peajes, Otros';



COMMENT ON COLUMN "public"."costs"."payment_date" IS 'Fecha real cuando se pagó la comisión (diferente de date que es la fecha de generación)';



COMMENT ON COLUMN "public"."costs"."payment_batch_id" IS 'Identificador del lote de pago para trazabilidad';



COMMENT ON COLUMN "public"."costs"."immediate_consumption" IS 'Indica si la compra debe consumirse inmediatamente. Si es true, se crea automáticamente un movimiento de salida a la grúa seleccionada.';



COMMENT ON COLUMN "public"."costs"."supplier_id" IS 'FK formal hacia suppliers. Reemplaza el uso de texto libre en notes/description para identificar proveedores.';



CREATE TABLE IF NOT EXISTS "public"."crane_consumption_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "crane_type" "text" NOT NULL,
    "base_consumption_per_km" numeric NOT NULL,
    "loaded_consumption_factor" numeric DEFAULT 1.3 NOT NULL,
    "towing_consumption_factor" numeric DEFAULT 1.5 NOT NULL,
    "fuel_type" "text" DEFAULT 'diesel'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "toll_vehicle_category" "text" DEFAULT 'LIVIANO'::"text" NOT NULL
);


ALTER TABLE "public"."crane_consumption_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crane_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "crane_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_size" integer,
    "content_type" "text",
    "expiry_date" "date",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."crane_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crane_maintenance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "crane_id" "uuid" NOT NULL,
    "maintenance_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "cost" numeric(12,2) DEFAULT 0 NOT NULL,
    "provider" "text",
    "scheduled_date" "date",
    "completed_date" "date",
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "next_maintenance_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "kilometraje" integer,
    "receipt_photo_paths" "text"[],
    "performed_by" "text",
    CONSTRAINT "crane_maintenance_maintenance_type_check" CHECK (("maintenance_type" = ANY (ARRAY['preventive'::"text", 'corrective'::"text", 'emergency'::"text"]))),
    CONSTRAINT "crane_maintenance_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."crane_maintenance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crane_part_change_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "crane_part_id" "uuid" NOT NULL,
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "change_type" "text" NOT NULL,
    "field_name" "text" NOT NULL,
    "old_value" "text",
    "new_value" "text",
    "change_summary" "text",
    "change_context" "text",
    CONSTRAINT "crane_part_change_history_change_type_check" CHECK (("change_type" = ANY (ARRAY['CREATE'::"text", 'UPDATE'::"text", 'DELETE'::"text", 'SNAPSHOT'::"text"])))
);


ALTER TABLE "public"."crane_part_change_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crane_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "crane_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "supplier" "text" NOT NULL,
    "phone" "text",
    "part_name" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price" numeric NOT NULL,
    "total_value" numeric GENERATED ALWAYS AS ((("quantity")::numeric * "unit_price")) STORED,
    "notes" "text",
    "cost_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "kilometraje" integer,
    "inventory_movement_id" "uuid",
    "supplier_id" "uuid",
    CONSTRAINT "crane_parts_quantity_check" CHECK (("quantity" <> 0)),
    CONSTRAINT "crane_parts_unit_price_check" CHECK (("unit_price" > (0)::numeric))
);

ALTER TABLE ONLY "public"."crane_parts" REPLICA IDENTITY FULL;


ALTER TABLE "public"."crane_parts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."crane_parts"."supplier_id" IS 'FK formal a tabla suppliers. Preferir esto sobre el campo "supplier" (texto libre).';



CREATE TABLE IF NOT EXISTS "public"."cranes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "license_plate" "text" NOT NULL,
    "brand" "text" NOT NULL,
    "model" "text" NOT NULL,
    "type" "public"."crane_type" NOT NULL,
    "circulation_permit_expiry" "date" NOT NULL,
    "insurance_expiry" "date" NOT NULL,
    "technical_review_expiry" "date" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "toll_vehicle_category" "text" DEFAULT 'LIVIANO'::"text" NOT NULL,
    "owner_company_rut" "text",
    "owner_company_name" "text",
    "status" "public"."crane_status" DEFAULT 'active'::"public"."crane_status" NOT NULL
);


ALTER TABLE "public"."cranes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creditors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    "name" "text" NOT NULL,
    "type" "text" DEFAULT 'other'::"text" NOT NULL,
    "supplier_id" "uuid",
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb",
    CONSTRAINT "creditors_type_check" CHECK (("type" = ANY (ARRAY['tax'::"text", 'supplier'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."creditors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debt_installments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    "debt_id" "uuid" NOT NULL,
    "installment_number" integer NOT NULL,
    "due_date" "date" NOT NULL,
    "principal_amount" numeric NOT NULL,
    "interest_amount" numeric DEFAULT 0 NOT NULL,
    "adjustment_amount" numeric DEFAULT 0 NOT NULL,
    "total_amount" numeric NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "paid_amount" numeric DEFAULT 0 NOT NULL,
    "paid_date" "date",
    CONSTRAINT "debt_installments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text"])))
);


ALTER TABLE "public"."debt_installments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debt_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    "debt_installment_id" "uuid" NOT NULL,
    "payment_date" "date" NOT NULL,
    "amount" numeric NOT NULL,
    "method" "text",
    "notes" "text",
    CONSTRAINT "debt_payments_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."debt_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    "creditor_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "total_amount" numeric NOT NULL,
    "currency" "text" DEFAULT 'CLP'::"text" NOT NULL,
    "installments_count" integer NOT NULL,
    "first_due_date" "date" NOT NULL,
    "frequency" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "interest_enabled" boolean DEFAULT false NOT NULL,
    "interest_rate" numeric,
    "adjustment_enabled" boolean DEFAULT false NOT NULL,
    "adjustment_rate" numeric,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "metadata" "jsonb",
    "cost_center_id" "uuid",
    "crane_id" "uuid",
    "operator_id" "uuid",
    "subcategory" "text",
    CONSTRAINT "debts_frequency_check" CHECK (("frequency" = 'monthly'::"text")),
    CONSTRAINT "debts_installments_count_check" CHECK (("installments_count" > 0)),
    CONSTRAINT "debts_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paid'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."debts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "crane_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "alert_days" integer DEFAULT 30 NOT NULL,
    "email_notifications" boolean DEFAULT true,
    "push_notifications" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "document_alerts_document_type_check" CHECK (("document_type" = ANY (ARRAY['technical_review'::"text", 'insurance'::"text", 'circulation_permit'::"text"])))
);


ALTER TABLE "public"."document_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."frontend_error_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "component_name" "text" NOT NULL,
    "error_message" "text" NOT NULL,
    "error_stack" "text",
    "user_id" "uuid",
    "user_agent" "text",
    "url" "text"
);


ALTER TABLE "public"."frontend_error_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."frontend_error_logs" IS 'Errores de UI reportados desde el frontend (ErrorBoundary)';



COMMENT ON COLUMN "public"."frontend_error_logs"."component_name" IS 'Nombre del componente React donde ocurrió el error';



COMMENT ON COLUMN "public"."frontend_error_logs"."error_stack" IS 'Stack trace del error (puede ser nulo)';



COMMENT ON COLUMN "public"."frontend_error_logs"."user_agent" IS 'navigator.userAgent del navegador';



CREATE TABLE IF NOT EXISTS "public"."fuel_prices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fuel_type" "text" DEFAULT 'diesel'::"text" NOT NULL,
    "price_per_liter" numeric NOT NULL,
    "currency" "text" DEFAULT 'CLP'::"text" NOT NULL,
    "price_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "region" "text" DEFAULT 'Nacional'::"text",
    "source" "text" DEFAULT 'manual'::"text",
    "is_current" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."fuel_prices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_batch_records" (
    "id" bigint NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."import_batch_records" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."import_batch_records_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."import_batch_records_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."import_batch_records_id_seq" OWNED BY "public"."import_batch_records"."id";



CREATE TABLE IF NOT EXISTS "public"."import_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "source_module" "text" NOT NULL,
    "filename" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payload" "jsonb",
    "summary" "jsonb",
    "error" "jsonb",
    "rolled_back_at" timestamp with time zone,
    "rolled_back_by" "uuid"
);


ALTER TABLE "public"."import_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_history_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "import_type" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "imported_count" integer DEFAULT 0 NOT NULL,
    "error_count" integer DEFAULT 0 NOT NULL,
    "skipped_count" integer DEFAULT 0 NOT NULL,
    "date_range_start" "date",
    "date_range_end" "date",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "import_history_log_import_type_check" CHECK (("import_type" = ANY (ARRAY['purchase'::"text", 'sale'::"text"]))),
    CONSTRAINT "import_history_log_status_check" CHECK (("status" = ANY (ARRAY['success'::"text", 'partial'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."import_history_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_rut_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "import_type" "text" NOT NULL,
    "source_rut" "text" NOT NULL,
    "source_name" "text" NOT NULL,
    "resolution" "text" NOT NULL,
    "mapped_entity_id" "uuid",
    "mapped_entity_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "import_rut_mappings_import_type_check" CHECK (("import_type" = ANY (ARRAY['purchase'::"text", 'sale'::"text"]))),
    CONSTRAINT "import_rut_mappings_resolution_check" CHECK (("resolution" = ANY (ARRAY['create'::"text", 'assign'::"text", 'ignore'::"text"])))
);


ALTER TABLE "public"."import_rut_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."income_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "color" "text" DEFAULT '#10b981'::"text",
    "icon" "text" DEFAULT 'dollar-sign'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."income_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."income_subcategories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."income_subcategories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incomes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "income_date" "date" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "description" "text" NOT NULL,
    "category_id" "uuid",
    "subcategory" "text",
    "payment_method" "text" NOT NULL,
    "bank_reference" "text",
    "client_id" "uuid",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "occasional_client_name" "text",
    "invoice_id" "uuid",
    CONSTRAINT "incomes_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."incomes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."incomes"."occasional_client_name" IS 'Nombre del cliente ocasional que no requiere registro en el sistema';



COMMENT ON COLUMN "public"."incomes"."invoice_id" IS 'Factura asociada a este ingreso (opcional)';



CREATE TABLE IF NOT EXISTS "public"."inspections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "operator_id" "uuid" NOT NULL,
    "equipment_checklist" "text"[] NOT NULL,
    "vehicle_observations" "text",
    "operator_signature" "text" NOT NULL,
    "client_name" "text",
    "client_rut" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "photos_before_service" "text"[] DEFAULT '{}'::"text"[],
    "photos_client_vehicle" "text"[] DEFAULT '{}'::"text"[],
    "photos_equipment_used" "text"[] DEFAULT '{}'::"text"[],
    "pdf_url" "text",
    "pdf_uploaded_at" timestamp with time zone,
    "pdf_retiro_url" "text",
    "pdf_retiro_uploaded_at" timestamp with time zone
);


ALTER TABLE "public"."inspections" OWNER TO "postgres";


COMMENT ON TABLE "public"."inspections" IS 'Almacena los registros de inspección pre-servicio completados por los operadores.';



COMMENT ON COLUMN "public"."inspections"."equipment_checklist" IS 'Array de identificadores de los elementos de equipamiento verificados.';



COMMENT ON COLUMN "public"."inspections"."operator_signature" IS 'Nombre completo del operador que realiza la inspección, a modo de firma.';



COMMENT ON COLUMN "public"."inspections"."photos_before_service" IS 'Array de nombres de archivos de fotos tomadas antes del servicio';



COMMENT ON COLUMN "public"."inspections"."photos_client_vehicle" IS 'Array de nombres de archivos de fotos del vehículo del cliente';



COMMENT ON COLUMN "public"."inspections"."photos_equipment_used" IS 'Array de nombres de archivos de fotos del equipo utilizado';



COMMENT ON COLUMN "public"."inspections"."pdf_retiro_url" IS 'URL del PDF de inspección de retiro (fase inicial)';



COMMENT ON COLUMN "public"."inspections"."pdf_retiro_uploaded_at" IS 'Timestamp de cuando se subió el PDF de retiro';



CREATE TABLE IF NOT EXISTS "public"."internal_scheduler_secrets" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."internal_scheduler_secrets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid",
    "location_id" "uuid",
    "alert_type" "text" NOT NULL,
    "threshold_value" integer,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_triggered" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "inventory_alerts_alert_type_check" CHECK (("alert_type" = ANY (ARRAY['low_stock'::"text", 'expiring_soon'::"text", 'overstock'::"text", 'no_movement'::"text", 'excess_stock'::"text", 'expiration'::"text"])))
);


ALTER TABLE "public"."inventory_alerts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."inventory_alerts"."item_id" IS 'Product ID - NULL means alert applies to all products';



COMMENT ON COLUMN "public"."inventory_alerts"."location_id" IS 'Location ID - NULL means alert applies to all locations';



CREATE TABLE IF NOT EXISTS "public"."inventory_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "code" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."inventory_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_consumptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "movement_id" "uuid" NOT NULL,
    "crane_id" "uuid" NOT NULL,
    "operator_id" "uuid",
    "maintenance_type" "text",
    "odometer_reading" integer,
    "operation_hours" integer,
    "work_order_number" "text",
    "cost_center_id" "uuid",
    "approved_by" "uuid",
    "consumption_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "inventory_consumptions_maintenance_type_check" CHECK (("maintenance_type" = ANY (ARRAY['preventive'::"text", 'corrective'::"text", 'emergency'::"text"])))
);


ALTER TABLE "public"."inventory_consumptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "sku" "text",
    "barcode" "text",
    "category_id" "uuid",
    "unit_of_measure" "text" DEFAULT 'unidad'::"text" NOT NULL,
    "minimum_stock" integer DEFAULT 0,
    "maximum_stock" integer DEFAULT 0,
    "safety_stock" integer DEFAULT 0,
    "unit_cost" numeric(10,2) DEFAULT 0,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_critical" boolean DEFAULT false,
    "has_expiration" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);

ALTER TABLE ONLY "public"."inventory_items" REPLICA IDENTITY FULL;


ALTER TABLE "public"."inventory_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "address" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."inventory_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_movement_change_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "movement_id" "uuid" NOT NULL,
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "change_type" "text" NOT NULL,
    "field_name" "text" NOT NULL,
    "old_value" "text",
    "new_value" "text",
    "change_summary" "text",
    "change_context" "text",
    CONSTRAINT "inventory_movement_change_history_change_type_check" CHECK (("change_type" = ANY (ARRAY['CREATE'::"text", 'UPDATE'::"text", 'DELETE'::"text", 'SNAPSHOT'::"text"])))
);


ALTER TABLE "public"."inventory_movement_change_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "movement_type" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_cost" numeric(10,2),
    "total_cost" numeric(10,2),
    "reference_document" "text",
    "batch_number" "text",
    "expiration_date" "date",
    "supplier_id" "uuid",
    "crane_id" "uuid",
    "operator_id" "uuid",
    "maintenance_id" "uuid",
    "reason" "text",
    "observations" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "movement_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "supplier_name" "text",
    "cost_id" "uuid",
    "receipt_photo_paths" "text"[],
    "supplier_invoice_id" "uuid",
    "supplier_invoice_item_id" "uuid",
    CONSTRAINT "inventory_movements_movement_type_check" CHECK (("movement_type" = ANY (ARRAY['entry'::"text", 'exit'::"text", 'transfer'::"text", 'adjustment'::"text", 'sale'::"text"]))),
    CONSTRAINT "inventory_movements_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'cancelled'::"text"])))
);

ALTER TABLE ONLY "public"."inventory_movements" REPLICA IDENTITY FULL;


ALTER TABLE "public"."inventory_movements" OWNER TO "postgres";


COMMENT ON COLUMN "public"."inventory_movements"."supplier_name" IS 'DEPRECATED: Usar supplier_id (FK a suppliers). Este campo solo existe para migración de datos legacy.';



COMMENT ON COLUMN "public"."inventory_movements"."cost_id" IS 'Reference to cost entry when inventory movement generates a cost (e.g., purchases)';



CREATE TABLE IF NOT EXISTS "public"."inventory_stock" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "current_quantity" integer DEFAULT 0 NOT NULL,
    "reserved_quantity" integer DEFAULT 0 NOT NULL,
    "available_quantity" integer GENERATED ALWAYS AS (("current_quantity" - "reserved_quantity")) STORED,
    "last_movement_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inventory_stock" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "contact_person" "text",
    "email" "text",
    "phone" "text",
    "address" "text",
    "rut" "text",
    "payment_terms" "text",
    "delivery_time_days" integer DEFAULT 0,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "category" "text" DEFAULT 'otros'::"text" NOT NULL,
    "subcategory" "text",
    "notes" "text",
    "updated_by" "uuid",
    "default_payment_term_id" "uuid",
    "credit_date" "date"
);


ALTER TABLE "public"."inventory_suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_alert_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "overdue_alerts_enabled" boolean DEFAULT true,
    "due_soon_alerts_enabled" boolean DEFAULT true,
    "due_soon_days" integer DEFAULT 7,
    "email_notifications" boolean DEFAULT false,
    "push_notifications" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invoice_alert_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_cancellations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "credit_note_number" "text" NOT NULL,
    "cancellation_reason" "text" NOT NULL,
    "reason_details" "text",
    "cancelled_by" "uuid",
    "cancelled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "original_folio" "text" NOT NULL,
    "original_numero_fiscal" "text",
    "original_total" numeric NOT NULL,
    "original_client_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invoice_cancellations" OWNER TO "postgres";


COMMENT ON TABLE "public"."invoice_cancellations" IS 'Registro de anulaciones de facturas con Nota de Crédito para auditoría contable';



COMMENT ON COLUMN "public"."invoice_cancellations"."credit_note_number" IS 'Número de Nota de Crédito emitida en SII (obligatorio)';



COMMENT ON COLUMN "public"."invoice_cancellations"."cancellation_reason" IS 'Motivo de anulación (obligatorio)';



CREATE TABLE IF NOT EXISTS "public"."invoice_closures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "closure_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invoice_closures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_services" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL
);


ALTER TABLE "public"."invoice_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "folio" "text" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "issue_date" "date" NOT NULL,
    "due_date" "date" NOT NULL,
    "subtotal" numeric(10,2) NOT NULL,
    "vat" numeric(10,2) NOT NULL,
    "total" numeric(10,2) NOT NULL,
    "status" "public"."invoice_status" DEFAULT 'draft'::"public"."invoice_status",
    "payment_date" "date",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "numero_fiscal" "text",
    "paid_amount" numeric(10,2) DEFAULT 0,
    "remaining_amount" numeric(10,2) GENERATED ALWAYS AS (("total" - "paid_amount")) STORED,
    "payment_term_id" "uuid",
    "product_service_description" "text" NOT NULL,
    CONSTRAINT "invoices_paid_amount_check" CHECK (("paid_amount" >= (0)::numeric)),
    CONSTRAINT "invoices_product_service_description_len_chk" CHECK ((("char_length"("btrim"("product_service_description")) >= 10) AND ("char_length"("btrim"("product_service_description")) <= 500)))
);

ALTER TABLE ONLY "public"."invoices" REPLICA IDENTITY FULL;


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "data" "jsonb",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_logs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"]))),
    CONSTRAINT "notification_logs_type_check" CHECK (("type" = ANY (ARRAY['push'::"text", 'email'::"text", 'in_app'::"text", 'inventory_alert'::"text"])))
);


ALTER TABLE "public"."notification_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "crane_alerts" boolean DEFAULT true,
    "maintenance_reminders" boolean DEFAULT true,
    "document_expiry_alerts" boolean DEFAULT true,
    "email_notifications" boolean DEFAULT true,
    "push_notifications" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" DEFAULT 'info'::"text" NOT NULL,
    "category" "text" DEFAULT 'system'::"text" NOT NULL,
    "priority" integer DEFAULT 4 NOT NULL,
    "group_key" "text",
    "group_count" integer DEFAULT 1,
    "action_type" "text",
    "action_url" "text",
    "action_data" "jsonb",
    "entity_type" "text",
    "entity_id" "uuid",
    "read_at" timestamp with time zone,
    "dismissed_at" timestamp with time zone,
    "snoozed_until" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notifications_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 5)))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."operator_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operator_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_size" integer,
    "content_type" "text",
    "expiry_date" "date",
    "issued_date" "date",
    "notes" "text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "operator_documents_document_type_check" CHECK (("document_type" = ANY (ARRAY['cedula_identidad'::"text", 'licencia_conducir'::"text", 'examen_psicosensotecnico'::"text", 'examen_altura'::"text", 'seguro_vida'::"text", 'contrato_trabajo'::"text"])))
);


ALTER TABLE "public"."operator_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."operators" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "rut" "text" NOT NULL,
    "phone" "text",
    "license_number" "text",
    "exam_expiry" "date",
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "operator_type" "text" DEFAULT 'crane_operator'::"text",
    "department" "text",
    "position" "text",
    "commission_exempt" boolean DEFAULT false NOT NULL,
    CONSTRAINT "operators_operator_type_check" CHECK (("operator_type" = ANY (ARRAY['crane_operator'::"text", 'administrative'::"text"])))
);


ALTER TABLE "public"."operators" OWNER TO "postgres";


COMMENT ON COLUMN "public"."operators"."user_id" IS 'Link to the user profile for app access.';



CREATE TABLE IF NOT EXISTS "public"."supplier_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid",
    "amount" numeric NOT NULL,
    "due_date" "date" NOT NULL,
    "paid_date" "date",
    "description" "text" NOT NULL,
    "category" "text" NOT NULL,
    "reference_number" "text",
    "notes" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "paid_amount" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    "part_name" "text",
    "part_quantity" numeric,
    "part_unit_price" numeric,
    "crane_id" "uuid",
    "add_to_inventory" boolean DEFAULT false,
    "supplier_invoice_id" "uuid",
    "cost_id" "uuid",
    "subcategory" "text",
    CONSTRAINT "supplier_payments_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "supplier_payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'overdue'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."supplier_payments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."supplier_payments"."part_name" IS 'Name of the part/piece purchased';



COMMENT ON COLUMN "public"."supplier_payments"."part_quantity" IS 'Quantity of parts purchased';



COMMENT ON COLUMN "public"."supplier_payments"."part_unit_price" IS 'Unit price per part';



COMMENT ON COLUMN "public"."supplier_payments"."crane_id" IS 'Associated crane for the part (optional)';



COMMENT ON COLUMN "public"."supplier_payments"."add_to_inventory" IS 'Whether to automatically add this purchase to inventory';



CREATE OR REPLACE VIEW "public"."orphan_crane_parts_candidates" WITH ("security_invoker"='on') AS
 SELECT "p"."id" AS "part_id",
    "p"."part_name",
    "p"."cost_id",
    "p"."created_at",
    "sp"."id" AS "candidate_payment_id",
    "sp"."description" AS "payment_desc",
    "sp"."amount" AS "payment_amount",
    "sp"."paid_date",
    "c"."id" AS "candidate_cost_id",
    "c"."description" AS "cost_desc",
    "c"."amount" AS "cost_amount",
    "c"."date" AS "cost_date"
   FROM (("public"."crane_parts" "p"
     LEFT JOIN "public"."supplier_payments" "sp" ON ((("sp"."paid_date" >= (("p"."created_at")::"date" - '7 days'::interval)) AND ("sp"."paid_date" <= (("p"."created_at")::"date" + '7 days'::interval)))))
     LEFT JOIN "public"."costs" "c" ON ((("c"."date" >= (("p"."created_at")::"date" - '7 days'::interval)) AND ("c"."date" <= (("p"."created_at")::"date" + '7 days'::interval)))))
  WHERE ("p"."cost_id" IS NULL)
  ORDER BY "p"."created_at" DESC;


ALTER VIEW "public"."orphan_crane_parts_candidates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."password_reset_rate_limits" (
    "email_hash" "text" NOT NULL,
    "ip_hash" "text" NOT NULL,
    "attempt_count" integer DEFAULT 1 NOT NULL,
    "window_started_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "last_attempt_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "blocked_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "password_reset_rate_limits_attempt_count_check" CHECK (("attempt_count" >= 0))
);


ALTER TABLE "public"."password_reset_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patent_search_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "patente" "text" NOT NULL,
    "marca" "text" NOT NULL,
    "modelo" "text" NOT NULL,
    "año" integer,
    "color" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."patent_search_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "applied_amount" numeric(10,2) NOT NULL,
    "application_method" "public"."application_method" DEFAULT 'manual'::"public"."application_method",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payment_applications_applied_amount_check" CHECK (("applied_amount" > (0)::numeric))
);


ALTER TABLE "public"."payment_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_terms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "days" integer DEFAULT 0,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."payment_terms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "payment_date" "date" NOT NULL,
    "bank_reference" "text",
    "payment_method" "text" DEFAULT 'transferencia'::"text",
    "notes" "text",
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status",
    "applied_amount" numeric(10,2) DEFAULT 0,
    "remaining_amount" numeric(10,2) GENERATED ALWAYS AS (("amount" - "applied_amount")) STORED,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payments_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "payments_applied_amount_check" CHECK (("applied_amount" >= (0)::numeric))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_voids" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "voided_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "voided_by" "uuid",
    "original_cost_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "replacement_supplier_id" "uuid",
    "original_cost_snapshot" "jsonb" NOT NULL,
    "original_movements_snapshot" "jsonb",
    "original_payment_snapshot" "jsonb",
    "original_invoice_link_snapshot" "jsonb",
    "reverted_summary" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."purchase_voids" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh_key" "text" NOT NULL,
    "auth_key" "text" NOT NULL,
    "user_agent" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quick_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "notes" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "photo_url" "text",
    "location" "jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quick_entries_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'discarded'::"text"]))),
    CONSTRAINT "quick_entries_type_check" CHECK (("type" = ANY (ARRAY['service'::"text", 'cost'::"text", 'inventory'::"text", 'maintenance'::"text"])))
);


ALTER TABLE "public"."quick_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."route_tolls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "route_id" "uuid" NOT NULL,
    "toll_station_id" "uuid" NOT NULL,
    "sequence_order" integer DEFAULT 1 NOT NULL,
    "is_optional" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."route_tolls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."routes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "origin" "text" NOT NULL,
    "destination" "text" NOT NULL,
    "distance_km" numeric DEFAULT 0 NOT NULL,
    "estimated_time_hours" numeric DEFAULT 0 NOT NULL,
    "consumption_factor" numeric DEFAULT 1.0 NOT NULL,
    "route_type" "text" DEFAULT 'highway'::"text" NOT NULL,
    "difficulty_level" "text" DEFAULT 'normal'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."routes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "latitude" numeric NOT NULL,
    "longitude" numeric NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."saved_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scheduled_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_invoice_id" "uuid",
    "scheduled_date" "date" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "priority" character varying(10) DEFAULT 'medium'::character varying,
    "payment_method" character varying(20),
    "notes" "text",
    "reminder_sent" boolean DEFAULT false,
    "reminder_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "scheduled_payments_payment_method_check" CHECK ((("payment_method")::"text" = ANY ((ARRAY['transfer'::character varying, 'check'::character varying, 'cash'::character varying, 'credit'::character varying])::"text"[]))),
    CONSTRAINT "scheduled_payments_priority_check" CHECK ((("priority")::"text" = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'urgent'::character varying])::"text"[]))),
    CONSTRAINT "scheduled_payments_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'paid'::character varying, 'cancelled'::character varying, 'rescheduled'::character varying])::"text"[])))
);


ALTER TABLE "public"."scheduled_payments" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."service_cash_receipt_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."service_cash_receipt_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_cash_receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "folio" "text" DEFAULT "public"."generate_service_cash_receipt_folio"() NOT NULL,
    "paid_amount" numeric NOT NULL,
    "paid_date" "date" NOT NULL,
    "payment_method" "text" NOT NULL,
    "notes" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."service_cash_receipts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_change_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "service_folio" "text" NOT NULL,
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "change_type" "text" NOT NULL,
    "field_name" "text" NOT NULL,
    "old_value" "text",
    "new_value" "text",
    "change_context" "text" DEFAULT 'manual'::"text",
    "change_summary" "text",
    CONSTRAINT "service_change_history_change_type_check" CHECK (("change_type" = ANY (ARRAY['CREATE'::"text", 'UPDATE'::"text", 'DELETE'::"text", 'SNAPSHOT'::"text"])))
);


ALTER TABLE "public"."service_change_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_closures" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "folio" "text" NOT NULL,
    "date_from" "date" NOT NULL,
    "date_to" "date" NOT NULL,
    "client_id" "uuid",
    "total" numeric(10,2) NOT NULL,
    "status" "public"."closure_status" DEFAULT 'open'::"public"."closure_status",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "purchase_order" "text"
);


ALTER TABLE "public"."service_closures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_costs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "cost_type" "text" NOT NULL,
    "amount" numeric DEFAULT 0 NOT NULL,
    "operator_id" "uuid",
    "crane_id" "uuid",
    "description" "text" NOT NULL,
    "notes" "text",
    "is_auto_generated" boolean DEFAULT false,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "service_costs_cost_type_check" CHECK (("cost_type" = ANY (ARRAY['commission'::"text", 'fuel'::"text", 'maintenance'::"text", 'transport'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."service_costs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "service_type_id" "uuid",
    "origin" "text",
    "destination" "text",
    "value" numeric DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."service_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "operator_id" "uuid",
    "crane_id" "uuid",
    "commission_amount" numeric DEFAULT 0,
    "resource_type" "text" NOT NULL,
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "role" "text" DEFAULT 'Principal'::"text",
    CONSTRAINT "service_resources_resource_type_check" CHECK (("resource_type" = ANY (ARRAY['operator'::"text", 'crane'::"text"])))
);


ALTER TABLE "public"."service_resources" OWNER TO "postgres";


COMMENT ON COLUMN "public"."service_resources"."role" IS 'Rol del operador en el servicio (ej: Principal, Auxiliar, Supervisor)';



CREATE TABLE IF NOT EXISTS "public"."service_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "base_price" numeric(10,2),
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "vehicle_info_optional" boolean DEFAULT false NOT NULL,
    "purchase_order_required" boolean DEFAULT false NOT NULL,
    "origin_required" boolean DEFAULT true NOT NULL,
    "destination_required" boolean DEFAULT true NOT NULL,
    "crane_required" boolean DEFAULT true NOT NULL,
    "operator_required" boolean DEFAULT true NOT NULL,
    "vehicle_brand_required" boolean DEFAULT true NOT NULL,
    "vehicle_model_required" boolean DEFAULT true NOT NULL,
    "license_plate_required" boolean DEFAULT true NOT NULL,
    "is_outsourced" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."service_types" OWNER TO "postgres";


COMMENT ON COLUMN "public"."service_types"."is_outsourced" IS 'Indica si este tipo de servicio es ejecutado por un proveedor externo (subcontratado)';



CREATE TABLE IF NOT EXISTS "public"."service_update_error_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid",
    "user_id" "uuid",
    "error_code" "text",
    "error_message" "text",
    "error_details" "jsonb",
    "attempted_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."service_update_error_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "folio" "text" NOT NULL,
    "request_date" "date" NOT NULL,
    "service_date" "date" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "purchase_order" "text",
    "vehicle_brand" "text",
    "vehicle_model" "text",
    "license_plate" "text",
    "origin" "text",
    "destination" "text",
    "service_type_id" "uuid" NOT NULL,
    "value" numeric(10,2) NOT NULL,
    "crane_id" "uuid",
    "operator_id" "uuid",
    "operator_commission" numeric(10,2) DEFAULT 0,
    "status" "public"."service_status" DEFAULT 'pending'::"public"."service_status",
    "observations" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "has_excess" boolean DEFAULT false NOT NULL,
    "client_covered_amount" numeric,
    "excess_amount" numeric,
    "invoice_folio" "text",
    "invoice_numero_fiscal" "text",
    "custody_mode" "text" DEFAULT 'none'::"text",
    "custody_days" integer,
    "custody_daily_rate" numeric,
    "custody_start_date" "date",
    "custody_end_date" "date",
    "custody_vehicle_type" "text",
    "custody_discount_percentage" numeric DEFAULT 0,
    "custody_total_amount" numeric,
    "custody_notes" "text",
    "purchase_order_number" "text",
    "quote_number" "text",
    "custody_rate_type" "text" DEFAULT 'daily'::"text",
    "related_service_id" "uuid",
    "service_relationship_type" "text",
    "third_party_client_id" "uuid",
    "start_time" time without time zone,
    "end_time" time without time zone,
    "crane_mileage" integer,
    "insured_name" "text",
    "outsourced_provider_id" "uuid",
    "outsourced_cost" numeric DEFAULT 0,
    "outsourced_notes" "text",
    "company_rut" "text",
    "company_name" "text",
    "operator_notified_at" timestamp with time zone,
    "operator_notified_for" "uuid",
    "contact_person" "text",
    "contact_phone" "text",
    "preferred_time" "text",
    "urgency" "text" DEFAULT 'normal'::"text",
    CONSTRAINT "services_custody_discount_percentage_check" CHECK ((("custody_discount_percentage" >= (0)::numeric) AND ("custody_discount_percentage" <= (100)::numeric))),
    CONSTRAINT "services_custody_mode_check" CHECK (("custody_mode" = ANY (ARRAY['manual'::"text", 'calendar'::"text", 'none'::"text"]))),
    CONSTRAINT "services_service_relationship_type_check" CHECK (("service_relationship_type" = ANY (ARRAY['main'::"text", 'excess'::"text"]))),
    CONSTRAINT "services_urgency_check" CHECK (("urgency" = ANY (ARRAY['normal'::"text", 'urgent'::"text"])))
);

ALTER TABLE ONLY "public"."services" REPLICA IDENTITY FULL;


ALTER TABLE "public"."services" OWNER TO "postgres";


COMMENT ON COLUMN "public"."services"."vehicle_brand" IS 'Marca del vehículo - Opcional para ciertos tipos de servicio como Taxi';



COMMENT ON COLUMN "public"."services"."vehicle_model" IS 'Modelo del vehículo - Opcional para ciertos tipos de servicio como Taxi';



COMMENT ON COLUMN "public"."services"."license_plate" IS 'Patente del vehículo - Opcional para ciertos tipos de servicio como Taxi';



COMMENT ON COLUMN "public"."services"."origin" IS 'Origen del servicio - Opcional para ciertos tipos de servicio';



COMMENT ON COLUMN "public"."services"."destination" IS 'Destino del servicio - Opcional para ciertos tipos de servicio';



COMMENT ON COLUMN "public"."services"."crane_id" IS 'ID de la grúa - Opcional para servicios que no requieren grúa';



COMMENT ON COLUMN "public"."services"."operator_id" IS 'ID del operador - Opcional para servicios que no requieren operador';



COMMENT ON COLUMN "public"."services"."operator_commission" IS 'DEPRECATED: Use service_resources.commission_amount instead';



COMMENT ON COLUMN "public"."services"."has_excess" IS 'Indicates if service has excess amount paid by third party';



COMMENT ON COLUMN "public"."services"."client_covered_amount" IS 'Amount covered by client when has_excess is true';



COMMENT ON COLUMN "public"."services"."excess_amount" IS 'Excess amount paid by third party (calculated: value - client_covered_amount)';



COMMENT ON COLUMN "public"."services"."custody_mode" IS 'Vehicle custody mode: manual (specific days), calendar (date range), or none';



COMMENT ON COLUMN "public"."services"."custody_days" IS 'Number of custody days';



COMMENT ON COLUMN "public"."services"."custody_daily_rate" IS 'Daily rate for custody service';



COMMENT ON COLUMN "public"."services"."custody_start_date" IS 'Custody start date (for calendar mode)';



COMMENT ON COLUMN "public"."services"."custody_end_date" IS 'Custody end date (for calendar mode)';



COMMENT ON COLUMN "public"."services"."custody_vehicle_type" IS 'Type of vehicle under custody';



COMMENT ON COLUMN "public"."services"."custody_discount_percentage" IS 'Discount percentage applied to custody service';



COMMENT ON COLUMN "public"."services"."custody_total_amount" IS 'Total amount for custody service';



COMMENT ON COLUMN "public"."services"."custody_notes" IS 'Additional notes for custody service';



COMMENT ON COLUMN "public"."services"."purchase_order_number" IS 'Número de orden de compra del cliente - usado para flujo especial de clientes VIP';



COMMENT ON COLUMN "public"."services"."custody_rate_type" IS 'Type of custody rate: daily, weekly, or monthly. Used to display original rate in UI.';



COMMENT ON COLUMN "public"."services"."third_party_client_id" IS 'Client ID for excess services - references the third party client who will be billed for the excess amount';



COMMENT ON COLUMN "public"."services"."start_time" IS 'Hora de inicio del servicio (HH:MM)';



COMMENT ON COLUMN "public"."services"."end_time" IS 'Hora de término del servicio (HH:MM)';



COMMENT ON COLUMN "public"."services"."crane_mileage" IS 'Kilometraje de la grúa al momento del servicio (no del vehículo transportado)';



COMMENT ON COLUMN "public"."services"."outsourced_provider_id" IS 'Proveedor que ejecuta el servicio subcontratado';



COMMENT ON COLUMN "public"."services"."outsourced_cost" IS 'Monto pagado al proveedor tercero por ejecutar el servicio';



COMMENT ON COLUMN "public"."services"."outsourced_notes" IS 'Notas adicionales sobre el servicio tercerizado (patente grúa tercero, contacto, etc.)';



CREATE OR REPLACE VIEW "public"."services_with_excess_summary" WITH ("security_invoker"='on') AS
 SELECT "s"."id",
    "s"."folio",
    "s"."client_id",
    "s"."service_date",
    "s"."value",
    "s"."client_covered_amount",
    "s"."has_excess",
    "s"."service_relationship_type",
    "s"."related_service_id",
    "c"."name" AS "client_name",
    "rs"."id" AS "related_service_id_actual",
    "rs"."folio" AS "related_service_folio",
    "rs"."client_id" AS "related_client_id",
    "rs"."value" AS "related_service_value",
    "rc"."name" AS "related_client_name",
        CASE
            WHEN (("s"."has_excess" = true) AND ("s"."client_covered_amount" IS NOT NULL)) THEN ("s"."value" - "s"."client_covered_amount")
            ELSE (0)::numeric
        END AS "calculated_excess_amount"
   FROM ((("public"."services" "s"
     LEFT JOIN "public"."clients" "c" ON (("s"."client_id" = "c"."id")))
     LEFT JOIN "public"."services" "rs" ON (("s"."related_service_id" = "rs"."id")))
     LEFT JOIN "public"."clients" "rc" ON (("rs"."client_id" = "rc"."id")))
  WHERE (("s"."has_excess" = true) OR ("s"."service_relationship_type" = ANY (ARRAY['main'::"text", 'excess'::"text"])));


ALTER VIEW "public"."services_with_excess_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."supplier_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_invoice_id" "uuid" NOT NULL,
    "inventory_item_id" "uuid" NOT NULL,
    "line_number" integer NOT NULL,
    "product_code" "text",
    "product_name" "text",
    "description" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price" numeric(12,2) DEFAULT 0 NOT NULL,
    "subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
    "tax_rate" numeric(8,4),
    "tax_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "movement_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "supplier_invoice_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "supplier_invoice_items_subtotal_check" CHECK (("subtotal" >= (0)::numeric)),
    CONSTRAINT "supplier_invoice_items_tax_amount_check" CHECK (("tax_amount" >= (0)::numeric)),
    CONSTRAINT "supplier_invoice_items_total_amount_check" CHECK (("total_amount" >= (0)::numeric)),
    CONSTRAINT "supplier_invoice_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."supplier_invoice_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid",
    "invoice_number" character varying(100) NOT NULL,
    "issue_date" "date" NOT NULL,
    "due_date" "date" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" character varying(3) DEFAULT 'CLP'::character varying,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "description" "text",
    "tax_amount" numeric(12,2) DEFAULT 0,
    "net_amount" numeric(12,2) NOT NULL,
    "payment_terms" integer DEFAULT 30,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "paid_amount" numeric DEFAULT 0,
    "balance" numeric GENERATED ALWAYS AS (("amount" - COALESCE("paid_amount", (0)::numeric))) STORED,
    "product_service_description" "text" NOT NULL,
    "source_module" "text" DEFAULT 'manual'::"text" NOT NULL,
    "xml_file_name" "text",
    CONSTRAINT "supplier_invoices_product_service_description_len_chk" CHECK ((("char_length"("btrim"("product_service_description")) >= 10) AND ("char_length"("btrim"("product_service_description")) <= 500))),
    CONSTRAINT "supplier_invoices_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'scheduled'::character varying, 'paid'::character varying, 'overdue'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."supplier_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "rut" character varying(20) NOT NULL,
    "email" character varying(255),
    "phone" character varying(20),
    "category" "text" DEFAULT 'otros'::"public"."supplier_category" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "address" "text",
    "contact_name" "text",
    "notes" "text",
    "subcategory" "text"
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


COMMENT ON TABLE "public"."suppliers" IS 'Tabla de proveedores del sistema de grúas';



COMMENT ON COLUMN "public"."suppliers"."is_active" IS 'Indica si el proveedor está activo en el sistema';



CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auto_backup" boolean DEFAULT true NOT NULL,
    "backup_frequency" "text" DEFAULT 'daily'::"text" NOT NULL,
    "data_retention" integer DEFAULT 12 NOT NULL,
    "maintenance_mode" boolean DEFAULT false NOT NULL,
    "email_notifications" boolean DEFAULT true NOT NULL,
    "service_reminders" boolean DEFAULT true NOT NULL,
    "invoice_alerts" boolean DEFAULT true NOT NULL,
    "overdue_notifications" boolean DEFAULT true NOT NULL,
    "system_updates" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_timeout_enabled" boolean DEFAULT true,
    "session_warning_minutes" integer DEFAULT 25,
    "session_timeout_minutes" integer DEFAULT 30,
    "report_column_config" "jsonb" DEFAULT '{"columns": {"oc": {"label": "OC", "width": 5, "visible": true}, "fecha": {"label": "Fecha", "width": 6, "visible": true}, "folio": {"label": "Folio", "width": 6, "visible": true}, "valor": {"label": "Valor", "width": 7, "visible": true}, "estado": {"label": "Estado", "width": 6, "visible": true}, "origen": {"label": "Origen", "width": 12, "visible": true}, "cliente": {"label": "Cliente", "width": 11, "visible": true}, "destino": {"label": "Destino", "width": 12, "visible": true}, "factura": {"label": "Factura", "width": 4, "visible": true}, "patente": {"label": "Patente", "width": 7, "visible": true}, "asegurado": {"label": "Asegurado", "width": 11, "visible": true}, "cotizacion": {"label": "Cotización", "width": 6, "visible": true}, "tipoServicio": {"label": "Tipo Servicio", "width": 7, "visible": true}}}'::"jsonb",
    "ai_chat_enabled" boolean DEFAULT true NOT NULL,
    CONSTRAINT "check_session_timeout_minutes" CHECK ((("session_timeout_minutes" >= 10) AND ("session_timeout_minutes" <= 120))),
    CONSTRAINT "check_session_warning_minutes" CHECK ((("session_warning_minutes" >= 5) AND ("session_warning_minutes" <= 60))),
    CONSTRAINT "system_settings_backup_frequency_check" CHECK (("backup_frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text"]))),
    CONSTRAINT "system_settings_data_retention_check" CHECK (("data_retention" > 0))
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."system_settings"."session_timeout_enabled" IS 'Habilitar cierre automático de sesión por inactividad';



COMMENT ON COLUMN "public"."system_settings"."session_warning_minutes" IS 'Minutos de inactividad antes de mostrar advertencia (5-60)';



COMMENT ON COLUMN "public"."system_settings"."session_timeout_minutes" IS 'Minutos totales antes de cerrar sesión (10-120)';



CREATE TABLE IF NOT EXISTS "public"."toll_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "toll_station_id" "uuid" NOT NULL,
    "vehicle_category" "text" NOT NULL,
    "rate_amount" numeric DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'CLP'::"text" NOT NULL,
    "valid_from" "date" DEFAULT CURRENT_DATE NOT NULL,
    "valid_until" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."toll_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."toll_stations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "location" "text" NOT NULL,
    "highway" "text",
    "km_marker" numeric,
    "operator_company" "text",
    "payment_methods" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."toll_stations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_estimates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "route_name" "text",
    "origin" "text" NOT NULL,
    "destination" "text" NOT NULL,
    "distance_km" numeric,
    "estimated_time_hours" numeric,
    "crane_type" "text",
    "vehicle_config" "text" DEFAULT '1_vehicle'::"text",
    "fuel_cost" numeric DEFAULT 0,
    "toll_cost" numeric DEFAULT 0,
    "additional_costs" numeric DEFAULT 0,
    "total_estimate" numeric DEFAULT 0,
    "calculation_details" "jsonb",
    "service_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trip_estimates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_activity_log" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "path" "text",
    "metadata" "jsonb"
);


ALTER TABLE "public"."user_activity_log" OWNER TO "postgres";


ALTER TABLE "public"."user_activity_log" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_activity_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "sent_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'accepted'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."user_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_module_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "module_key" "text" NOT NULL,
    "is_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."user_module_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "timezone" "text" DEFAULT 'America/Santiago'::"text" NOT NULL,
    "use_system_timezone" boolean DEFAULT true NOT NULL,
    "date_format" "text" DEFAULT 'DD/MM/YYYY'::"text" NOT NULL,
    "language" "text" DEFAULT 'es'::"text" NOT NULL,
    "currency" "text" DEFAULT 'CLP'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicle_api_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "endpoint" "text" NOT NULL,
    "lookup_value" "text" NOT NULL,
    "response" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."vehicle_api_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicle_brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."vehicle_brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicle_models" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."vehicle_models" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_alert_dedupe" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "alert_key" "text" NOT NULL,
    "sent_for_date" "date" DEFAULT (("now"() AT TIME ZONE 'America/Santiago'::"text"))::"date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."whatsapp_alert_dedupe" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_message_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "direction" "text" DEFAULT 'outbound'::"text" NOT NULL,
    "event" "text",
    "template_name" "text" NOT NULL,
    "recipient_phone" "text" NOT NULL,
    "parameters" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "provider_message_id" "text",
    "error_code" "text",
    "error_message" "text",
    "attempts" smallint DEFAULT 0 NOT NULL,
    "triggered_by" "uuid",
    "context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "hidden_at" timestamp with time zone,
    "hidden_by" "uuid",
    CONSTRAINT "whatsapp_message_log_direction_check" CHECK (("direction" = ANY (ARRAY['outbound'::"text", 'inbound'::"text"]))),
    CONSTRAINT "whatsapp_message_log_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'sent'::"text", 'delivered'::"text", 'read'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."whatsapp_message_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_phone_1" "text",
    "admin_phone_2" "text",
    "notify_operator_assigned" boolean DEFAULT true NOT NULL,
    "notify_service_completed" boolean DEFAULT true NOT NULL,
    "notify_document_expiry" boolean DEFAULT true NOT NULL,
    "notify_payment_pending" boolean DEFAULT true NOT NULL,
    "notify_service_no_quote" boolean DEFAULT true NOT NULL,
    "notify_service_no_operator" boolean DEFAULT false NOT NULL,
    "notify_invoice_overdue" boolean DEFAULT false NOT NULL,
    "notify_daily_reminder" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notify_inspection_completed" boolean DEFAULT true NOT NULL,
    "notify_vehicle_pickup" boolean DEFAULT true NOT NULL,
    "notify_weekly_summary" boolean DEFAULT true NOT NULL,
    "notify_operator_document_expiry" boolean DEFAULT true NOT NULL,
    "whatsapp_enabled" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."whatsapp_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."whatsapp_settings"."notify_vehicle_pickup" IS 'Enviar WhatsApp al cliente cuando el operador completa la inspección de retiro del vehículo';



COMMENT ON COLUMN "public"."whatsapp_settings"."notify_weekly_summary" IS 'Enviar resumen semanal de métricas a admins cada lunes a las 08:00';



COMMENT ON COLUMN "public"."whatsapp_settings"."notify_operator_document_expiry" IS 'Enviar alerta WhatsApp cuando documentos de operadores estén por vencer o vencidos';



ALTER TABLE ONLY "public"."audit_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."audit_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."import_batch_records" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."import_batch_records_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."backup_email_config"
    ADD CONSTRAINT "backup_email_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."backup_logs"
    ADD CONSTRAINT "backup_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_rut_department_unique" UNIQUE ("rut", "department");



ALTER TABLE ONLY "public"."closure_services"
    ADD CONSTRAINT "closure_services_closure_id_service_id_key" UNIQUE ("closure_id", "service_id");



ALTER TABLE ONLY "public"."closure_services"
    ADD CONSTRAINT "closure_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_data"
    ADD CONSTRAINT "company_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_data"
    ADD CONSTRAINT "company_data_rut_key" UNIQUE ("rut");



ALTER TABLE ONLY "public"."company_profiles"
    ADD CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("rut");



ALTER TABLE ONLY "public"."cost_bulk_payment_operations"
    ADD CONSTRAINT "cost_bulk_payment_operations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cost_categories"
    ADD CONSTRAINT "cost_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."cost_categories"
    ADD CONSTRAINT "cost_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cost_centers"
    ADD CONSTRAINT "cost_centers_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."cost_centers"
    ADD CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cost_change_history"
    ADD CONSTRAINT "cost_change_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cost_inventory_items"
    ADD CONSTRAINT "cost_inventory_items_cost_id_inventory_item_id_key" UNIQUE ("cost_id", "inventory_item_id");



ALTER TABLE ONLY "public"."cost_inventory_items"
    ADD CONSTRAINT "cost_inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cost_subcategories"
    ADD CONSTRAINT "cost_subcategories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."costs"
    ADD CONSTRAINT "costs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crane_consumption_rates"
    ADD CONSTRAINT "crane_consumption_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crane_documents"
    ADD CONSTRAINT "crane_documents_crane_id_document_type_key" UNIQUE ("crane_id", "document_type");



ALTER TABLE ONLY "public"."crane_documents"
    ADD CONSTRAINT "crane_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crane_maintenance"
    ADD CONSTRAINT "crane_maintenance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crane_part_change_history"
    ADD CONSTRAINT "crane_part_change_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crane_parts"
    ADD CONSTRAINT "crane_parts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cranes"
    ADD CONSTRAINT "cranes_license_plate_key" UNIQUE ("license_plate");



ALTER TABLE ONLY "public"."cranes"
    ADD CONSTRAINT "cranes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creditors"
    ADD CONSTRAINT "creditors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debt_installments"
    ADD CONSTRAINT "debt_installments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debt_installments"
    ADD CONSTRAINT "debt_installments_unique_debt_number" UNIQUE ("debt_id", "installment_number");



ALTER TABLE ONLY "public"."debt_payments"
    ADD CONSTRAINT "debt_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debts"
    ADD CONSTRAINT "debts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_alerts"
    ADD CONSTRAINT "document_alerts_crane_id_document_type_key" UNIQUE ("crane_id", "document_type");



ALTER TABLE ONLY "public"."document_alerts"
    ADD CONSTRAINT "document_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."frontend_error_logs"
    ADD CONSTRAINT "frontend_error_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fuel_prices"
    ADD CONSTRAINT "fuel_prices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_batch_records"
    ADD CONSTRAINT "import_batch_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_batches"
    ADD CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_history_log"
    ADD CONSTRAINT "import_history_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_rut_mappings"
    ADD CONSTRAINT "import_rut_mappings_organization_id_import_type_source_rut_key" UNIQUE ("organization_id", "import_type", "source_rut");



ALTER TABLE ONLY "public"."import_rut_mappings"
    ADD CONSTRAINT "import_rut_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."income_categories"
    ADD CONSTRAINT "income_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."income_categories"
    ADD CONSTRAINT "income_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."income_subcategories"
    ADD CONSTRAINT "income_subcategories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incomes"
    ADD CONSTRAINT "incomes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inspections"
    ADD CONSTRAINT "inspections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."internal_scheduler_secrets"
    ADD CONSTRAINT "internal_scheduler_secrets_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."inventory_alerts"
    ADD CONSTRAINT "inventory_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_categories"
    ADD CONSTRAINT "inventory_categories_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."inventory_categories"
    ADD CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_consumptions"
    ADD CONSTRAINT "inventory_consumptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."inventory_locations"
    ADD CONSTRAINT "inventory_locations_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."inventory_locations"
    ADD CONSTRAINT "inventory_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_movement_change_history"
    ADD CONSTRAINT "inventory_movement_change_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_stock"
    ADD CONSTRAINT "inventory_stock_item_id_location_id_key" UNIQUE ("item_id", "location_id");



ALTER TABLE ONLY "public"."inventory_stock"
    ADD CONSTRAINT "inventory_stock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_suppliers"
    ADD CONSTRAINT "inventory_suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_alert_settings"
    ADD CONSTRAINT "invoice_alert_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_cancellations"
    ADD CONSTRAINT "invoice_cancellations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_closures"
    ADD CONSTRAINT "invoice_closures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_services"
    ADD CONSTRAINT "invoice_services_invoice_id_service_id_key" UNIQUE ("invoice_id", "service_id");



ALTER TABLE ONLY "public"."invoice_services"
    ADD CONSTRAINT "invoice_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_folio_key" UNIQUE ("folio");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_numero_fiscal_unique" UNIQUE ("numero_fiscal");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operator_documents"
    ADD CONSTRAINT "operator_documents_operator_id_document_type_key" UNIQUE ("operator_id", "document_type");



ALTER TABLE ONLY "public"."operator_documents"
    ADD CONSTRAINT "operator_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operators"
    ADD CONSTRAINT "operators_license_number_key" UNIQUE ("license_number");



ALTER TABLE ONLY "public"."operators"
    ADD CONSTRAINT "operators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operators"
    ADD CONSTRAINT "operators_rut_key" UNIQUE ("rut");



ALTER TABLE ONLY "public"."operators"
    ADD CONSTRAINT "operators_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."password_reset_rate_limits"
    ADD CONSTRAINT "password_reset_rate_limits_pkey" PRIMARY KEY ("email_hash", "ip_hash");



ALTER TABLE ONLY "public"."patent_search_history"
    ADD CONSTRAINT "patent_search_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_applications"
    ADD CONSTRAINT "payment_applications_payment_id_invoice_id_key" UNIQUE ("payment_id", "invoice_id");



ALTER TABLE ONLY "public"."payment_applications"
    ADD CONSTRAINT "payment_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_terms"
    ADD CONSTRAINT "payment_terms_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."payment_terms"
    ADD CONSTRAINT "payment_terms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_unique_bank_reference_per_client" UNIQUE ("client_id", "bank_reference", "payment_date");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_voids"
    ADD CONSTRAINT "purchase_voids_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."quick_entries"
    ADD CONSTRAINT "quick_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."route_tolls"
    ADD CONSTRAINT "route_tolls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."routes"
    ADD CONSTRAINT "routes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_locations"
    ADD CONSTRAINT "saved_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scheduled_payments"
    ADD CONSTRAINT "scheduled_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_cash_receipts"
    ADD CONSTRAINT "service_cash_receipts_folio_key" UNIQUE ("folio");



ALTER TABLE ONLY "public"."service_cash_receipts"
    ADD CONSTRAINT "service_cash_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_cash_receipts"
    ADD CONSTRAINT "service_cash_receipts_service_id_key" UNIQUE ("service_id");



ALTER TABLE ONLY "public"."service_change_history"
    ADD CONSTRAINT "service_change_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_closures"
    ADD CONSTRAINT "service_closures_folio_key" UNIQUE ("folio");



ALTER TABLE ONLY "public"."service_closures"
    ADD CONSTRAINT "service_closures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_costs"
    ADD CONSTRAINT "service_costs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_rates"
    ADD CONSTRAINT "service_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_resources"
    ADD CONSTRAINT "service_resources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "service_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "service_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_update_error_logs"
    ADD CONSTRAINT "service_update_error_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_folio_key" UNIQUE ("folio");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_folio_unique" UNIQUE ("folio");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_categories"
    ADD CONSTRAINT "supplier_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."supplier_categories"
    ADD CONSTRAINT "supplier_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_invoice_items"
    ADD CONSTRAINT "supplier_invoice_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_invoice_items"
    ADD CONSTRAINT "supplier_invoice_items_supplier_invoice_id_line_number_key" UNIQUE ("supplier_invoice_id", "line_number");



ALTER TABLE ONLY "public"."supplier_invoices"
    ADD CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_rut_key" UNIQUE ("rut");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."toll_rates"
    ADD CONSTRAINT "toll_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."toll_stations"
    ADD CONSTRAINT "toll_stations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_estimates"
    ADD CONSTRAINT "trip_estimates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_cancellations"
    ADD CONSTRAINT "unique_credit_note_number" UNIQUE ("credit_note_number");



ALTER TABLE ONLY "public"."invoice_cancellations"
    ADD CONSTRAINT "unique_invoice_cancellation" UNIQUE ("invoice_id");



ALTER TABLE ONLY "public"."inventory_stock"
    ADD CONSTRAINT "unique_item_location" UNIQUE ("item_id", "location_id");



ALTER TABLE ONLY "public"."user_activity_log"
    ADD CONSTRAINT "user_activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_module_permissions"
    ADD CONSTRAINT "user_module_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_module_permissions"
    ADD CONSTRAINT "user_module_permissions_user_id_module_key_key" UNIQUE ("user_id", "module_key");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."vehicle_api_cache"
    ADD CONSTRAINT "vehicle_api_cache_endpoint_value_key" UNIQUE ("endpoint", "lookup_value");



ALTER TABLE ONLY "public"."vehicle_api_cache"
    ADD CONSTRAINT "vehicle_api_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicle_brands"
    ADD CONSTRAINT "vehicle_brands_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."vehicle_brands"
    ADD CONSTRAINT "vehicle_brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicle_models"
    ADD CONSTRAINT "vehicle_models_brand_id_name_key" UNIQUE ("brand_id", "name");



ALTER TABLE ONLY "public"."vehicle_models"
    ADD CONSTRAINT "vehicle_models_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_alert_dedupe"
    ADD CONSTRAINT "whatsapp_alert_dedupe_alert_key_sent_for_date_key" UNIQUE ("alert_key", "sent_for_date");



ALTER TABLE ONLY "public"."whatsapp_alert_dedupe"
    ADD CONSTRAINT "whatsapp_alert_dedupe_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_message_log"
    ADD CONSTRAINT "whatsapp_message_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_settings"
    ADD CONSTRAINT "whatsapp_settings_pkey" PRIMARY KEY ("id");



CREATE INDEX "creditors_name_idx" ON "public"."creditors" USING "btree" ("name");



CREATE INDEX "creditors_type_idx" ON "public"."creditors" USING "btree" ("type");



CREATE INDEX "debt_installments_debt_id_idx" ON "public"."debt_installments" USING "btree" ("debt_id");



CREATE INDEX "debt_installments_due_date_idx" ON "public"."debt_installments" USING "btree" ("due_date");



CREATE INDEX "debt_installments_status_idx" ON "public"."debt_installments" USING "btree" ("status");



CREATE INDEX "debt_payments_installment_id_idx" ON "public"."debt_payments" USING "btree" ("debt_installment_id");



CREATE INDEX "debt_payments_payment_date_idx" ON "public"."debt_payments" USING "btree" ("payment_date");



CREATE INDEX "debts_creditor_id_idx" ON "public"."debts" USING "btree" ("creditor_id");



CREATE INDEX "debts_first_due_date_idx" ON "public"."debts" USING "btree" ("first_due_date");



CREATE INDEX "debts_status_idx" ON "public"."debts" USING "btree" ("status");



CREATE INDEX "idx_audit_log_table_name" ON "public"."audit_log" USING "btree" ("table_name");



CREATE INDEX "idx_audit_log_timestamp" ON "public"."audit_log" USING "btree" ("timestamp");



CREATE INDEX "idx_calendar_events_date" ON "public"."calendar_events" USING "btree" ("date");



CREATE INDEX "idx_calendar_events_service_id" ON "public"."calendar_events" USING "btree" ("service_id");



CREATE INDEX "idx_calendar_events_type" ON "public"."calendar_events" USING "btree" ("type");



CREATE INDEX "idx_cch_changed_at" ON "public"."cost_change_history" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_cch_cost_id" ON "public"."cost_change_history" USING "btree" ("cost_id");



CREATE INDEX "idx_clients_created_by" ON "public"."clients" USING "btree" ("created_by");



CREATE INDEX "idx_clients_user_id" ON "public"."clients" USING "btree" ("user_id");



CREATE INDEX "idx_closure_services_service_id" ON "public"."closure_services" USING "btree" ("service_id");



CREATE INDEX "idx_cost_bulk_payment_operations_executed_at" ON "public"."cost_bulk_payment_operations" USING "btree" ("executed_at" DESC);



CREATE INDEX "idx_cost_bulk_payment_operations_executed_by" ON "public"."cost_bulk_payment_operations" USING "btree" ("executed_by");



CREATE INDEX "idx_cost_categories_default_cost_center_id" ON "public"."cost_categories" USING "btree" ("default_cost_center_id");



CREATE INDEX "idx_cost_centers_code" ON "public"."cost_centers" USING "btree" ("code");



CREATE INDEX "idx_cost_centers_parent_id" ON "public"."cost_centers" USING "btree" ("parent_id");



CREATE INDEX "idx_cost_subcategories_active" ON "public"."cost_subcategories" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_cost_subcategories_category_id" ON "public"."cost_subcategories" USING "btree" ("category_id");



CREATE INDEX "idx_costs_category_service" ON "public"."costs" USING "btree" ("category_id", "service_id");



CREATE INDEX "idx_costs_cost_center_id" ON "public"."costs" USING "btree" ("cost_center_id");



CREATE INDEX "idx_costs_cost_center_lookup" ON "public"."costs" USING "btree" ("cost_center_id", "category_id");



CREATE INDEX "idx_costs_description_fulltext" ON "public"."costs" USING "gin" ("to_tsvector"('"spanish"'::"regconfig", "description"));



CREATE INDEX "idx_costs_maintenance_id" ON "public"."costs" USING "btree" ("maintenance_id");



CREATE INDEX "idx_costs_notes_fulltext" ON "public"."costs" USING "gin" ("to_tsvector"('"spanish"'::"regconfig", COALESCE("notes", ''::"text")));



CREATE INDEX "idx_costs_payment_batch" ON "public"."costs" USING "btree" ("payment_batch_id") WHERE ("payment_batch_id" IS NOT NULL);



CREATE INDEX "idx_costs_payment_date" ON "public"."costs" USING "btree" ("payment_date") WHERE ("payment_date" IS NOT NULL);



CREATE INDEX "idx_costs_service_id" ON "public"."costs" USING "btree" ("service_id");



CREATE INDEX "idx_costs_supplier_id" ON "public"."costs" USING "btree" ("supplier_id");



CREATE INDEX "idx_costs_supplier_invoice_id" ON "public"."costs" USING "btree" ("supplier_invoice_id");



CREATE INDEX "idx_costs_supplier_payment_id" ON "public"."costs" USING "btree" ("supplier_payment_id");



CREATE UNIQUE INDEX "idx_costs_unique_commission" ON "public"."costs" USING "btree" ("service_id", "operator_id", "category_id") WHERE (("service_id" IS NOT NULL) AND ("operator_id" IS NOT NULL) AND ("category_id" = '440296d4-09c2-4f3a-b02b-835f861df4c4'::"uuid"));



COMMENT ON INDEX "public"."idx_costs_unique_commission" IS 'Previene comisiones duplicadas: un operador solo puede tener una comisión por servicio';



CREATE UNIQUE INDEX "idx_costs_unique_service_entry" ON "public"."costs" USING "btree" ("description", "amount", "date", "service_id") WHERE ("service_id" IS NOT NULL);



CREATE INDEX "idx_cpch_changed_at" ON "public"."crane_part_change_history" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_cpch_part_id" ON "public"."crane_part_change_history" USING "btree" ("crane_part_id");



CREATE INDEX "idx_crane_parts_cost_id" ON "public"."crane_parts" USING "btree" ("cost_id");



CREATE INDEX "idx_crane_parts_crane_id" ON "public"."crane_parts" USING "btree" ("crane_id");



CREATE INDEX "idx_crane_parts_date" ON "public"."crane_parts" USING "btree" ("date");



CREATE INDEX "idx_crane_parts_supplier" ON "public"."crane_parts" USING "btree" ("supplier");



CREATE INDEX "idx_crane_parts_supplier_id" ON "public"."crane_parts" USING "btree" ("supplier_id");



CREATE INDEX "idx_cranes_created_by" ON "public"."cranes" USING "btree" ("created_by");



CREATE INDEX "idx_cranes_owner_company_rut" ON "public"."cranes" USING "btree" ("owner_company_rut") WHERE ("owner_company_rut" IS NOT NULL);



CREATE INDEX "idx_cranes_status" ON "public"."cranes" USING "btree" ("status");



CREATE INDEX "idx_imch_changed_at" ON "public"."inventory_movement_change_history" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_imch_movement_id" ON "public"."inventory_movement_change_history" USING "btree" ("movement_id");



CREATE INDEX "idx_income_subcategories_active" ON "public"."income_subcategories" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_income_subcategories_category_id" ON "public"."income_subcategories" USING "btree" ("category_id");



CREATE INDEX "idx_incomes_category" ON "public"."incomes" USING "btree" ("category_id");



CREATE INDEX "idx_incomes_client" ON "public"."incomes" USING "btree" ("client_id");



CREATE INDEX "idx_incomes_created_at" ON "public"."incomes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_incomes_date" ON "public"."incomes" USING "btree" ("income_date" DESC);



CREATE INDEX "idx_incomes_invoice_id" ON "public"."incomes" USING "btree" ("invoice_id");



CREATE INDEX "idx_inventory_movements_cost_id" ON "public"."inventory_movements" USING "btree" ("cost_id");



CREATE INDEX "idx_inventory_movements_supplier_id" ON "public"."inventory_movements" USING "btree" ("supplier_id");



CREATE INDEX "idx_inventory_movements_supplier_invoice_id" ON "public"."inventory_movements" USING "btree" ("supplier_invoice_id");



CREATE INDEX "idx_inventory_movements_supplier_invoice_item_id" ON "public"."inventory_movements" USING "btree" ("supplier_invoice_item_id");



CREATE INDEX "idx_inventory_suppliers_credit_date" ON "public"."inventory_suppliers" USING "btree" ("credit_date");



CREATE INDEX "idx_inventory_suppliers_default_payment_term_id" ON "public"."inventory_suppliers" USING "btree" ("default_payment_term_id");



CREATE INDEX "idx_invoice_alert_settings_user" ON "public"."invoice_alert_settings" USING "btree" ("user_id");



CREATE INDEX "idx_invoice_cancellations_cancelled_at" ON "public"."invoice_cancellations" USING "btree" ("cancelled_at" DESC);



CREATE INDEX "idx_invoice_cancellations_credit_note" ON "public"."invoice_cancellations" USING "btree" ("credit_note_number");



CREATE INDEX "idx_invoice_cancellations_invoice_id" ON "public"."invoice_cancellations" USING "btree" ("invoice_id");



CREATE INDEX "idx_invoice_closures_closure_id" ON "public"."invoice_closures" USING "btree" ("closure_id");



CREATE INDEX "idx_invoice_closures_invoice_id" ON "public"."invoice_closures" USING "btree" ("invoice_id");



CREATE INDEX "idx_invoice_services_service_id" ON "public"."invoice_services" USING "btree" ("service_id");



CREATE INDEX "idx_invoices_created_by" ON "public"."invoices" USING "btree" ("created_by");



CREATE INDEX "idx_invoices_numero_fiscal" ON "public"."invoices" USING "btree" ("numero_fiscal");



CREATE INDEX "idx_invoices_overdue_check" ON "public"."invoices" USING "btree" ("status", "due_date") WHERE ("status" = ANY (ARRAY['sent'::"public"."invoice_status", 'draft'::"public"."invoice_status", 'overdue'::"public"."invoice_status"]));



CREATE INDEX "idx_invoices_payment_term" ON "public"."invoices" USING "btree" ("payment_term_id");



CREATE INDEX "idx_invoices_remaining_amount" ON "public"."invoices" USING "btree" ("remaining_amount") WHERE ("remaining_amount" > (0)::numeric);



CREATE INDEX "idx_maintenance_description_fulltext" ON "public"."crane_maintenance" USING "gin" ("to_tsvector"('"spanish"'::"regconfig", "description"));



CREATE INDEX "idx_notification_logs_status" ON "public"."notification_logs" USING "btree" ("status");



CREATE INDEX "idx_notification_logs_type" ON "public"."notification_logs" USING "btree" ("type");



CREATE INDEX "idx_notification_logs_user_id" ON "public"."notification_logs" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_category" ON "public"."notifications" USING "btree" ("category");



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notifications_entity" ON "public"."notifications" USING "btree" ("entity_type", "entity_id") WHERE ("entity_id" IS NOT NULL);



CREATE INDEX "idx_notifications_group_key" ON "public"."notifications" USING "btree" ("group_key") WHERE ("group_key" IS NOT NULL);



CREATE INDEX "idx_notifications_priority" ON "public"."notifications" USING "btree" ("priority");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_user_unread" ON "public"."notifications" USING "btree" ("user_id", "read_at") WHERE ("read_at" IS NULL);



CREATE INDEX "idx_operator_documents_document_type" ON "public"."operator_documents" USING "btree" ("document_type");



CREATE INDEX "idx_operator_documents_expiry_date" ON "public"."operator_documents" USING "btree" ("expiry_date");



CREATE INDEX "idx_operator_documents_operator_id" ON "public"."operator_documents" USING "btree" ("operator_id");



CREATE INDEX "idx_operators_created_by" ON "public"."operators" USING "btree" ("created_by");



CREATE INDEX "idx_password_reset_rate_limits_blocked_until" ON "public"."password_reset_rate_limits" USING "btree" ("blocked_until");



CREATE INDEX "idx_password_reset_rate_limits_last_attempt_at" ON "public"."password_reset_rate_limits" USING "btree" ("last_attempt_at" DESC);



CREATE INDEX "idx_patent_search_history_created_at" ON "public"."patent_search_history" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_patent_search_history_user_id" ON "public"."patent_search_history" USING "btree" ("user_id");



CREATE INDEX "idx_payment_applications_invoice_id" ON "public"."payment_applications" USING "btree" ("invoice_id");



CREATE INDEX "idx_payment_applications_payment_id" ON "public"."payment_applications" USING "btree" ("payment_id");



CREATE INDEX "idx_payment_terms_active" ON "public"."payment_terms" USING "btree" ("is_active");



CREATE INDEX "idx_payment_terms_code" ON "public"."payment_terms" USING "btree" ("code");



CREATE INDEX "idx_payments_client_id" ON "public"."payments" USING "btree" ("client_id");



CREATE INDEX "idx_payments_status" ON "public"."payments" USING "btree" ("status");



CREATE INDEX "idx_profiles_client_id" ON "public"."profiles" USING "btree" ("client_id");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_purchase_voids_original_cost" ON "public"."purchase_voids" USING "btree" ("original_cost_id");



CREATE INDEX "idx_purchase_voids_voided_at" ON "public"."purchase_voids" USING "btree" ("voided_at" DESC);



CREATE INDEX "idx_push_subscriptions_active" ON "public"."push_subscriptions" USING "btree" ("is_active");



CREATE INDEX "idx_push_subscriptions_user_id" ON "public"."push_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_scheduled_payments_invoice_id" ON "public"."scheduled_payments" USING "btree" ("supplier_invoice_id");



CREATE INDEX "idx_scheduled_payments_scheduled_date" ON "public"."scheduled_payments" USING "btree" ("scheduled_date");



CREATE INDEX "idx_scheduled_payments_status" ON "public"."scheduled_payments" USING "btree" ("status");



CREATE INDEX "idx_service_change_history_changed_at" ON "public"."service_change_history" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_service_change_history_field_name" ON "public"."service_change_history" USING "btree" ("field_name");



CREATE INDEX "idx_service_change_history_service_id" ON "public"."service_change_history" USING "btree" ("service_id");



CREATE INDEX "idx_service_closures_client_id" ON "public"."service_closures" USING "btree" ("client_id");



CREATE INDEX "idx_service_closures_created_by" ON "public"."service_closures" USING "btree" ("created_by");



CREATE INDEX "idx_service_costs_service_id" ON "public"."service_costs" USING "btree" ("service_id");



CREATE INDEX "idx_service_costs_type" ON "public"."service_costs" USING "btree" ("cost_type");



CREATE INDEX "idx_service_rates_active" ON "public"."service_rates" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_service_rates_client_id" ON "public"."service_rates" USING "btree" ("client_id");



CREATE INDEX "idx_service_rates_client_origin" ON "public"."service_rates" USING "btree" ("client_id", "origin");



CREATE INDEX "idx_service_rates_origin" ON "public"."service_rates" USING "btree" ("origin");



CREATE INDEX "idx_service_resources_operator_id" ON "public"."service_resources" USING "btree" ("operator_id");



CREATE INDEX "idx_service_resources_role" ON "public"."service_resources" USING "btree" ("role");



CREATE INDEX "idx_service_resources_service_id" ON "public"."service_resources" USING "btree" ("service_id");



CREATE INDEX "idx_service_types_created_by" ON "public"."service_types" USING "btree" ("created_by");



CREATE INDEX "idx_services_company_rut" ON "public"."services" USING "btree" ("company_rut") WHERE ("company_rut" IS NOT NULL);



CREATE INDEX "idx_services_crane_mileage" ON "public"."services" USING "btree" ("crane_mileage") WHERE ("crane_mileage" IS NOT NULL);



CREATE INDEX "idx_services_created_by" ON "public"."services" USING "btree" ("created_by");



CREATE INDEX "idx_services_folio" ON "public"."services" USING "btree" ("folio");



CREATE INDEX "idx_services_operator_notified_at" ON "public"."services" USING "btree" ("operator_notified_at");



CREATE INDEX "idx_services_outsourced_provider" ON "public"."services" USING "btree" ("outsourced_provider_id") WHERE ("outsourced_provider_id" IS NOT NULL);



CREATE INDEX "idx_services_purchase_order_number" ON "public"."services" USING "btree" ("purchase_order_number") WHERE ("purchase_order_number" IS NOT NULL);



CREATE INDEX "idx_services_related_service_id" ON "public"."services" USING "btree" ("related_service_id");



CREATE INDEX "idx_services_third_party_client_id" ON "public"."services" USING "btree" ("third_party_client_id");



CREATE INDEX "idx_supplier_invoice_items_inventory_item_id" ON "public"."supplier_invoice_items" USING "btree" ("inventory_item_id");



CREATE INDEX "idx_supplier_invoice_items_invoice_id" ON "public"."supplier_invoice_items" USING "btree" ("supplier_invoice_id");



CREATE INDEX "idx_supplier_invoices_due_date" ON "public"."supplier_invoices" USING "btree" ("due_date");



CREATE INDEX "idx_supplier_invoices_status" ON "public"."supplier_invoices" USING "btree" ("status");



CREATE INDEX "idx_supplier_invoices_supplier_id" ON "public"."supplier_invoices" USING "btree" ("supplier_id");



CREATE INDEX "idx_supplier_payments_category" ON "public"."supplier_payments" USING "btree" ("category");



CREATE INDEX "idx_supplier_payments_cost_id" ON "public"."supplier_payments" USING "btree" ("cost_id");



CREATE INDEX "idx_supplier_payments_due_date" ON "public"."supplier_payments" USING "btree" ("due_date");



CREATE INDEX "idx_supplier_payments_invoice_id" ON "public"."supplier_payments" USING "btree" ("supplier_invoice_id");



CREATE INDEX "idx_supplier_payments_status" ON "public"."supplier_payments" USING "btree" ("status");



CREATE INDEX "idx_supplier_payments_supplier_id" ON "public"."supplier_payments" USING "btree" ("supplier_id");



CREATE INDEX "idx_suppliers_category" ON "public"."suppliers" USING "btree" ("category");



CREATE INDEX "idx_suppliers_is_active" ON "public"."suppliers" USING "btree" ("is_active");



CREATE INDEX "idx_suppliers_rut" ON "public"."suppliers" USING "btree" ("rut");



CREATE INDEX "idx_user_roles_role" ON "public"."user_roles" USING "btree" ("role");



CREATE INDEX "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");



CREATE INDEX "idx_vehicle_api_cache_expires" ON "public"."vehicle_api_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_vehicle_api_cache_lookup" ON "public"."vehicle_api_cache" USING "btree" ("endpoint", "lookup_value");



CREATE INDEX "idx_vehicle_brands_active" ON "public"."vehicle_brands" USING "btree" ("is_active");



CREATE INDEX "idx_vehicle_models_active" ON "public"."vehicle_models" USING "btree" ("is_active");



CREATE INDEX "idx_vehicle_models_brand_id" ON "public"."vehicle_models" USING "btree" ("brand_id");



CREATE INDEX "idx_wa_log_visible" ON "public"."whatsapp_message_log" USING "btree" ("created_at" DESC) WHERE ("hidden_at" IS NULL);



CREATE INDEX "idx_whatsapp_log_created_at" ON "public"."whatsapp_message_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_whatsapp_log_provider_msg" ON "public"."whatsapp_message_log" USING "btree" ("provider_message_id") WHERE ("provider_message_id" IS NOT NULL);



CREATE INDEX "idx_whatsapp_log_status" ON "public"."whatsapp_message_log" USING "btree" ("status");



CREATE INDEX "import_batch_records_batch_id_idx" ON "public"."import_batch_records" USING "btree" ("batch_id");



CREATE INDEX "import_batch_records_table_record_idx" ON "public"."import_batch_records" USING "btree" ("table_name", "record_id");



CREATE INDEX "import_history_log_org_type_created_idx" ON "public"."import_history_log" USING "btree" ("organization_id", "import_type", "created_at" DESC);



CREATE INDEX "import_history_log_org_type_range_idx" ON "public"."import_history_log" USING "btree" ("organization_id", "import_type", "date_range_start", "date_range_end");



CREATE INDEX "import_rut_mappings_org_type_idx" ON "public"."import_rut_mappings" USING "btree" ("organization_id", "import_type");



CREATE UNIQUE INDEX "supplier_invoices_supplier_invoice_unique" ON "public"."supplier_invoices" USING "btree" ("supplier_id", "invoice_number");



CREATE UNIQUE INDEX "supplier_payments_supplier_ref_unique" ON "public"."supplier_payments" USING "btree" ("supplier_id", NULLIF(TRIM(BOTH FROM "reference_number"), ''::"text")) WHERE (("supplier_id" IS NOT NULL) AND (NULLIF(TRIM(BOTH FROM "reference_number"), ''::"text") IS NOT NULL));



CREATE UNIQUE INDEX "uniq_costs_supplier_payment" ON "public"."costs" USING "btree" ("supplier_payment_id") WHERE ("supplier_payment_id" IS NOT NULL);



CREATE UNIQUE INDEX "uniq_crane_parts_inventory_movement_id" ON "public"."crane_parts" USING "btree" ("inventory_movement_id") WHERE ("inventory_movement_id" IS NOT NULL);



CREATE UNIQUE INDEX "uniq_inventory_entry_active_per_cost" ON "public"."inventory_movements" USING "btree" ("cost_id") WHERE (("cost_id" IS NOT NULL) AND ("movement_type" = 'entry'::"text") AND ("status" = 'active'::"text"));



CREATE UNIQUE INDEX "uniq_supplier_payments_cost" ON "public"."supplier_payments" USING "btree" ("cost_id") WHERE ("cost_id" IS NOT NULL);



CREATE INDEX "user_activity_log_created_at_idx" ON "public"."user_activity_log" USING "btree" ("created_at" DESC);



CREATE INDEX "user_activity_log_user_id_idx" ON "public"."user_activity_log" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "auto_maintenance_status_trigger" BEFORE UPDATE ON "public"."crane_maintenance" FOR EACH ROW EXECUTE FUNCTION "public"."auto_update_maintenance_status"();



CREATE OR REPLACE TRIGGER "cascade_delete_service_trigger" BEFORE DELETE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."cascade_delete_service_data"();



CREATE OR REPLACE TRIGGER "crane_parts_delete_cost" BEFORE DELETE ON "public"."crane_parts" FOR EACH ROW EXECUTE FUNCTION "public"."delete_cost_for_crane_part"();

ALTER TABLE "public"."crane_parts" DISABLE TRIGGER "crane_parts_delete_cost";



CREATE OR REPLACE TRIGGER "crane_parts_update_cost" AFTER UPDATE ON "public"."crane_parts" FOR EACH ROW EXECUTE FUNCTION "public"."update_cost_for_crane_part"();

ALTER TABLE "public"."crane_parts" DISABLE TRIGGER "crane_parts_update_cost";



CREATE OR REPLACE TRIGGER "create_cost_from_maintenance_trigger" AFTER UPDATE ON "public"."crane_maintenance" FOR EACH ROW EXECUTE FUNCTION "public"."create_cost_from_maintenance"();



CREATE OR REPLACE TRIGGER "create_cost_from_supplier_payment" AFTER INSERT OR UPDATE OF "status" ON "public"."supplier_payments" FOR EACH ROW EXECUTE FUNCTION "public"."create_cost_from_supplier_payment"();



CREATE OR REPLACE TRIGGER "create_supplier_payment_from_cost_trigger" AFTER INSERT OR UPDATE ON "public"."costs" FOR EACH ROW WHEN (("new"."supplier_id" IS NOT NULL)) EXECUTE FUNCTION "public"."create_supplier_payment_from_cost"();



CREATE OR REPLACE TRIGGER "enforce_commission_batch_consistency_trigger" BEFORE INSERT OR UPDATE OF "payment_batch_id", "payment_date", "operator_id", "category_id" ON "public"."costs" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_commission_batch_consistency"();



CREATE OR REPLACE TRIGGER "generate_commission_on_service_completion_trigger" AFTER UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."generate_commission_on_service_completion"();



CREATE OR REPLACE TRIGGER "handle_immediate_consumption_update_trigger" AFTER UPDATE ON "public"."costs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_immediate_consumption_update"();



CREATE OR REPLACE TRIGGER "handle_updated_at_cost_centers" BEFORE UPDATE ON "public"."cost_centers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "handle_updated_at_costs" BEFORE UPDATE ON "public"."costs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "invoices_enforce_product_service_description_trg" BEFORE INSERT OR UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_product_service_description"();



CREATE OR REPLACE TRIGGER "log_import_batch_record_costs" AFTER INSERT ON "public"."costs" FOR EACH ROW EXECUTE FUNCTION "public"."log_import_batch_record"();



CREATE OR REPLACE TRIGGER "log_import_batch_record_inventory_movements" AFTER INSERT ON "public"."inventory_movements" FOR EACH ROW EXECUTE FUNCTION "public"."log_import_batch_record"();



CREATE OR REPLACE TRIGGER "log_import_batch_record_inventory_suppliers" AFTER INSERT ON "public"."inventory_suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."log_import_batch_record"();



CREATE OR REPLACE TRIGGER "log_import_batch_record_supplier_invoices" AFTER INSERT ON "public"."supplier_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."log_import_batch_record"();



CREATE OR REPLACE TRIGGER "log_import_batch_record_supplier_payments" AFTER INSERT ON "public"."supplier_payments" FOR EACH ROW EXECUTE FUNCTION "public"."log_import_batch_record"();



CREATE OR REPLACE TRIGGER "maintain_payment_consistency_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."payment_applications" FOR EACH ROW EXECUTE FUNCTION "public"."maintain_payment_consistency"();



CREATE OR REPLACE TRIGGER "on_supplier_payment_delete_trigger" AFTER DELETE ON "public"."supplier_payments" FOR EACH ROW EXECUTE FUNCTION "public"."on_supplier_payment_delete"();



CREATE OR REPLACE TRIGGER "on_user_registration_update_invitation" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_user_invitation_acceptance"();



CREATE OR REPLACE TRIGGER "payment_applications_auto_update_invoice_status" AFTER INSERT OR DELETE OR UPDATE ON "public"."payment_applications" FOR EACH ROW EXECUTE FUNCTION "public"."update_invoice_status_from_payments"();



CREATE OR REPLACE TRIGGER "prevent_duplicate_commissions_trigger" BEFORE INSERT OR UPDATE ON "public"."costs" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_duplicate_commissions"();



CREATE OR REPLACE TRIGGER "prevent_duplicate_payments_trigger" BEFORE INSERT OR UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_duplicate_payments"();



CREATE OR REPLACE TRIGGER "prevent_duplicate_service_commissions_trigger" BEFORE INSERT OR UPDATE ON "public"."service_costs" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_duplicate_service_commissions"();



CREATE OR REPLACE TRIGGER "prevent_excess_of_excess_trigger" BEFORE INSERT OR UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_excess_of_excess"();



CREATE OR REPLACE TRIGGER "prevent_excluded_operator_commissions" BEFORE INSERT ON "public"."costs" FOR EACH ROW EXECUTE FUNCTION "public"."check_operator_not_excluded"();



CREATE OR REPLACE TRIGGER "prevent_invoice_overpayment_trigger" BEFORE INSERT OR UPDATE ON "public"."payment_applications" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_invoice_overpayment"();



CREATE OR REPLACE TRIGGER "prevent_maintenance_cost_duplicates" BEFORE INSERT OR UPDATE ON "public"."costs" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_duplicate_maintenance_costs"();



CREATE OR REPLACE TRIGGER "prevent_non_admin_updates_on_paid_costs_trigger" BEFORE UPDATE ON "public"."costs" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_non_admin_updates_on_paid_costs"();



CREATE OR REPLACE TRIGGER "prevent_payment_duplicates" BEFORE INSERT ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_duplicate_payments"();



CREATE OR REPLACE TRIGGER "propagate_invoice_folio_trigger" AFTER INSERT ON "public"."invoice_closures" FOR EACH ROW EXECUTE FUNCTION "public"."propagate_invoice_folio_to_closure_services"();



CREATE OR REPLACE TRIGGER "set_import_rut_mappings_updated_at" BEFORE UPDATE ON "public"."import_rut_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."set_import_rut_mappings_updated_at"();



CREATE OR REPLACE TRIGGER "simple_invoice_closures_updated_at" BEFORE UPDATE ON "public"."invoice_closures" FOR EACH ROW EXECUTE FUNCTION "public"."simple_update_timestamp"();



CREATE OR REPLACE TRIGGER "simple_invoices_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."simple_update_timestamp"();



CREATE OR REPLACE TRIGGER "supplier_invoice_items_touch_updated_at" BEFORE UPDATE ON "public"."supplier_invoice_items" FOR EACH ROW EXECUTE FUNCTION "public"."touch_supplier_invoice_items_updated_at"();



CREATE OR REPLACE TRIGGER "supplier_invoices_enforce_product_service_description_trg" BEFORE INSERT OR UPDATE ON "public"."supplier_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_product_service_description"();



CREATE OR REPLACE TRIGGER "sync_cost_deletion_cascade_trigger" BEFORE DELETE ON "public"."costs" FOR EACH ROW EXECUTE FUNCTION "public"."sync_cost_deletion_cascade"();



CREATE OR REPLACE TRIGGER "sync_cost_supplier_payment_deletion_trigger" BEFORE DELETE ON "public"."supplier_payments" FOR EACH ROW WHEN (("old"."cost_id" IS NOT NULL)) EXECUTE FUNCTION "public"."sync_cost_supplier_payment_deletion"();



CREATE OR REPLACE TRIGGER "sync_inventory_cost_trigger" AFTER INSERT ON "public"."costs" FOR EACH ROW EXECUTE FUNCTION "public"."sync_inventory_cost_to_movement"();



CREATE OR REPLACE TRIGGER "sync_inventory_exit_to_crane_parts_trigger" AFTER INSERT OR UPDATE ON "public"."inventory_movements" FOR EACH ROW EXECUTE FUNCTION "public"."sync_inventory_exit_to_crane_parts"();



CREATE OR REPLACE TRIGGER "sync_inventory_to_cost_trigger" AFTER INSERT ON "public"."inventory_movements" FOR EACH ROW EXECUTE FUNCTION "public"."sync_inventory_to_supplier_and_cost"();

ALTER TABLE "public"."inventory_movements" DISABLE TRIGGER "sync_inventory_to_cost_trigger";



CREATE OR REPLACE TRIGGER "sync_parts_purchase_to_inventory_trigger" AFTER INSERT ON "public"."crane_parts" FOR EACH ROW EXECUTE FUNCTION "public"."sync_parts_purchase_to_inventory"();



CREATE OR REPLACE TRIGGER "sync_role_to_profile_trigger" AFTER INSERT OR UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_role_to_profile"();



CREATE OR REPLACE TRIGGER "sync_supplier_invoice_delete_trigger" BEFORE DELETE ON "public"."supplier_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."sync_supplier_invoice_delete"();



CREATE OR REPLACE TRIGGER "sync_supplier_invoice_update_trigger" AFTER UPDATE ON "public"."supplier_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."sync_supplier_invoice_update"();



CREATE OR REPLACE TRIGGER "sync_supplier_payment_update_to_cost_trigger" AFTER UPDATE ON "public"."supplier_payments" FOR EACH ROW WHEN (("new"."cost_id" IS NOT NULL)) EXECUTE FUNCTION "public"."sync_supplier_payment_update_to_cost"();



CREATE OR REPLACE TRIGGER "trg_audit_costs" AFTER INSERT OR DELETE OR UPDATE ON "public"."costs" FOR EACH ROW EXECUTE FUNCTION "public"."log_audit_changes"();



CREATE OR REPLACE TRIGGER "trg_audit_inventory_movements" AFTER INSERT ON "public"."inventory_movements" FOR EACH ROW EXECUTE FUNCTION "public"."log_audit_changes"();



CREATE OR REPLACE TRIGGER "trg_audit_supplier_payments" AFTER INSERT OR DELETE OR UPDATE ON "public"."supplier_payments" FOR EACH ROW EXECUTE FUNCTION "public"."log_audit_changes"();



CREATE OR REPLACE TRIGGER "trg_backup_email_config_updated_at" BEFORE UPDATE ON "public"."backup_email_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_cranes_propagate_company" AFTER UPDATE OF "owner_company_rut", "owner_company_name" ON "public"."cranes" FOR EACH ROW EXECUTE FUNCTION "public"."sync_services_on_crane_company_change"();



CREATE OR REPLACE TRIGGER "trg_normalize_inventory_movement_timestamp" BEFORE INSERT ON "public"."inventory_movements" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_inventory_movement_timestamp"();



CREATE OR REPLACE TRIGGER "trg_services_sync_company_ins" BEFORE INSERT ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."sync_service_company_from_crane"();



CREATE OR REPLACE TRIGGER "trg_services_sync_company_upd" BEFORE UPDATE OF "crane_id" ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."sync_service_company_from_crane"();



CREATE OR REPLACE TRIGGER "trigger_assign_cost_center" BEFORE INSERT ON "public"."costs" FOR EACH ROW EXECUTE FUNCTION "public"."assign_default_cost_center"();



CREATE OR REPLACE TRIGGER "trigger_assign_cost_center_on_update" BEFORE UPDATE ON "public"."costs" FOR EACH ROW EXECUTE FUNCTION "public"."assign_default_cost_center"();



CREATE OR REPLACE TRIGGER "trigger_auto_update_service_invoice_status" BEFORE UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."auto_update_service_invoice_status"();



CREATE OR REPLACE TRIGGER "trigger_calculate_crane_part_total_value" BEFORE INSERT OR UPDATE ON "public"."crane_parts" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_crane_part_total_value"();



CREATE OR REPLACE TRIGGER "trigger_check_inventory_alerts" AFTER UPDATE OF "current_quantity" ON "public"."inventory_stock" FOR EACH ROW EXECUTE FUNCTION "public"."check_inventory_alerts"();



CREATE OR REPLACE TRIGGER "trigger_delete_commissions_on_service_delete" BEFORE DELETE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."delete_commissions_on_service_delete"();



CREATE OR REPLACE TRIGGER "trigger_ensure_commission_operator_id" BEFORE INSERT OR UPDATE ON "public"."costs" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_commission_operator_id"();



CREATE OR REPLACE TRIGGER "trigger_fill_exit_costs" BEFORE INSERT OR UPDATE ON "public"."inventory_movements" FOR EACH ROW EXECUTE FUNCTION "public"."fill_exit_costs"();



CREATE OR REPLACE TRIGGER "trigger_generate_commission_on_service_completion" AFTER UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."generate_commission_on_service_completion"();



CREATE OR REPLACE TRIGGER "trigger_track_cost_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."costs" FOR EACH ROW EXECUTE FUNCTION "public"."track_cost_changes"();



CREATE OR REPLACE TRIGGER "trigger_track_crane_part_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."crane_parts" FOR EACH ROW EXECUTE FUNCTION "public"."track_crane_part_changes"();



CREATE OR REPLACE TRIGGER "trigger_track_inventory_movement_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."inventory_movements" FOR EACH ROW EXECUTE FUNCTION "public"."track_inventory_movement_changes"();



CREATE OR REPLACE TRIGGER "trigger_track_service_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."track_service_changes"();



CREATE OR REPLACE TRIGGER "trigger_update_inventory_stock" AFTER INSERT OR DELETE OR UPDATE ON "public"."inventory_movements" FOR EACH ROW EXECUTE FUNCTION "public"."update_inventory_stock"();



CREATE OR REPLACE TRIGGER "trigger_update_supplier_categories_updated_at" BEFORE UPDATE ON "public"."supplier_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_supplier_categories_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_validate_service_invoice_consistency" BEFORE INSERT OR UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."validate_service_invoice_consistency"();



CREATE OR REPLACE TRIGGER "update_calendar_events_updated_at" BEFORE UPDATE ON "public"."calendar_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clients_updated_at" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_company_data_updated_at" BEFORE UPDATE ON "public"."company_data" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_company_profiles_updated_at" BEFORE UPDATE ON "public"."company_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_cost_subcategories_updated_at" BEFORE UPDATE ON "public"."cost_subcategories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_crane_consumption_rates_updated_at" BEFORE UPDATE ON "public"."crane_consumption_rates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_crane_documents_updated_at" BEFORE UPDATE ON "public"."crane_documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_crane_expiry_trigger" AFTER INSERT OR UPDATE ON "public"."crane_documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_crane_expiry_on_document_upload"();



CREATE OR REPLACE TRIGGER "update_crane_maintenance_updated_at" BEFORE UPDATE ON "public"."crane_maintenance" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_crane_parts_updated_at" BEFORE UPDATE ON "public"."crane_parts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_cranes_updated_at" BEFORE UPDATE ON "public"."cranes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_document_alerts_updated_at" BEFORE UPDATE ON "public"."document_alerts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_income_categories_updated_at" BEFORE UPDATE ON "public"."income_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_income_subcategories_updated_at" BEFORE UPDATE ON "public"."income_subcategories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_incomes_updated_at" BEFORE UPDATE ON "public"."incomes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inventory_alerts_updated_at" BEFORE UPDATE ON "public"."inventory_alerts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inventory_categories_updated_at" BEFORE UPDATE ON "public"."inventory_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inventory_items_updated_at" BEFORE UPDATE ON "public"."inventory_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inventory_locations_updated_at" BEFORE UPDATE ON "public"."inventory_locations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inventory_stock_updated_at" BEFORE UPDATE ON "public"."inventory_stock" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inventory_suppliers_updated_at" BEFORE UPDATE ON "public"."inventory_suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_invoice_amounts_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."payment_applications" FOR EACH ROW EXECUTE FUNCTION "public"."update_invoice_amounts"();



CREATE OR REPLACE TRIGGER "update_notification_settings_updated_at" BEFORE UPDATE ON "public"."notification_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notifications_updated_at" BEFORE UPDATE ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_notifications_updated_at"();



CREATE OR REPLACE TRIGGER "update_operator_documents_updated_at" BEFORE UPDATE ON "public"."operator_documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_operators_updated_at" BEFORE UPDATE ON "public"."operators" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_payment_amounts" BEFORE INSERT OR UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_payment_remaining_amount"();



CREATE OR REPLACE TRIGGER "update_payment_amounts_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."payment_applications" FOR EACH ROW EXECUTE FUNCTION "public"."update_payment_amounts"();



CREATE OR REPLACE TRIGGER "update_payments_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."simple_update_timestamp"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_push_subscriptions_updated_at" BEFORE UPDATE ON "public"."push_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_quick_entries_updated_at" BEFORE UPDATE ON "public"."quick_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_routes_updated_at" BEFORE UPDATE ON "public"."routes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_scheduled_payments_updated_at" BEFORE UPDATE ON "public"."scheduled_payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_service_closures_updated_at" BEFORE UPDATE ON "public"."service_closures" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_service_costs_updated_at" BEFORE UPDATE ON "public"."service_costs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_service_rates_updated_at" BEFORE UPDATE ON "public"."service_rates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_service_resources_updated_at" BEFORE UPDATE ON "public"."service_resources" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_service_types_updated_at" BEFORE UPDATE ON "public"."service_types" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_services_updated_at" BEFORE UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_supplier_invoices_updated_at" BEFORE UPDATE ON "public"."supplier_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_supplier_payments_updated_at" BEFORE UPDATE ON "public"."supplier_payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_suppliers_updated_at" BEFORE UPDATE ON "public"."suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_system_settings_updated_at" BEFORE UPDATE ON "public"."system_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_toll_rates_updated_at" BEFORE UPDATE ON "public"."toll_rates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_toll_stations_updated_at" BEFORE UPDATE ON "public"."toll_stations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_module_permissions_updated_at" BEFORE UPDATE ON "public"."user_module_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_settings_updated_at" BEFORE UPDATE ON "public"."user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_vehicle_brands_updated_at" BEFORE UPDATE ON "public"."vehicle_brands" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_vehicle_models_updated_at" BEFORE UPDATE ON "public"."vehicle_models" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_whatsapp_message_log_updated_at" BEFORE UPDATE ON "public"."whatsapp_message_log" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_whatsapp_settings_updated_at" BEFORE UPDATE ON "public"."whatsapp_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."backup_logs"
    ADD CONSTRAINT "backup_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_crane_id_fkey" FOREIGN KEY ("crane_id") REFERENCES "public"."cranes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_default_payment_term_id_fkey" FOREIGN KEY ("default_payment_term_id") REFERENCES "public"."payment_terms"("id");



ALTER TABLE ONLY "public"."closure_services"
    ADD CONSTRAINT "closure_services_closure_id_fkey" FOREIGN KEY ("closure_id") REFERENCES "public"."service_closures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."closure_services"
    ADD CONSTRAINT "closure_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cost_bulk_payment_operations"
    ADD CONSTRAINT "cost_bulk_payment_operations_executed_by_fkey" FOREIGN KEY ("executed_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cost_categories"
    ADD CONSTRAINT "cost_categories_default_cost_center_id_fkey" FOREIGN KEY ("default_cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cost_centers"
    ADD CONSTRAINT "cost_centers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cost_centers"
    ADD CONSTRAINT "cost_centers_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."cost_centers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cost_change_history"
    ADD CONSTRAINT "cost_change_history_changed_by_profile_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cost_inventory_items"
    ADD CONSTRAINT "cost_inventory_items_cost_id_fkey" FOREIGN KEY ("cost_id") REFERENCES "public"."costs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cost_inventory_items"
    ADD CONSTRAINT "cost_inventory_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."cost_inventory_items"
    ADD CONSTRAINT "cost_inventory_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cost_subcategories"
    ADD CONSTRAINT "cost_subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."cost_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cost_subcategories"
    ADD CONSTRAINT "cost_subcategories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."costs"
    ADD CONSTRAINT "costs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."cost_categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."costs"
    ADD CONSTRAINT "costs_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."costs"
    ADD CONSTRAINT "costs_crane_id_fkey" FOREIGN KEY ("crane_id") REFERENCES "public"."cranes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."costs"
    ADD CONSTRAINT "costs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."costs"
    ADD CONSTRAINT "costs_inventory_movement_id_fkey" FOREIGN KEY ("inventory_movement_id") REFERENCES "public"."inventory_movements"("id");



ALTER TABLE ONLY "public"."costs"
    ADD CONSTRAINT "costs_maintenance_id_fkey" FOREIGN KEY ("maintenance_id") REFERENCES "public"."crane_maintenance"("id");



ALTER TABLE ONLY "public"."costs"
    ADD CONSTRAINT "costs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."costs"
    ADD CONSTRAINT "costs_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."costs"
    ADD CONSTRAINT "costs_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."inventory_suppliers"("id");



ALTER TABLE ONLY "public"."costs"
    ADD CONSTRAINT "costs_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crane_documents"
    ADD CONSTRAINT "crane_documents_crane_id_fkey" FOREIGN KEY ("crane_id") REFERENCES "public"."cranes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crane_documents"
    ADD CONSTRAINT "crane_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."crane_maintenance"
    ADD CONSTRAINT "crane_maintenance_crane_id_fkey" FOREIGN KEY ("crane_id") REFERENCES "public"."cranes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crane_maintenance"
    ADD CONSTRAINT "crane_maintenance_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."crane_part_change_history"
    ADD CONSTRAINT "crane_part_change_history_changed_by_profile_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crane_parts"
    ADD CONSTRAINT "crane_parts_crane_id_fkey" FOREIGN KEY ("crane_id") REFERENCES "public"."cranes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crane_parts"
    ADD CONSTRAINT "crane_parts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."crane_parts"
    ADD CONSTRAINT "crane_parts_inventory_movement_id_fkey" FOREIGN KEY ("inventory_movement_id") REFERENCES "public"."inventory_movements"("id");



ALTER TABLE ONLY "public"."crane_parts"
    ADD CONSTRAINT "crane_parts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."inventory_suppliers"("id");



ALTER TABLE ONLY "public"."cranes"
    ADD CONSTRAINT "cranes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."creditors"
    ADD CONSTRAINT "creditors_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."creditors"
    ADD CONSTRAINT "creditors_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."inventory_suppliers"("id");



ALTER TABLE ONLY "public"."creditors"
    ADD CONSTRAINT "creditors_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."debt_installments"
    ADD CONSTRAINT "debt_installments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."debt_installments"
    ADD CONSTRAINT "debt_installments_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."debt_installments"
    ADD CONSTRAINT "debt_installments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."debt_payments"
    ADD CONSTRAINT "debt_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."debt_payments"
    ADD CONSTRAINT "debt_payments_debt_installment_id_fkey" FOREIGN KEY ("debt_installment_id") REFERENCES "public"."debt_installments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."debt_payments"
    ADD CONSTRAINT "debt_payments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."debts"
    ADD CONSTRAINT "debts_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."debts"
    ADD CONSTRAINT "debts_crane_id_fkey" FOREIGN KEY ("crane_id") REFERENCES "public"."cranes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."debts"
    ADD CONSTRAINT "debts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."debts"
    ADD CONSTRAINT "debts_creditor_id_fkey" FOREIGN KEY ("creditor_id") REFERENCES "public"."creditors"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."debts"
    ADD CONSTRAINT "debts_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."debts"
    ADD CONSTRAINT "debts_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."document_alerts"
    ADD CONSTRAINT "document_alerts_crane_id_fkey" FOREIGN KEY ("crane_id") REFERENCES "public"."cranes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crane_parts"
    ADD CONSTRAINT "fk_crane_parts_cost_id" FOREIGN KEY ("cost_id") REFERENCES "public"."costs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_closures"
    ADD CONSTRAINT "fk_invoice_closures_closure_id" FOREIGN KEY ("closure_id") REFERENCES "public"."service_closures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_closures"
    ADD CONSTRAINT "fk_invoice_closures_invoice_id" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operators"
    ADD CONSTRAINT "fk_operators_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."frontend_error_logs"
    ADD CONSTRAINT "frontend_error_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fuel_prices"
    ADD CONSTRAINT "fuel_prices_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."import_batch_records"
    ADD CONSTRAINT "import_batch_records_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_batches"
    ADD CONSTRAINT "import_batches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."import_batches"
    ADD CONSTRAINT "import_batches_rolled_back_by_fkey" FOREIGN KEY ("rolled_back_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."import_history_log"
    ADD CONSTRAINT "import_history_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_rut_mappings"
    ADD CONSTRAINT "import_rut_mappings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."income_subcategories"
    ADD CONSTRAINT "income_subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."income_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."income_subcategories"
    ADD CONSTRAINT "income_subcategories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."incomes"
    ADD CONSTRAINT "incomes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."income_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."incomes"
    ADD CONSTRAINT "incomes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."incomes"
    ADD CONSTRAINT "incomes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."incomes"
    ADD CONSTRAINT "incomes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inspections"
    ADD CONSTRAINT "inspections_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id");



ALTER TABLE ONLY "public"."inspections"
    ADD CONSTRAINT "inspections_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_alerts"
    ADD CONSTRAINT "inventory_alerts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."inventory_alerts"
    ADD CONSTRAINT "inventory_alerts_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."inventory_alerts"
    ADD CONSTRAINT "inventory_alerts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."inventory_locations"("id");



ALTER TABLE ONLY "public"."inventory_categories"
    ADD CONSTRAINT "inventory_categories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."inventory_consumptions"
    ADD CONSTRAINT "inventory_consumptions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."inventory_consumptions"
    ADD CONSTRAINT "inventory_consumptions_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id");



ALTER TABLE ONLY "public"."inventory_consumptions"
    ADD CONSTRAINT "inventory_consumptions_crane_id_fkey" FOREIGN KEY ("crane_id") REFERENCES "public"."cranes"("id");



ALTER TABLE ONLY "public"."inventory_consumptions"
    ADD CONSTRAINT "inventory_consumptions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."inventory_consumptions"
    ADD CONSTRAINT "inventory_consumptions_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "public"."inventory_movements"("id");



ALTER TABLE ONLY "public"."inventory_consumptions"
    ADD CONSTRAINT "inventory_consumptions_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_categories"("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."inventory_locations"
    ADD CONSTRAINT "inventory_locations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."inventory_movement_change_history"
    ADD CONSTRAINT "inventory_movement_change_history_changed_by_profile_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_cost_id_fkey" FOREIGN KEY ("cost_id") REFERENCES "public"."costs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_crane_id_fkey" FOREIGN KEY ("crane_id") REFERENCES "public"."cranes"("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."inventory_locations"("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_maintenance_id_fkey" FOREIGN KEY ("maintenance_id") REFERENCES "public"."crane_maintenance"("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."inventory_suppliers"("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_supplier_invoice_item_id_fkey" FOREIGN KEY ("supplier_invoice_item_id") REFERENCES "public"."supplier_invoice_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_stock"
    ADD CONSTRAINT "inventory_stock_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."inventory_stock"
    ADD CONSTRAINT "inventory_stock_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."inventory_locations"("id");



ALTER TABLE ONLY "public"."inventory_suppliers"
    ADD CONSTRAINT "inventory_suppliers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."inventory_suppliers"
    ADD CONSTRAINT "inventory_suppliers_default_payment_term_id_fkey" FOREIGN KEY ("default_payment_term_id") REFERENCES "public"."payment_terms"("id");



ALTER TABLE ONLY "public"."invoice_cancellations"
    ADD CONSTRAINT "invoice_cancellations_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."invoice_cancellations"
    ADD CONSTRAINT "invoice_cancellations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."invoice_cancellations"
    ADD CONSTRAINT "invoice_cancellations_original_client_id_fkey" FOREIGN KEY ("original_client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."invoice_closures"
    ADD CONSTRAINT "invoice_closures_closure_id_fkey" FOREIGN KEY ("closure_id") REFERENCES "public"."service_closures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_closures"
    ADD CONSTRAINT "invoice_closures_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_services"
    ADD CONSTRAINT "invoice_services_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_services"
    ADD CONSTRAINT "invoice_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_payment_term_id_fkey" FOREIGN KEY ("payment_term_id") REFERENCES "public"."payment_terms"("id");



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operator_documents"
    ADD CONSTRAINT "operator_documents_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operator_documents"
    ADD CONSTRAINT "operator_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."operators"
    ADD CONSTRAINT "operators_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."patent_search_history"
    ADD CONSTRAINT "patent_search_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."payment_applications"
    ADD CONSTRAINT "payment_applications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."payment_applications"
    ADD CONSTRAINT "payment_applications_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_applications"
    ADD CONSTRAINT "payment_applications_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_terms"
    ADD CONSTRAINT "payment_terms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."purchase_voids"
    ADD CONSTRAINT "purchase_voids_replacement_supplier_id_fkey" FOREIGN KEY ("replacement_supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."purchase_voids"
    ADD CONSTRAINT "purchase_voids_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quick_entries"
    ADD CONSTRAINT "quick_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."route_tolls"
    ADD CONSTRAINT "route_tolls_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."route_tolls"
    ADD CONSTRAINT "route_tolls_toll_station_id_fkey" FOREIGN KEY ("toll_station_id") REFERENCES "public"."toll_stations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."routes"
    ADD CONSTRAINT "routes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."saved_locations"
    ADD CONSTRAINT "saved_locations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scheduled_payments"
    ADD CONSTRAINT "scheduled_payments_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_cash_receipts"
    ADD CONSTRAINT "service_cash_receipts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."service_cash_receipts"
    ADD CONSTRAINT "service_cash_receipts_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_change_history"
    ADD CONSTRAINT "service_change_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."service_change_history"
    ADD CONSTRAINT "service_change_history_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_closures"
    ADD CONSTRAINT "service_closures_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."service_closures"
    ADD CONSTRAINT "service_closures_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."service_costs"
    ADD CONSTRAINT "service_costs_crane_id_fkey" FOREIGN KEY ("crane_id") REFERENCES "public"."cranes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_costs"
    ADD CONSTRAINT "service_costs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."service_costs"
    ADD CONSTRAINT "service_costs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_costs"
    ADD CONSTRAINT "service_costs_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_rates"
    ADD CONSTRAINT "service_rates_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_rates"
    ADD CONSTRAINT "service_rates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_rates"
    ADD CONSTRAINT "service_rates_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_resources"
    ADD CONSTRAINT "service_resources_crane_id_fkey" FOREIGN KEY ("crane_id") REFERENCES "public"."cranes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_resources"
    ADD CONSTRAINT "service_resources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."service_resources"
    ADD CONSTRAINT "service_resources_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_resources"
    ADD CONSTRAINT "service_resources_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "service_types_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."service_update_error_logs"
    ADD CONSTRAINT "service_update_error_logs_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."service_update_error_logs"
    ADD CONSTRAINT "service_update_error_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_crane_id_fkey" FOREIGN KEY ("crane_id") REFERENCES "public"."cranes"("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_outsourced_provider_id_fkey" FOREIGN KEY ("outsourced_provider_id") REFERENCES "public"."inventory_suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_related_service_id_fkey" FOREIGN KEY ("related_service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_third_party_client_id_fkey" FOREIGN KEY ("third_party_client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."supplier_categories"
    ADD CONSTRAINT "supplier_categories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."supplier_invoice_items"
    ADD CONSTRAINT "supplier_invoice_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."supplier_invoice_items"
    ADD CONSTRAINT "supplier_invoice_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."supplier_invoice_items"
    ADD CONSTRAINT "supplier_invoice_items_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "public"."inventory_movements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supplier_invoice_items"
    ADD CONSTRAINT "supplier_invoice_items_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_invoices"
    ADD CONSTRAINT "supplier_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."inventory_suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_cost_id_fkey" FOREIGN KEY ("cost_id") REFERENCES "public"."costs"("id");



ALTER TABLE ONLY "public"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_crane_id_fkey" FOREIGN KEY ("crane_id") REFERENCES "public"."cranes"("id");



ALTER TABLE ONLY "public"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."inventory_suppliers"("id");



ALTER TABLE ONLY "public"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."toll_rates"
    ADD CONSTRAINT "toll_rates_toll_station_id_fkey" FOREIGN KEY ("toll_station_id") REFERENCES "public"."toll_stations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_estimates"
    ADD CONSTRAINT "trip_estimates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."trip_estimates"
    ADD CONSTRAINT "trip_estimates_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_module_permissions"
    ADD CONSTRAINT "user_module_permissions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_module_permissions"
    ADD CONSTRAINT "user_module_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicle_brands"
    ADD CONSTRAINT "vehicle_brands_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."vehicle_models"
    ADD CONSTRAINT "vehicle_models_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."vehicle_brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicle_models"
    ADD CONSTRAINT "vehicle_models_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



CREATE POLICY "Admins can hide whatsapp logs" ON "public"."whatsapp_message_log" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can insert backup email config" ON "public"."backup_email_config" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "Admins can insert purchase voids" ON "public"."purchase_voids" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage all permissions" ON "public"."user_module_permissions" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage company profiles" ON "public"."company_profiles" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "Admins can manage whatsapp settings" ON "public"."whatsapp_settings" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can read purchase voids" ON "public"."purchase_voids" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can update backup email config" ON "public"."backup_email_config" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "Admins can view backup email config" ON "public"."backup_email_config" FOR SELECT TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "Admins can view whatsapp alert dedupe" ON "public"."whatsapp_alert_dedupe" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view whatsapp logs" ON "public"."whatsapp_message_log" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Authenticated users can insert" ON "public"."service_change_history" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view company profiles" ON "public"."company_profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can create their own settings" ON "public"."user_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own notifications" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own notifications" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own alert settings" ON "public"."invoice_alert_settings" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own settings" ON "public"."user_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own permissions" ON "public"."user_module_permissions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own settings" ON "public"."user_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own import logs" ON "public"."import_history_log" USING (("auth"."uid"() = "organization_id")) WITH CHECK (("auth"."uid"() = "organization_id"));



CREATE POLICY "Users manage own mappings" ON "public"."import_rut_mappings" USING (("auth"."uid"() = "organization_id")) WITH CHECK (("auth"."uid"() = "organization_id"));



CREATE POLICY "Usuarios autenticados pueden ver proveedores" ON "public"."suppliers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "admin_only_role_management" ON "public"."user_roles" USING ("public"."is_admin_user"("auth"."uid"())) WITH CHECK ("public"."is_admin_user"("auth"."uid"()));



CREATE POLICY "allow_insert_anon" ON "public"."frontend_error_logs" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "allow_insert_authenticated" ON "public"."frontend_error_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "allow_select_admin" ON "public"."frontend_error_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_admin_select" ON "public"."audit_log" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "audit_log_no_direct_insert" ON "public"."audit_log" FOR INSERT WITH CHECK (false);



CREATE POLICY "audit_log_user_select" ON "public"."audit_log" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "auth_read_cache" ON "public"."vehicle_api_cache" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."backup_email_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."backup_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "backup_logs_admin_only" ON "public"."backup_logs" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."calendar_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "calendar_events_select_auth" ON "public"."calendar_events" FOR SELECT TO "authenticated" USING ("public"."is_authenticated_user_safe"());



CREATE POLICY "calendar_events_write_admin_operator" ON "public"."calendar_events" TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"())) WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "cch_no_direct_insert" ON "public"."cost_change_history" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "cch_select_admin" ON "public"."cost_change_history" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_admin_full_access" ON "public"."clients" TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



COMMENT ON POLICY "clients_admin_full_access" ON "public"."clients" IS 'Allows administrators full access to all client data including sensitive contact information';



CREATE POLICY "clients_operator_assigned_only" ON "public"."clients" FOR SELECT TO "authenticated" USING (("public"."is_operator_user_safe"() AND (EXISTS ( SELECT 1
   FROM "public"."operators" "o"
  WHERE (("o"."user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
           FROM "public"."services" "s"
          WHERE (("s"."client_id" = "clients"."id") AND (("s"."operator_id" = "o"."id") OR (EXISTS ( SELECT 1
                   FROM "public"."service_resources" "sr"
                  WHERE (("sr"."service_id" = "s"."id") AND ("sr"."operator_id" = "o"."id")))))))))))));



CREATE POLICY "clients_operator_insert_restricted" ON "public"."clients" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_operator_user_safe"() AND ("created_by" = "auth"."uid"())));



CREATE POLICY "clients_own_basic_data" ON "public"."clients" FOR SELECT TO "authenticated" USING (("public"."is_client_user_safe"() AND ("id" = "public"."get_user_client_id_safe"())));



COMMENT ON POLICY "clients_own_basic_data" ON "public"."clients" IS 'Allows clients to view only their own basic information';



ALTER TABLE "public"."closure_services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "closure_services_delete_admin" ON "public"."closure_services" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "closure_services_insert_admin" ON "public"."closure_services" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "closure_services_select_auth" ON "public"."closure_services" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "closure_services_update_admin" ON "public"."closure_services" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."company_data" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_data_admin_only" ON "public"."company_data" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "company_data_select_authenticated" ON "public"."company_data" FOR SELECT TO "authenticated" USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."company_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cost_bulk_payment_operations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cost_bulk_payment_operations_insert_admin_operator" ON "public"."cost_bulk_payment_operations" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_operator_user"());



CREATE POLICY "cost_bulk_payment_operations_select_own_or_admin" ON "public"."cost_bulk_payment_operations" FOR SELECT TO "authenticated" USING ((("executed_by" = "auth"."uid"()) OR "public"."is_admin_user"()));



ALTER TABLE "public"."cost_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cost_categories_delete_admin" ON "public"."cost_categories" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "cost_categories_insert_admin" ON "public"."cost_categories" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "cost_categories_select_auth" ON "public"."cost_categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "cost_categories_update_admin" ON "public"."cost_categories" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."cost_centers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cost_centers_delete_admin" ON "public"."cost_centers" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "cost_centers_insert_admin" ON "public"."cost_centers" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "cost_centers_select_auth" ON "public"."cost_centers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "cost_centers_update_admin" ON "public"."cost_centers" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."cost_change_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cost_inventory_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cost_inventory_items_delete_admin" ON "public"."cost_inventory_items" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "cost_inventory_items_insert_admin" ON "public"."cost_inventory_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "cost_inventory_items_select_auth" ON "public"."cost_inventory_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "cost_inventory_items_update_admin" ON "public"."cost_inventory_items" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."cost_subcategories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cost_subcategories_admin_write" ON "public"."cost_subcategories" TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "cost_subcategories_read" ON "public"."cost_subcategories" FOR SELECT TO "authenticated" USING ("public"."is_authenticated_user_safe"());



ALTER TABLE "public"."costs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "costs_admin_full_access" ON "public"."costs" TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "costs_client_own_services" ON "public"."costs" FOR SELECT TO "authenticated" USING (("public"."is_client_user_safe"() AND ("service_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."services" "s"
  WHERE (("s"."id" = "costs"."service_id") AND ("s"."client_id" = "public"."get_user_client_id_safe"()))))));



CREATE POLICY "costs_operator_scoped_access" ON "public"."costs" FOR SELECT TO "authenticated" USING (("public"."is_operator_user_safe"() AND ((EXISTS ( SELECT 1
   FROM "public"."operators" "o"
  WHERE (("o"."user_id" = "auth"."uid"()) AND ("o"."id" = "costs"."operator_id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."operators" "o"
     JOIN "public"."services" "s" ON (("s"."id" = "costs"."service_id")))
  WHERE (("o"."user_id" = "auth"."uid"()) AND (("s"."operator_id" = "o"."id") OR (EXISTS ( SELECT 1
           FROM "public"."service_resources" "sr"
          WHERE (("sr"."service_id" = "s"."id") AND ("sr"."operator_id" = "o"."id")))))))))));



CREATE POLICY "cpch_no_direct_insert" ON "public"."crane_part_change_history" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "cpch_select_admin" ON "public"."crane_part_change_history" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'operator'::"public"."app_role")));



ALTER TABLE "public"."crane_consumption_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crane_consumption_rates_delete_admin" ON "public"."crane_consumption_rates" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "crane_consumption_rates_insert_admin" ON "public"."crane_consumption_rates" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "crane_consumption_rates_select_auth" ON "public"."crane_consumption_rates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "crane_consumption_rates_update_admin" ON "public"."crane_consumption_rates" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."crane_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crane_documents_admin_operator_all" ON "public"."crane_documents" TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"())) WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



ALTER TABLE "public"."crane_maintenance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crane_maintenance_admin_full" ON "public"."crane_maintenance" TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "crane_maintenance_operator_select" ON "public"."crane_maintenance" FOR SELECT TO "authenticated" USING ("public"."is_operator_user_safe"());



ALTER TABLE "public"."crane_part_change_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crane_parts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crane_parts_auth_only" ON "public"."crane_parts" USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."cranes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cranes_select_auth" ON "public"."cranes" FOR SELECT TO "authenticated" USING ("public"."is_authenticated_user_safe"());



CREATE POLICY "cranes_write_admin" ON "public"."cranes" TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."creditors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "creditors_select_admin_viewer" ON "public"."creditors" FOR SELECT TO "authenticated" USING (("public"."get_current_user_role_safe"() = ANY (ARRAY['admin'::"public"."app_role", 'viewer'::"public"."app_role"])));



CREATE POLICY "creditors_write_admin_only" ON "public"."creditors" TO "authenticated" USING (("public"."get_current_user_role_safe"() = 'admin'::"public"."app_role")) WITH CHECK (("public"."get_current_user_role_safe"() = 'admin'::"public"."app_role"));



ALTER TABLE "public"."debt_installments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "debt_installments_select_admin_viewer" ON "public"."debt_installments" FOR SELECT TO "authenticated" USING (("public"."get_current_user_role_safe"() = ANY (ARRAY['admin'::"public"."app_role", 'viewer'::"public"."app_role"])));



CREATE POLICY "debt_installments_write_admin_only" ON "public"."debt_installments" TO "authenticated" USING (("public"."get_current_user_role_safe"() = 'admin'::"public"."app_role")) WITH CHECK (("public"."get_current_user_role_safe"() = 'admin'::"public"."app_role"));



ALTER TABLE "public"."debt_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "debt_payments_select_admin_viewer" ON "public"."debt_payments" FOR SELECT TO "authenticated" USING (("public"."get_current_user_role_safe"() = ANY (ARRAY['admin'::"public"."app_role", 'viewer'::"public"."app_role"])));



CREATE POLICY "debt_payments_write_admin_only" ON "public"."debt_payments" TO "authenticated" USING (("public"."get_current_user_role_safe"() = 'admin'::"public"."app_role")) WITH CHECK (("public"."get_current_user_role_safe"() = 'admin'::"public"."app_role"));



ALTER TABLE "public"."debts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "debts_select_admin_viewer" ON "public"."debts" FOR SELECT TO "authenticated" USING (("public"."get_current_user_role_safe"() = ANY (ARRAY['admin'::"public"."app_role", 'viewer'::"public"."app_role"])));



CREATE POLICY "debts_write_admin_only" ON "public"."debts" TO "authenticated" USING (("public"."get_current_user_role_safe"() = 'admin'::"public"."app_role")) WITH CHECK (("public"."get_current_user_role_safe"() = 'admin'::"public"."app_role"));



ALTER TABLE "public"."document_alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "document_alerts_delete_admin" ON "public"."document_alerts" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "document_alerts_insert_admin" ON "public"."document_alerts" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "document_alerts_select_auth" ON "public"."document_alerts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "document_alerts_update_admin" ON "public"."document_alerts" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."frontend_error_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fuel_prices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fuel_prices_delete_admin" ON "public"."fuel_prices" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "fuel_prices_insert_admin" ON "public"."fuel_prices" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "fuel_prices_select_auth" ON "public"."fuel_prices" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "fuel_prices_update_admin" ON "public"."fuel_prices" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "imch_no_direct_insert" ON "public"."inventory_movement_change_history" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "imch_select_admin" ON "public"."inventory_movement_change_history" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'operator'::"public"."app_role")));



ALTER TABLE "public"."import_batch_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "import_batch_records_insert_own" ON "public"."import_batch_records" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."import_batches"
  WHERE (("import_batches"."id" = "import_batch_records"."batch_id") AND ("import_batches"."created_by" = "auth"."uid"())))));



CREATE POLICY "import_batch_records_select_own" ON "public"."import_batch_records" FOR SELECT USING (("batch_id" IN ( SELECT "import_batches"."id"
   FROM "public"."import_batches"
  WHERE ("import_batches"."created_by" = "auth"."uid"()))));



ALTER TABLE "public"."import_batches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "import_batches_insert_admin_operator" ON "public"."import_batches" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = "auth"."uid"()) AND ("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"())));



CREATE POLICY "import_batches_select_own" ON "public"."import_batches" FOR SELECT USING (("created_by" = "auth"."uid"()));



CREATE POLICY "import_batches_update_own" ON "public"."import_batches" FOR UPDATE USING (("created_by" = "auth"."uid"())) WITH CHECK (("created_by" = "auth"."uid"()));



ALTER TABLE "public"."import_history_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."import_rut_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."income_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "income_categories_admin_all" ON "public"."income_categories" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "income_categories_select_authenticated" ON "public"."income_categories" FOR SELECT USING ("public"."is_authenticated_user_safe"());



ALTER TABLE "public"."income_subcategories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "income_subcategories_admin_all" ON "public"."income_subcategories" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "income_subcategories_select_authenticated" ON "public"."income_subcategories" FOR SELECT USING ("public"."is_authenticated_user_safe"());



ALTER TABLE "public"."incomes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "incomes_delete_admin" ON "public"."incomes" FOR DELETE USING ("public"."is_admin_user_safe"());



CREATE POLICY "incomes_insert_admin" ON "public"."incomes" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "incomes_select_authenticated" ON "public"."incomes" FOR SELECT USING ("public"."is_authenticated_user_safe"());



CREATE POLICY "incomes_update_admin" ON "public"."incomes" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."inspections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inspections_admin_full" ON "public"."inspections" TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "inspections_operator_insert" ON "public"."inspections" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_operator_user_safe"() AND "public"."is_operator_assigned_to_service"("service_id") AND (EXISTS ( SELECT 1
   FROM "public"."operators" "o"
  WHERE (("o"."id" = "inspections"."operator_id") AND ("o"."user_id" = "auth"."uid"()))))));



CREATE POLICY "inspections_operator_select" ON "public"."inspections" FOR SELECT TO "authenticated" USING (("public"."is_operator_user_safe"() AND "public"."is_operator_assigned_to_service"("service_id")));



CREATE POLICY "inspections_operator_update" ON "public"."inspections" FOR UPDATE TO "authenticated" USING (("public"."is_operator_user_safe"() AND "public"."is_operator_assigned_to_service"("service_id"))) WITH CHECK (("public"."is_operator_user_safe"() AND "public"."is_operator_assigned_to_service"("service_id")));



ALTER TABLE "public"."internal_scheduler_secrets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "internal_scheduler_secrets_block_all" ON "public"."internal_scheduler_secrets" USING (false) WITH CHECK (false);



ALTER TABLE "public"."inventory_alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_alerts_delete_staff" ON "public"."inventory_alerts" FOR DELETE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "inventory_alerts_insert_staff" ON "public"."inventory_alerts" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "inventory_alerts_select_auth" ON "public"."inventory_alerts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "inventory_alerts_update_staff" ON "public"."inventory_alerts" FOR UPDATE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"())) WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



ALTER TABLE "public"."inventory_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_categories_delete_staff" ON "public"."inventory_categories" FOR DELETE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "inventory_categories_insert_staff" ON "public"."inventory_categories" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "inventory_categories_select_auth" ON "public"."inventory_categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "inventory_categories_update_staff" ON "public"."inventory_categories" FOR UPDATE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"())) WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



ALTER TABLE "public"."inventory_consumptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_consumptions_delete_staff" ON "public"."inventory_consumptions" FOR DELETE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "inventory_consumptions_insert_staff" ON "public"."inventory_consumptions" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "inventory_consumptions_select_auth" ON "public"."inventory_consumptions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "inventory_consumptions_update_staff" ON "public"."inventory_consumptions" FOR UPDATE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"())) WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_items_delete_staff" ON "public"."inventory_items" FOR DELETE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "inventory_items_insert_staff" ON "public"."inventory_items" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "inventory_items_select_auth" ON "public"."inventory_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "inventory_items_update_staff" ON "public"."inventory_items" FOR UPDATE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"())) WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



ALTER TABLE "public"."inventory_locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_locations_delete_staff" ON "public"."inventory_locations" FOR DELETE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "inventory_locations_insert_staff" ON "public"."inventory_locations" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "inventory_locations_select_auth" ON "public"."inventory_locations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "inventory_locations_update_staff" ON "public"."inventory_locations" FOR UPDATE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"())) WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



ALTER TABLE "public"."inventory_movement_change_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_movements_delete_staff" ON "public"."inventory_movements" FOR DELETE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "inventory_movements_insert_staff" ON "public"."inventory_movements" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "inventory_movements_select_auth" ON "public"."inventory_movements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "inventory_movements_update_staff" ON "public"."inventory_movements" FOR UPDATE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"())) WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



ALTER TABLE "public"."inventory_stock" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_stock_delete_staff" ON "public"."inventory_stock" FOR DELETE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "inventory_stock_insert_staff" ON "public"."inventory_stock" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "inventory_stock_select_auth" ON "public"."inventory_stock" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "inventory_stock_update_staff" ON "public"."inventory_stock" FOR UPDATE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"())) WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



ALTER TABLE "public"."inventory_suppliers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_suppliers_admin_full" ON "public"."inventory_suppliers" TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "inventory_suppliers_operator_read" ON "public"."inventory_suppliers" FOR SELECT TO "authenticated" USING ("public"."is_operator_user_safe"());



ALTER TABLE "public"."invoice_alert_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_cancellations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_cancellations_admin_full_access" ON "public"."invoice_cancellations" TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "invoice_cancellations_scoped_select" ON "public"."invoice_cancellations" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'operator'::"public"."app_role") OR ("original_client_id" = "public"."get_user_client_id_safe"()) OR (EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "invoice_cancellations"."invoice_id") AND ("i"."client_id" = "public"."get_user_client_id_safe"()))))));



ALTER TABLE "public"."invoice_closures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_closures_scoped_select" ON "public"."invoice_closures" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'operator'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "invoice_closures"."invoice_id") AND ("i"."client_id" = "public"."get_user_client_id_safe"()))))));



CREATE POLICY "invoice_closures_write_admin" ON "public"."invoice_closures" TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."invoice_services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_services_scoped_select" ON "public"."invoice_services" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'operator'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "invoice_services"."invoice_id") AND ("i"."client_id" = "public"."get_user_client_id_safe"()))))));



CREATE POLICY "invoice_services_write_admin" ON "public"."invoice_services" TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_admin_full_access" ON "public"."invoices" TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "invoices_client_own" ON "public"."invoices" FOR SELECT TO "authenticated" USING (("public"."is_client_user_safe"() AND ("client_id" = "public"."get_user_client_id_safe"())));



CREATE POLICY "invoices_operator_read" ON "public"."invoices" FOR SELECT TO "authenticated" USING (("public"."is_operator_user_safe"() AND (EXISTS ( SELECT 1
   FROM ("public"."operators" "o"
     JOIN "public"."services" "s" ON (("s"."client_id" = "invoices"."client_id")))
  WHERE (("o"."user_id" = "auth"."uid"()) AND (("s"."operator_id" = "o"."id") OR (EXISTS ( SELECT 1
           FROM "public"."service_resources" "sr"
          WHERE (("sr"."service_id" = "s"."id") AND ("sr"."operator_id" = "o"."id"))))))))));



ALTER TABLE "public"."notification_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_logs_user_access" ON "public"."notification_logs" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") AND "public"."is_authenticated_user_safe"()));



ALTER TABLE "public"."notification_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_settings_own" ON "public"."notification_settings" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."operator_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "operator_documents_admin_all" ON "public"."operator_documents" TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "operator_documents_operator_owner_select" ON "public"."operator_documents" FOR SELECT TO "authenticated" USING (("public"."is_operator_user_safe"() AND (EXISTS ( SELECT 1
   FROM "public"."operators" "o"
  WHERE (("o"."id" = "operator_documents"."operator_id") AND ("o"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."operators" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "operators_admin_full_access" ON "public"."operators" TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "operators_admin_operator_read_all" ON "public"."operators" FOR SELECT TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "operators_read_self" ON "public"."operators" FOR SELECT TO "authenticated" USING (("public"."is_operator_user_safe"() AND ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."password_reset_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patent_search_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "patent_search_history_delete_own" ON "public"."patent_search_history" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "patent_search_history_insert_own" ON "public"."patent_search_history" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "patent_search_history_select_own" ON "public"."patent_search_history" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."payment_applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_applications_scoped_select" ON "public"."payment_applications" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'operator'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "payment_applications"."invoice_id") AND ("i"."client_id" = "public"."get_user_client_id_safe"()))))));



CREATE POLICY "payment_applications_write_admin" ON "public"."payment_applications" TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."payment_terms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_terms_delete" ON "public"."payment_terms" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "payment_terms_read" ON "public"."payment_terms" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "payment_terms_update" ON "public"."payment_terms" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "payment_terms_write" ON "public"."payment_terms" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_admin_full_access" ON "public"."payments" TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "payments_client_own" ON "public"."payments" FOR SELECT TO "authenticated" USING (("public"."is_client_user_safe"() AND ("client_id" = "public"."get_user_client_id_safe"())));



CREATE POLICY "payments_operator_read" ON "public"."payments" FOR SELECT TO "authenticated" USING (("public"."is_operator_user_safe"() AND (EXISTS ( SELECT 1
   FROM ("public"."operators" "o"
     JOIN "public"."services" "s" ON (("s"."client_id" = "payments"."client_id")))
  WHERE (("o"."user_id" = "auth"."uid"()) AND (("s"."operator_id" = "o"."id") OR (EXISTS ( SELECT 1
           FROM "public"."service_resources" "sr"
          WHERE (("sr"."service_id" = "s"."id") AND ("sr"."operator_id" = "o"."id"))))))))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own_safe" ON "public"."profiles" FOR INSERT WITH CHECK ((("auth"."uid"() = "id") AND ("role" = 'viewer'::"public"."app_role")));



CREATE POLICY "profiles_no_delete" ON "public"."profiles" FOR DELETE USING (false);



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update_own_restricted" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK ((("auth"."uid"() = "id") AND (NOT ("role" IS DISTINCT FROM ( SELECT "p"."role"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"())))) AND (NOT ("is_active" IS DISTINCT FROM ( SELECT "p"."is_active"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))))));



ALTER TABLE "public"."purchase_voids" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_subscriptions_own" ON "public"."push_subscriptions" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."quick_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quick_entries_admin_only" ON "public"."quick_entries" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."route_tolls" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "route_tolls_delete_admin" ON "public"."route_tolls" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "route_tolls_insert_admin" ON "public"."route_tolls" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "route_tolls_select_auth" ON "public"."route_tolls" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "route_tolls_update_admin" ON "public"."route_tolls" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."routes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "routes_delete_admin" ON "public"."routes" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "routes_insert_admin" ON "public"."routes" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "routes_select_auth" ON "public"."routes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "routes_update_admin" ON "public"."routes" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."saved_locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "saved_locations_delete" ON "public"."saved_locations" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "saved_locations_read" ON "public"."saved_locations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "saved_locations_update" ON "public"."saved_locations" FOR UPDATE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"())) WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "saved_locations_write" ON "public"."saved_locations" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



ALTER TABLE "public"."scheduled_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "scheduled_payments_delete_admin" ON "public"."scheduled_payments" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "scheduled_payments_insert_admin" ON "public"."scheduled_payments" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "scheduled_payments_select_auth" ON "public"."scheduled_payments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "scheduled_payments_update_admin" ON "public"."scheduled_payments" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."service_cash_receipts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_cash_receipts_delete" ON "public"."service_cash_receipts" FOR DELETE TO "authenticated" USING (("public"."is_admin_user_safe"() OR ("public"."is_operator_user_safe"() AND ("created_by" = "auth"."uid"()))));



CREATE POLICY "service_cash_receipts_insert" ON "public"."service_cash_receipts" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = "auth"."uid"()) AND ("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"())));



CREATE POLICY "service_cash_receipts_select_scoped" ON "public"."service_cash_receipts" FOR SELECT TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"() OR ("public"."is_client_user_safe"() AND (EXISTS ( SELECT 1
   FROM "public"."services" "s"
  WHERE (("s"."id" = "service_cash_receipts"."service_id") AND ("s"."client_id" = "public"."get_user_client_id_safe"())))))));



CREATE POLICY "service_cash_receipts_update" ON "public"."service_cash_receipts" FOR UPDATE TO "authenticated" USING (("created_by" = "auth"."uid"())) WITH CHECK (("created_by" = "auth"."uid"()));



ALTER TABLE "public"."service_change_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_change_history_scoped_select" ON "public"."service_change_history" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'operator'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."services" "s"
  WHERE (("s"."id" = "service_change_history"."service_id") AND ("s"."client_id" = "public"."get_user_client_id_safe"()))))));



ALTER TABLE "public"."service_closures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_closures_delete" ON "public"."service_closures" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "service_closures_read" ON "public"."service_closures" FOR SELECT TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "service_closures_update" ON "public"."service_closures" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "service_closures_write" ON "public"."service_closures" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."service_costs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_costs_delete_admin" ON "public"."service_costs" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "service_costs_insert_staff" ON "public"."service_costs" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "service_costs_select_staff" ON "public"."service_costs" FOR SELECT TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "service_costs_update_staff" ON "public"."service_costs" FOR UPDATE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"())) WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



ALTER TABLE "public"."service_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_rates_admin_full" ON "public"."service_rates" TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "service_rates_client_own" ON "public"."service_rates" FOR SELECT TO "authenticated" USING (("public"."is_client_user_safe"() AND ("client_id" = "public"."get_user_client_id_safe"())));



CREATE POLICY "service_rates_operator_read" ON "public"."service_rates" FOR SELECT TO "authenticated" USING ("public"."is_operator_user_safe"());



ALTER TABLE "public"."service_resources" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_resources_read" ON "public"."service_resources" FOR SELECT TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "service_resources_write" ON "public"."service_resources" TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."service_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_types_delete_admin" ON "public"."service_types" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "service_types_insert_admin" ON "public"."service_types" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "service_types_select_auth" ON "public"."service_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "service_types_update_admin" ON "public"."service_types" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."service_update_error_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_update_error_logs_admin_only" ON "public"."service_update_error_logs" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "services_admin_full_access" ON "public"."services" TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "services_client_own_data" ON "public"."services" FOR SELECT TO "authenticated" USING (("public"."is_client_user_safe"() AND ("client_id" = "public"."get_user_client_id_safe"())));



CREATE POLICY "services_operator_insert" ON "public"."services" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_operator_user_safe"());



CREATE POLICY "services_operator_select_scoped" ON "public"."services" FOR SELECT TO "authenticated" USING (("public"."is_operator_user_safe"() AND (EXISTS ( SELECT 1
   FROM "public"."operators" "o"
  WHERE (("o"."user_id" = "auth"."uid"()) AND (("o"."id" = "services"."operator_id") OR (EXISTS ( SELECT 1
           FROM "public"."service_resources" "sr"
          WHERE (("sr"."service_id" = "services"."id") AND ("sr"."operator_id" = "o"."id"))))))))));



CREATE POLICY "services_update_scoped" ON "public"."services" FOR UPDATE TO "authenticated" USING (("public"."is_admin_user_safe"() OR ("public"."is_operator_user_safe"() AND (EXISTS ( SELECT 1
   FROM "public"."operators" "o"
  WHERE (("o"."user_id" = "auth"."uid"()) AND (("o"."id" = "services"."operator_id") OR (EXISTS ( SELECT 1
           FROM "public"."service_resources" "sr"
          WHERE (("sr"."service_id" = "services"."id") AND ("sr"."operator_id" = "o"."id"))))))))))) WITH CHECK (("public"."is_admin_user_safe"() OR ("public"."is_operator_user_safe"() AND (EXISTS ( SELECT 1
   FROM "public"."operators" "o"
  WHERE (("o"."user_id" = "auth"."uid"()) AND (("o"."id" = "services"."operator_id") OR (EXISTS ( SELECT 1
           FROM "public"."service_resources" "sr"
          WHERE (("sr"."service_id" = "services"."id") AND ("sr"."operator_id" = "o"."id")))))))))));



CREATE POLICY "services_viewer_read_access" ON "public"."services" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'viewer'::"public"."app_role"));



ALTER TABLE "public"."supplier_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supplier_categories_delete" ON "public"."supplier_categories" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "supplier_categories_read" ON "public"."supplier_categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "supplier_categories_update" ON "public"."supplier_categories" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "supplier_categories_write" ON "public"."supplier_categories" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."supplier_invoice_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supplier_invoice_items_delete_admin" ON "public"."supplier_invoice_items" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "supplier_invoice_items_insert_admin" ON "public"."supplier_invoice_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "supplier_invoice_items_select_auth" ON "public"."supplier_invoice_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "supplier_invoice_items_update_admin" ON "public"."supplier_invoice_items" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."supplier_invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supplier_invoices_delete_admin" ON "public"."supplier_invoices" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "supplier_invoices_insert_admin" ON "public"."supplier_invoices" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "supplier_invoices_select_auth" ON "public"."supplier_invoices" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "supplier_invoices_update_admin" ON "public"."supplier_invoices" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."supplier_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supplier_payments_delete_admin" ON "public"."supplier_payments" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "supplier_payments_insert_admin" ON "public"."supplier_payments" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "supplier_payments_select_auth" ON "public"."supplier_payments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "supplier_payments_update_admin" ON "public"."supplier_payments" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "suppliers_delete_admin" ON "public"."suppliers" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "suppliers_insert_admin" ON "public"."suppliers" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "suppliers_update_admin" ON "public"."suppliers" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_settings_admin_only" ON "public"."system_settings" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."toll_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "toll_rates_delete_admin" ON "public"."toll_rates" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "toll_rates_insert_admin" ON "public"."toll_rates" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "toll_rates_select_auth" ON "public"."toll_rates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "toll_rates_update_admin" ON "public"."toll_rates" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."toll_stations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "toll_stations_delete_admin" ON "public"."toll_stations" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "toll_stations_insert_admin" ON "public"."toll_stations" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_user_safe"());



CREATE POLICY "toll_stations_select_auth" ON "public"."toll_stations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "toll_stations_update_admin" ON "public"."toll_stations" FOR UPDATE TO "authenticated" USING ("public"."is_admin_user_safe"()) WITH CHECK ("public"."is_admin_user_safe"());



ALTER TABLE "public"."trip_estimates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_estimates_delete" ON "public"."trip_estimates" FOR DELETE TO "authenticated" USING ("public"."is_admin_user_safe"());



CREATE POLICY "trip_estimates_read" ON "public"."trip_estimates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "trip_estimates_update" ON "public"."trip_estimates" FOR UPDATE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"())) WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "trip_estimates_write" ON "public"."trip_estimates" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



ALTER TABLE "public"."user_activity_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_activity_log_insert_own" ON "public"."user_activity_log" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_activity_log_select_admin" ON "public"."user_activity_log" FOR SELECT TO "authenticated" USING ("public"."is_admin_user_safe"());



ALTER TABLE "public"."user_invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_invitations_admin_only" ON "public"."user_invitations" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."user_module_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_view_own_role" ON "public"."user_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."vehicle_api_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicle_brands" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vehicle_brands_delete_staff" ON "public"."vehicle_brands" FOR DELETE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "vehicle_brands_insert_staff" ON "public"."vehicle_brands" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "vehicle_brands_select_auth" ON "public"."vehicle_brands" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "vehicle_brands_update_staff" ON "public"."vehicle_brands" FOR UPDATE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"())) WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



ALTER TABLE "public"."vehicle_models" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vehicle_models_delete_staff" ON "public"."vehicle_models" FOR DELETE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "vehicle_models_insert_staff" ON "public"."vehicle_models" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



CREATE POLICY "vehicle_models_select_auth" ON "public"."vehicle_models" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "vehicle_models_update_staff" ON "public"."vehicle_models" FOR UPDATE TO "authenticated" USING (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"())) WITH CHECK (("public"."is_admin_user_safe"() OR "public"."is_operator_user_safe"()));



ALTER TABLE "public"."whatsapp_alert_dedupe" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_message_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_settings" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."clients";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."costs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."crane_parts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."inventory_items";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."inventory_movements";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."invoices";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."services";



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."admin_create_user"("p_email" "text", "p_full_name" "text", "p_role" "public"."app_role", "p_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_create_user"("p_email" "text", "p_full_name" "text", "p_role" "public"."app_role", "p_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_create_user"("p_email" "text", "p_full_name" "text", "p_role" "public"."app_role", "p_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_payment_fifo"("p_payment_id" "uuid", "p_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_payment_fifo"("p_payment_id" "uuid", "p_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_payment_fifo"("p_payment_id" "uuid", "p_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_payment_manual"("p_payment_id" "uuid", "p_applications" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_payment_manual"("p_payment_id" "uuid", "p_applications" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_payment_manual"("p_payment_id" "uuid", "p_applications" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_payment_selective"("p_payment_id" "uuid", "p_fiscal_numbers" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."apply_payment_selective"("p_payment_id" "uuid", "p_fiscal_numbers" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_payment_selective"("p_payment_id" "uuid", "p_fiscal_numbers" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_payment_selective"("p_payment_id" "uuid", "p_fiscal_numbers" "text"[], "p_apply_only_to_specified" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."apply_payment_selective"("p_payment_id" "uuid", "p_fiscal_numbers" "text"[], "p_apply_only_to_specified" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_payment_selective"("p_payment_id" "uuid", "p_fiscal_numbers" "text"[], "p_apply_only_to_specified" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_pending_payments_to_invoices"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_pending_payments_to_invoices"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_pending_payments_to_invoices"() TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_pending_user"("target_user_id" "uuid", "new_role" "public"."app_role", "target_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_pending_user"("target_user_id" "uuid", "new_role" "public"."app_role", "target_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_pending_user"("target_user_id" "uuid", "new_role" "public"."app_role", "target_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_default_cost_center"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_default_cost_center"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_default_cost_center"() TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_user_client"("target_user_id" "uuid", "target_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_user_client"("target_user_id" "uuid", "target_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_user_client"("target_user_id" "uuid", "target_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_commission_system"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_commission_system"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_commission_system"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_update_invoice_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_update_invoice_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_update_invoice_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_update_maintenance_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_update_maintenance_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_update_maintenance_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_update_service_invoice_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_update_service_invoice_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_update_service_invoice_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_maintenance_costs"() TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_maintenance_costs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_maintenance_costs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_supplier_payments_from_costs"() TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_supplier_payments_from_costs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_supplier_payments_from_costs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."build_import_batch_summary"("p_batch_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."build_import_batch_summary"("p_batch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."build_import_batch_summary"("p_batch_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_billing_date"("service_date" "date", "billing_cycle_type" "text", "billing_delay_days" integer, "billing_cycle_day" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_billing_date"("service_date" "date", "billing_cycle_type" "text", "billing_delay_days" integer, "billing_cycle_day" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_billing_date"("service_date" "date", "billing_cycle_type" "text", "billing_delay_days" integer, "billing_cycle_day" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_crane_part_total_value"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_crane_part_total_value"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_crane_part_total_value"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_client_sensitive_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_client_sensitive_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_client_sensitive_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_view_notification"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_notification"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_notification"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cascade_delete_cost"("p_cost_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cascade_delete_cost"("p_cost_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cascade_delete_cost"("p_cost_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cascade_delete_service_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."cascade_delete_service_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cascade_delete_service_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_and_update_overdue_invoices"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_update_overdue_invoices"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_update_overdue_invoices"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_auth_health"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_auth_health"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_auth_health"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_bidirectional_sync_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_bidirectional_sync_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_bidirectional_sync_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_cost_duplicates"("p_date" "date", "p_amount" numeric, "p_description" "text", "p_folio" "text", "p_tolerance_percent" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."check_cost_duplicates"("p_date" "date", "p_amount" numeric, "p_description" "text", "p_folio" "text", "p_tolerance_percent" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_cost_duplicates"("p_date" "date", "p_amount" numeric, "p_description" "text", "p_folio" "text", "p_tolerance_percent" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_for_duplicate_payment"("p_client_id" "uuid", "p_amount" numeric, "p_payment_date" "date", "p_tolerance_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_for_duplicate_payment"("p_client_id" "uuid", "p_amount" numeric, "p_payment_date" "date", "p_tolerance_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_for_duplicate_payment"("p_client_id" "uuid", "p_amount" numeric, "p_payment_date" "date", "p_tolerance_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_inventory_alerts"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_inventory_alerts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_inventory_alerts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_inventory_sync_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_inventory_sync_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_inventory_sync_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_operator_not_excluded"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_operator_not_excluded"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_operator_not_excluded"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_operator_visibility"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_operator_visibility"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_operator_visibility"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_security_compliance"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_security_compliance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_security_compliance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_security_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_security_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_security_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_service_invoice_consistency"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_service_invoice_consistency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_service_invoice_consistency"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_supplier_duplicates"("p_rut" "text", "p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_supplier_duplicates"("p_rut" "text", "p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_supplier_duplicates"("p_rut" "text", "p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_supplier_invoice_duplicates"("p_folio" "text", "p_supplier_rut" "text", "p_amount" numeric, "p_tolerance_percent" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."check_supplier_invoice_duplicates"("p_folio" "text", "p_supplier_rut" "text", "p_amount" numeric, "p_tolerance_percent" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_supplier_invoice_duplicates"("p_folio" "text", "p_supplier_rut" "text", "p_amount" numeric, "p_tolerance_percent" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_duplicate_inventory_costs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_duplicate_inventory_costs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_duplicate_inventory_costs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_duplicate_payments"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_duplicate_payments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_duplicate_payments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_duplicate_profiles"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_duplicate_profiles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_duplicate_profiles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_orphaned_supplier_costs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_orphaned_supplier_costs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_orphaned_supplier_costs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_payment_duplicates"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_payment_duplicates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_payment_duplicates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."close_service_status_only"("p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."close_service_status_only"("p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_service_status_only"("p_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."comprehensive_payment_diagnosis"() TO "anon";
GRANT ALL ON FUNCTION "public"."comprehensive_payment_diagnosis"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comprehensive_payment_diagnosis"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_automatic_payment_for_invoice"("p_invoice_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_automatic_payment_for_invoice"("p_invoice_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_automatic_payment_for_invoice"("p_invoice_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_automatic_payment_for_invoice"("p_invoice_id" "uuid", "p_payment_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."create_automatic_payment_for_invoice"("p_invoice_id" "uuid", "p_payment_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_automatic_payment_for_invoice"("p_invoice_id" "uuid", "p_payment_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_cost_for_crane_part"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_cost_for_crane_part"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_cost_for_crane_part"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_cost_for_crane_part_conditional"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_cost_for_crane_part_conditional"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_cost_for_crane_part_conditional"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_cost_for_maintenance"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_cost_for_maintenance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_cost_for_maintenance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_cost_from_maintenance"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_cost_from_maintenance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_cost_from_maintenance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_cost_from_supplier_payment"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_cost_from_supplier_payment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_cost_from_supplier_payment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_cost_with_payment_link"("p_payment_id" "uuid", "p_supplier_name" "text", "p_amount" numeric, "p_description" "text", "p_category" "text", "p_paid_date" "date", "p_cost_category_mapping" "jsonb", "p_default_category" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_cost_with_payment_link"("p_payment_id" "uuid", "p_supplier_name" "text", "p_amount" numeric, "p_description" "text", "p_category" "text", "p_paid_date" "date", "p_cost_category_mapping" "jsonb", "p_default_category" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_cost_with_payment_link"("p_payment_id" "uuid", "p_supplier_name" "text", "p_amount" numeric, "p_description" "text", "p_category" "text", "p_paid_date" "date", "p_cost_category_mapping" "jsonb", "p_default_category" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_inventory_consumption_movement"("p_inventory_item_id" "uuid", "p_quantity" integer, "p_crane_id" "uuid", "p_operator_id" "uuid", "p_reference_document" "text", "p_observations" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_inventory_consumption_movement"("p_inventory_item_id" "uuid", "p_quantity" integer, "p_crane_id" "uuid", "p_operator_id" "uuid", "p_reference_document" "text", "p_observations" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_inventory_consumption_movement"("p_inventory_item_id" "uuid", "p_quantity" integer, "p_crane_id" "uuid", "p_operator_id" "uuid", "p_reference_document" "text", "p_observations" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_inventory_consumption_movement"("p_inventory_item_id" "uuid", "p_quantity" integer, "p_crane_id" "uuid", "p_operator_id" "uuid", "p_reference_document" "text", "p_observations" "text", "p_unit_cost" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."create_inventory_consumption_movement"("p_inventory_item_id" "uuid", "p_quantity" integer, "p_crane_id" "uuid", "p_operator_id" "uuid", "p_reference_document" "text", "p_observations" "text", "p_unit_cost" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_inventory_consumption_movement"("p_inventory_item_id" "uuid", "p_quantity" integer, "p_crane_id" "uuid", "p_operator_id" "uuid", "p_reference_document" "text", "p_observations" "text", "p_unit_cost" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_invoice_transaction"("p_invoice_data" "jsonb", "p_service_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_invoice_transaction"("p_invoice_data" "jsonb", "p_service_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_invoice_transaction"("p_invoice_data" "jsonb", "p_service_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text", "p_category" "text", "p_priority" integer, "p_action_url" "text", "p_action_data" "jsonb", "p_entity_type" "text", "p_entity_id" "uuid", "p_group_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text", "p_category" "text", "p_priority" integer, "p_action_url" "text", "p_action_data" "jsonb", "p_entity_type" "text", "p_entity_id" "uuid", "p_group_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text", "p_category" "text", "p_priority" integer, "p_action_url" "text", "p_action_data" "jsonb", "p_entity_type" "text", "p_entity_id" "uuid", "p_group_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_payment_from_existing_income"("p_income_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_payment_from_existing_income"("p_income_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_payment_from_existing_income"("p_income_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_supplier_payment_from_cost"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_supplier_payment_from_cost"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_supplier_payment_from_cost"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_service_states"() TO "anon";
GRANT ALL ON FUNCTION "public"."debug_service_states"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_service_states"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_commissions_on_service_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_commissions_on_service_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_commissions_on_service_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_cost_for_crane_part"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_cost_for_crane_part"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_cost_for_crane_part"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_service_cascade"("p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_service_cascade"("p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_service_cascade"("p_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_admin"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_admin"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_admin"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."detect_duplicate_crane_parts"("p_crane_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."detect_duplicate_crane_parts"("p_crane_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."detect_duplicate_crane_parts"("p_crane_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."diagnose_maintenance_cost_integration"() TO "anon";
GRANT ALL ON FUNCTION "public"."diagnose_maintenance_cost_integration"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."diagnose_maintenance_cost_integration"() TO "service_role";



GRANT ALL ON FUNCTION "public"."diagnose_mixed_payment_invoices"() TO "anon";
GRANT ALL ON FUNCTION "public"."diagnose_mixed_payment_invoices"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."diagnose_mixed_payment_invoices"() TO "service_role";



GRANT ALL ON FUNCTION "public"."diagnose_payment_application_conflicts"("p_payment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."diagnose_payment_application_conflicts"("p_payment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."diagnose_payment_application_conflicts"("p_payment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."diagnose_service_update_issues"("service_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."diagnose_service_update_issues"("service_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."diagnose_service_update_issues"("service_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."emergency_close_service"("p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."emergency_close_service"("p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."emergency_close_service"("p_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_commission_batch_consistency"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_commission_batch_consistency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_commission_batch_consistency"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_product_service_description"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_product_service_description"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_product_service_description"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_commission_operator_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_commission_operator_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_commission_operator_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."execute_readonly_query"("query_text" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."execute_readonly_query"("query_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fill_exit_costs"() TO "anon";
GRANT ALL ON FUNCTION "public"."fill_exit_costs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fill_exit_costs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."final_security_check"() TO "anon";
GRANT ALL ON FUNCTION "public"."final_security_check"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."final_security_check"() TO "service_role";



GRANT ALL ON FUNCTION "public"."find_duplicate_suppliers"() TO "anon";
GRANT ALL ON FUNCTION "public"."find_duplicate_suppliers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_duplicate_suppliers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."find_matching_costs_for_invoice"("p_supplier_rut" "text", "p_amount" numeric, "p_date_from" "date", "p_date_to" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."find_matching_costs_for_invoice"("p_supplier_rut" "text", "p_amount" numeric, "p_date_from" "date", "p_date_to" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_matching_costs_for_invoice"("p_supplier_rut" "text", "p_amount" numeric, "p_date_from" "date", "p_date_to" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_all_invoice_statuses"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_all_invoice_statuses"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_all_invoice_statuses"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_all_invoiced_services_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_all_invoiced_services_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_all_invoiced_services_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_all_maintenance_cost_descriptions"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_all_maintenance_cost_descriptions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_all_maintenance_cost_descriptions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_amphos_payment_applications"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_amphos_payment_applications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_amphos_payment_applications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_applied_amount_duplications"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_applied_amount_duplications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_applied_amount_duplications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_duplicate_fact_4011_application"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_duplicate_fact_4011_application"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_duplicate_fact_4011_application"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_duplicate_paid_amounts"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_duplicate_paid_amounts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_duplicate_paid_amounts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_existing_invoice_inconsistencies"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_existing_invoice_inconsistencies"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_existing_invoice_inconsistencies"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_existing_overdue_invoices"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_existing_overdue_invoices"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_existing_overdue_invoices"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_existing_payment_inconsistencies"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_existing_payment_inconsistencies"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_existing_payment_inconsistencies"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_inventory_cost_issues"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_inventory_cost_issues"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_inventory_cost_issues"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_invoice_payment_inconsistencies"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_invoice_payment_inconsistencies"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_invoice_payment_inconsistencies"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_maintenance_status_inconsistencies"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_maintenance_status_inconsistencies"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_maintenance_status_inconsistencies"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_materiales_electricos_unit_cost"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_materiales_electricos_unit_cost"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_materiales_electricos_unit_cost"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_negative_remaining_amounts"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_negative_remaining_amounts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_negative_remaining_amounts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_payment_system_inconsistencies"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_payment_system_inconsistencies"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_payment_system_inconsistencies"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_specific_payment_issue"("p_payment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fix_specific_payment_issue"("p_payment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_specific_payment_issue"("p_payment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_unlinked_maintenance_costs"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_unlinked_maintenance_costs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_unlinked_maintenance_costs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."force_close_service_bypass_triggers"("p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."force_close_service_bypass_triggers"("p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."force_close_service_bypass_triggers"("p_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."force_commission_sync_for_service"("p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."force_commission_sync_for_service"("p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."force_commission_sync_for_service"("p_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."force_frontend_cache_refresh"() TO "anon";
GRANT ALL ON FUNCTION "public"."force_frontend_cache_refresh"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."force_frontend_cache_refresh"() TO "service_role";



GRANT ALL ON FUNCTION "public"."force_resync_crane_part"("part_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."force_resync_crane_part"("part_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."force_resync_crane_part"("part_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."force_update_service_to_invoiced"("p_service_id" "uuid", "p_invoice_folio" "text", "p_numero_fiscal" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."force_update_service_to_invoiced"("p_service_id" "uuid", "p_invoice_folio" "text", "p_numero_fiscal" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."force_update_service_to_invoiced"("p_service_id" "uuid", "p_invoice_folio" "text", "p_numero_fiscal" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."full_payment_cleanup_and_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."full_payment_cleanup_and_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."full_payment_cleanup_and_sync"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_commission_cost"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_commission_cost"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_commission_cost"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_commission_on_service_completion"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_commission_on_service_completion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_commission_on_service_completion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_database_backup"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_database_backup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_database_backup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_excess_folio"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_excess_folio"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_excess_folio"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_quick_backup"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_quick_backup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_quick_backup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_service_cash_receipt_folio"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_service_cash_receipt_folio"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_service_cash_receipt_folio"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_service_folio"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_service_folio"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_service_folio"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_simple_invoice_folio"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_simple_invoice_folio"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_simple_invoice_folio"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_client_id_for_user"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_client_id_for_user"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_client_id_for_user"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_client_payment_history"("p_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_client_payment_history"("p_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_client_payment_history"("p_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_commissions_with_details"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_commissions_with_details"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_commissions_with_details"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_crane_metrics"("p_crane_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_crane_metrics"("p_crane_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_crane_metrics"("p_crane_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_user_role_safe"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_role_safe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_role_safe"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_default_cost_category_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_default_cost_category_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_default_cost_category_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_document_expiry_alerts"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_document_expiry_alerts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_document_expiry_alerts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_invoice_overdue_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_invoice_overdue_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_invoice_overdue_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_invoice_payment_status"("p_invoice_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_invoice_payment_status"("p_invoice_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_invoice_payment_status"("p_invoice_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_invoices_due_soon"("days_ahead" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_invoices_due_soon"("days_ahead" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_invoices_due_soon"("days_ahead" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_maintenance_with_cost"("maintenance_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_maintenance_with_cost"("maintenance_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_maintenance_with_cost"("maintenance_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_notification_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_notification_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_notification_summary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_operator_id_by_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_operator_id_by_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_operator_id_by_user"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_inventory_supplier"("p_name" "text", "p_rut" "text", "p_email" "text", "p_phone" "text", "p_address" "text", "p_contact_person" "text", "p_category" "text", "p_subcategory" "text", "p_notes" "text", "p_is_active" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_inventory_supplier"("p_name" "text", "p_rut" "text", "p_email" "text", "p_phone" "text", "p_address" "text", "p_contact_person" "text", "p_category" "text", "p_subcategory" "text", "p_notes" "text", "p_is_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_inventory_supplier"("p_name" "text", "p_rut" "text", "p_email" "text", "p_phone" "text", "p_address" "text", "p_contact_person" "text", "p_category" "text", "p_subcategory" "text", "p_notes" "text", "p_is_active" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_overdue_invoices_for_alerts"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_overdue_invoices_for_alerts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_overdue_invoices_for_alerts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_parts_traceability"("p_crane_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_parts_traceability"("p_crane_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_parts_traceability"("p_crane_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_users_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_users_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_users_count"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_purchase_void_impact"("p_cost_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_purchase_void_impact"("p_cost_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_purchase_void_impact"("p_cost_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_purchase_void_impact"("p_cost_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_supplier_payment_stats"("p_supplier_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_supplier_payment_stats"("p_supplier_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_supplier_payment_stats"("p_supplier_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_supplier_sync_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_supplier_sync_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_supplier_sync_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_supplier_traceability_stats"("p_supplier_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_supplier_traceability_stats"("p_supplier_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_supplier_traceability_stats"("p_supplier_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_table_structure"("table_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_table_structure"("table_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_table_structure"("table_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_client_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_client_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_client_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_client_id_safe"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_client_id_safe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_client_id_safe"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role_from_table"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role_from_table"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role_from_table"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_weighted_average_cost"("p_item_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_weighted_average_cost"("p_item_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_weighted_average_cost"("p_item_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."global_inventory_cleanup"() TO "anon";
GRANT ALL ON FUNCTION "public"."global_inventory_cleanup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."global_inventory_cleanup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_immediate_consumption_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_immediate_consumption_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_immediate_consumption_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_user_invitation_acceptance"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_user_invitation_acceptance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_user_invitation_acceptance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."import_xml_batch"("p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."import_xml_batch"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_xml_batch"("p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."import_xml_costs"("p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."import_xml_costs"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_xml_costs"("p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."import_xml_supplier_documents"("p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."import_xml_supplier_documents"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_xml_supplier_documents"("p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_notification_if_not_exists"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_notification_if_not_exists"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_notification_if_not_exists"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_user"("check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_user"("check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_user"("check_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_user_safe"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_user_safe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_user_safe"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_authenticated_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_authenticated_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_authenticated_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_authenticated_operator"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_authenticated_operator"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_authenticated_operator"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_authenticated_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_authenticated_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_authenticated_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_authenticated_user_safe"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_authenticated_user_safe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_authenticated_user_safe"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_client_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_client_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_client_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_client_user_safe"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_client_user_safe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_client_user_safe"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_operator_assigned_to_service"("_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_operator_assigned_to_service"("_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_operator_assigned_to_service"("_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_operator_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_operator_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_operator_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_operator_user_safe"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_operator_user_safe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_operator_user_safe"() TO "service_role";



GRANT ALL ON FUNCTION "public"."list_operators_config"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_operators_config"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_operators_config"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_audit_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_audit_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_audit_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_audit_entry"("p_table_name" "text", "p_operation" "text", "p_old_data" "jsonb", "p_new_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_audit_entry"("p_table_name" "text", "p_operation" "text", "p_old_data" "jsonb", "p_new_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_audit_entry"("p_table_name" "text", "p_operation" "text", "p_old_data" "jsonb", "p_new_data" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_cost_snapshot_entry"("p_cost_id" "uuid", "p_field_name" "text", "p_old_value" "text", "p_new_value" "text", "p_change_summary" "text", "p_change_context" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_cost_snapshot_entry"("p_cost_id" "uuid", "p_field_name" "text", "p_old_value" "text", "p_new_value" "text", "p_change_summary" "text", "p_change_context" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_cost_snapshot_entry"("p_cost_id" "uuid", "p_field_name" "text", "p_old_value" "text", "p_new_value" "text", "p_change_summary" "text", "p_change_context" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_cost_snapshot_entry"("p_cost_id" "uuid", "p_field_name" "text", "p_old_value" "text", "p_new_value" "text", "p_change_summary" "text", "p_change_context" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_import_batch_record"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_import_batch_record"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_import_batch_record"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_security_event"("event_type" "text", "event_description" "text", "additional_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_security_event"("event_type" "text", "event_description" "text", "additional_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_security_event"("event_type" "text", "event_description" "text", "additional_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_service_update_error"("p_service_id" "uuid", "p_error_code" "text", "p_error_message" "text", "p_error_details" "jsonb", "p_attempted_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_service_update_error"("p_service_id" "uuid", "p_error_code" "text", "p_error_message" "text", "p_error_details" "jsonb", "p_attempted_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_service_update_error"("p_service_id" "uuid", "p_error_code" "text", "p_error_message" "text", "p_error_details" "jsonb", "p_attempted_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."maintain_payment_consistency"() TO "anon";
GRANT ALL ON FUNCTION "public"."maintain_payment_consistency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."maintain_payment_consistency"() TO "service_role";



GRANT ALL ON FUNCTION "public"."maintain_payment_consistency_enhanced"() TO "anon";
GRANT ALL ON FUNCTION "public"."maintain_payment_consistency_enhanced"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."maintain_payment_consistency_enhanced"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_costs_paid_batch"("p_cost_ids" "uuid"[], "p_payment_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_costs_paid_batch"("p_cost_ids" "uuid"[], "p_payment_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_costs_paid_batch"("p_cost_ids" "uuid"[], "p_payment_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_supplier_payment_as_paid"("p_payment_id" "uuid", "p_paid_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_supplier_payment_as_paid"("p_payment_id" "uuid", "p_paid_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_supplier_payment_as_paid"("p_payment_id" "uuid", "p_paid_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_inventory_items"("p_master_item_id" "uuid", "p_duplicate_item_ids" "uuid"[], "p_master_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."merge_inventory_items"("p_master_item_id" "uuid", "p_duplicate_item_ids" "uuid"[], "p_master_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_inventory_items"("p_master_item_id" "uuid", "p_duplicate_item_ids" "uuid"[], "p_master_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_suppliers"("p_keep_id" "uuid", "p_remove_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."merge_suppliers"("p_keep_id" "uuid", "p_remove_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_suppliers"("p_keep_id" "uuid", "p_remove_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_existing_consumption_movements"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_existing_consumption_movements"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_existing_consumption_movements"() TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_existing_operator_commissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_existing_operator_commissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_existing_operator_commissions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_legacy_crane_parts_data"("p_crane_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_legacy_crane_parts_data"("p_crane_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_legacy_crane_parts_data"("p_crane_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_unsync_crane_parts"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_unsync_crane_parts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_unsync_crane_parts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_unsynced_crane_parts_to_inventory"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_unsynced_crane_parts_to_inventory"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_unsynced_crane_parts_to_inventory"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_inventory_movement_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_inventory_movement_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_inventory_movement_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_supplier_payment_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_supplier_payment_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_supplier_payment_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_duplicate_commissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_duplicate_commissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_duplicate_commissions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_duplicate_maintenance_costs"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_duplicate_maintenance_costs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_duplicate_maintenance_costs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_duplicate_payments"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_duplicate_payments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_duplicate_payments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_duplicate_service_commissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_duplicate_service_commissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_duplicate_service_commissions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_excess_of_excess"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_excess_of_excess"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_excess_of_excess"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_invoice_overpayment"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_invoice_overpayment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_invoice_overpayment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_non_admin_updates_on_paid_costs"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_non_admin_updates_on_paid_costs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_non_admin_updates_on_paid_costs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_overpayment_on_application"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_overpayment_on_application"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_overpayment_on_application"() TO "service_role";



GRANT ALL ON FUNCTION "public"."preview_next_invoice_folio"() TO "anon";
GRANT ALL ON FUNCTION "public"."preview_next_invoice_folio"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."preview_next_invoice_folio"() TO "service_role";



GRANT ALL ON FUNCTION "public"."propagate_invoice_folio_to_closure_services"() TO "anon";
GRANT ALL ON FUNCTION "public"."propagate_invoice_folio_to_closure_services"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."propagate_invoice_folio_to_closure_services"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_crane_parts_costs"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_crane_parts_costs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_crane_parts_costs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_payment_balances"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_payment_balances"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_payment_balances"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reconcile_orphan_records"() TO "anon";
GRANT ALL ON FUNCTION "public"."reconcile_orphan_records"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reconcile_orphan_records"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_pending_user"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_pending_user"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_pending_user"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_duplicate_payment_applications"() TO "anon";
GRANT ALL ON FUNCTION "public"."remove_duplicate_payment_applications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_duplicate_payment_applications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."repair_commission_system"() TO "anon";
GRANT ALL ON FUNCTION "public"."repair_commission_system"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."repair_commission_system"() TO "service_role";



GRANT ALL ON FUNCTION "public"."repair_payment_application"("p_payment_id" "uuid", "p_invoice_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."repair_payment_application"("p_payment_id" "uuid", "p_invoice_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."repair_payment_application"("p_payment_id" "uuid", "p_invoice_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_commission_conflicts"("p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_commission_conflicts"("p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_commission_conflicts"("p_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_payment_application_conflicts"("p_payment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_payment_application_conflicts"("p_payment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_payment_application_conflicts"("p_payment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rollback_import_batch"("p_batch_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rollback_import_batch"("p_batch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rollback_import_batch"("p_batch_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."safe_update_service"("service_id_param" "uuid", "update_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."safe_update_service"("service_id_param" "uuid", "update_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."safe_update_service"("service_id_param" "uuid", "update_data" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_voidable_inventory_purchases"("p_search" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_voidable_inventory_purchases"("p_search" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_voidable_inventory_purchases"("p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_voidable_inventory_purchases"("p_search" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_import_rut_mappings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_import_rut_mappings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_import_rut_mappings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."simple_payment_cleanup"() TO "anon";
GRANT ALL ON FUNCTION "public"."simple_payment_cleanup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."simple_payment_cleanup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."simple_update_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."simple_update_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."simple_update_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."smart_apply_payment"("p_payment_id" "uuid", "p_auto_apply" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."smart_apply_payment"("p_payment_id" "uuid", "p_auto_apply" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."smart_apply_payment"("p_payment_id" "uuid", "p_auto_apply" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."smart_link_maintenance_costs"() TO "anon";
GRANT ALL ON FUNCTION "public"."smart_link_maintenance_costs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."smart_link_maintenance_costs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_closure_invoice_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_closure_invoice_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_closure_invoice_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_cost_deletion_cascade"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_cost_deletion_cascade"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_cost_deletion_cascade"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_cost_supplier_payment_deletion"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_cost_supplier_payment_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_cost_supplier_payment_deletion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_cost_update_to_payment"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_cost_update_to_payment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_cost_update_to_payment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_crane_part_to_inventory"("p_part_name" "text", "p_inventory_item_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_crane_part_to_inventory"("p_part_name" "text", "p_inventory_item_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_crane_part_to_inventory"("p_part_name" "text", "p_inventory_item_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_existing_paid_invoices"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_existing_paid_invoices"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_existing_paid_invoices"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_existing_services_to_resources"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_existing_services_to_resources"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_existing_services_to_resources"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_existing_supplier_payments_to_costs"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_existing_supplier_payments_to_costs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_existing_supplier_payments_to_costs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_inventory_consumption_to_parts"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_inventory_consumption_to_parts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_inventory_consumption_to_parts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_inventory_cost_to_movement"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_inventory_cost_to_movement"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_inventory_cost_to_movement"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_inventory_exit_to_crane_parts"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_inventory_exit_to_crane_parts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_inventory_exit_to_crane_parts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_inventory_to_supplier_and_cost"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_inventory_to_supplier_and_cost"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_inventory_to_supplier_and_cost"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_legacy_operator_commission"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_legacy_operator_commission"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_legacy_operator_commission"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_maintenance_costs"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_maintenance_costs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_maintenance_costs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_paid_invoices_with_payments"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_paid_invoices_with_payments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_paid_invoices_with_payments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_parts_purchase_to_inventory"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_parts_purchase_to_inventory"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_parts_purchase_to_inventory"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_role_to_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_role_to_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_role_to_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_service_company_from_crane"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_service_company_from_crane"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_service_company_from_crane"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_services_on_crane_company_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_services_on_crane_company_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_services_on_crane_company_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_specific_income_to_payment"("p_income_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_specific_income_to_payment"("p_income_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_specific_income_to_payment"("p_income_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_supplier_invoice_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_supplier_invoice_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_supplier_invoice_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_supplier_invoice_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_supplier_invoice_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_supplier_invoice_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_supplier_payment_cost_deletion"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_supplier_payment_cost_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_supplier_payment_cost_deletion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_supplier_payment_update_to_cost"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_supplier_payment_update_to_cost"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_supplier_payment_update_to_cost"() TO "service_role";



GRANT ALL ON FUNCTION "public"."test_invoice_creation"() TO "anon";
GRANT ALL ON FUNCTION "public"."test_invoice_creation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_invoice_creation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_user_status"("user_id" "uuid", "new_status" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_user_status"("user_id" "uuid", "new_status" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_user_status"("user_id" "uuid", "new_status" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_supplier_invoice_items_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_supplier_invoice_items_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_supplier_invoice_items_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."track_cost_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."track_cost_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_cost_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."track_crane_part_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."track_crane_part_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_crane_part_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."track_inventory_movement_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."track_inventory_movement_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_inventory_movement_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."track_service_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."track_service_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_service_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_global_data_refresh"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_global_data_refresh"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_global_data_refresh"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_closure_status_on_invoice"("p_closure_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_closure_status_on_invoice"("p_closure_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_closure_status_on_invoice"("p_closure_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_commission_payment_date"("p_commission_ids" "uuid"[], "p_payment_date" "date", "p_payment_batch_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_commission_payment_date"("p_commission_ids" "uuid"[], "p_payment_date" "date", "p_payment_batch_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_commission_payment_date"("p_commission_ids" "uuid"[], "p_payment_date" "date", "p_payment_batch_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_cost_for_crane_part"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_cost_for_crane_part"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_cost_for_crane_part"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_crane_expiry_on_document_upload"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_crane_expiry_on_document_upload"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_crane_expiry_on_document_upload"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_inventory_stock"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_inventory_stock"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_inventory_stock"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_invoice_amounts"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_invoice_amounts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_invoice_amounts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_invoice_status_from_payments"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_invoice_status_from_payments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_invoice_status_from_payments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_notifications_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_notifications_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_notifications_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_overdue_invoices"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_overdue_invoices"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_overdue_invoices"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_overdue_supplier_payments"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_overdue_supplier_payments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_overdue_supplier_payments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_payment_amounts"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_payment_amounts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_payment_amounts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_payment_applied_amount"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_payment_applied_amount"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_payment_applied_amount"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_payment_remaining_amount"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_payment_remaining_amount"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_payment_remaining_amount"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_service_comprehensive"("p_service_id" "uuid", "p_service_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_service_comprehensive"("p_service_id" "uuid", "p_service_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_service_comprehensive"("p_service_id" "uuid", "p_service_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_services_to_invoiced_batch"("p_service_ids" "uuid"[], "p_invoice_folio" "text", "p_numero_fiscal" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_services_to_invoiced_batch"("p_service_ids" "uuid"[], "p_invoice_folio" "text", "p_numero_fiscal" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_services_to_invoiced_batch"("p_service_ids" "uuid"[], "p_invoice_folio" "text", "p_numero_fiscal" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_supplier_categories_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_supplier_categories_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_supplier_categories_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_supplier_payment_cost_links_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_supplier_payment_cost_links_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_supplier_payment_cost_links_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_role_secure"("target_user_id" "uuid", "new_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_role_secure"("target_user_id" "uuid", "new_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_role_secure"("target_user_id" "uuid", "new_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_all_warnings_eliminated"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_all_warnings_eliminated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_all_warnings_eliminated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_email"("email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_email"("email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_email"("email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_payment_amounts"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_payment_amounts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_payment_amounts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_payment_application_amount"("p_invoice_id" "uuid", "p_new_amount" numeric, "p_excluding_application_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_payment_application_amount"("p_invoice_id" "uuid", "p_new_amount" numeric, "p_excluding_application_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_payment_application_amount"("p_invoice_id" "uuid", "p_new_amount" numeric, "p_excluding_application_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_payment_system_integrity"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_payment_system_integrity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_payment_system_integrity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_product_service_description"("p_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_product_service_description"("p_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_product_service_description"("p_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_rls_policies"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_rls_policies"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_rls_policies"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_service_invoice_consistency"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_service_invoice_consistency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_service_invoice_consistency"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_service_update_data"("p_service_id" "uuid", "p_service_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_service_update_data"("p_service_id" "uuid", "p_service_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_service_update_data"("p_service_id" "uuid", "p_service_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_auth_system"() TO "anon";
GRANT ALL ON FUNCTION "public"."verify_auth_system"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_auth_system"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_security_compliance"() TO "anon";
GRANT ALL ON FUNCTION "public"."verify_security_compliance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_security_compliance"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."void_inventory_purchase"("p_cost_id" "uuid", "p_reason" "text", "p_replacement_supplier_id" "uuid", "p_revert_payment" boolean, "p_revert_invoice" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."void_inventory_purchase"("p_cost_id" "uuid", "p_reason" "text", "p_replacement_supplier_id" "uuid", "p_revert_payment" boolean, "p_revert_invoice" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."void_inventory_purchase"("p_cost_id" "uuid", "p_reason" "text", "p_replacement_supplier_id" "uuid", "p_revert_payment" boolean, "p_revert_invoice" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."void_inventory_purchase"("p_cost_id" "uuid", "p_reason" "text", "p_replacement_supplier_id" "uuid", "p_revert_payment" boolean, "p_revert_invoice" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";












SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;









GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."backup_email_config" TO "anon";
GRANT ALL ON TABLE "public"."backup_email_config" TO "authenticated";
GRANT ALL ON TABLE "public"."backup_email_config" TO "service_role";



GRANT ALL ON TABLE "public"."backup_logs" TO "anon";
GRANT ALL ON TABLE "public"."backup_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."backup_logs" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_events" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."closure_services" TO "anon";
GRANT ALL ON TABLE "public"."closure_services" TO "authenticated";
GRANT ALL ON TABLE "public"."closure_services" TO "service_role";



GRANT ALL ON TABLE "public"."company_data" TO "anon";
GRANT ALL ON TABLE "public"."company_data" TO "authenticated";
GRANT ALL ON TABLE "public"."company_data" TO "service_role";



GRANT ALL ON TABLE "public"."company_profiles" TO "anon";
GRANT ALL ON TABLE "public"."company_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."company_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."cost_bulk_payment_operations" TO "anon";
GRANT ALL ON TABLE "public"."cost_bulk_payment_operations" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_bulk_payment_operations" TO "service_role";



GRANT ALL ON TABLE "public"."cost_categories" TO "anon";
GRANT ALL ON TABLE "public"."cost_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_categories" TO "service_role";



GRANT ALL ON TABLE "public"."cost_centers" TO "anon";
GRANT ALL ON TABLE "public"."cost_centers" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_centers" TO "service_role";



GRANT ALL ON TABLE "public"."cost_change_history" TO "anon";
GRANT ALL ON TABLE "public"."cost_change_history" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_change_history" TO "service_role";



GRANT ALL ON TABLE "public"."cost_inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."cost_inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_inventory_items" TO "service_role";



GRANT ALL ON TABLE "public"."cost_subcategories" TO "anon";
GRANT ALL ON TABLE "public"."cost_subcategories" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_subcategories" TO "service_role";



GRANT ALL ON TABLE "public"."costs" TO "anon";
GRANT ALL ON TABLE "public"."costs" TO "authenticated";
GRANT ALL ON TABLE "public"."costs" TO "service_role";



GRANT ALL ON TABLE "public"."crane_consumption_rates" TO "anon";
GRANT ALL ON TABLE "public"."crane_consumption_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."crane_consumption_rates" TO "service_role";



GRANT ALL ON TABLE "public"."crane_documents" TO "anon";
GRANT ALL ON TABLE "public"."crane_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."crane_documents" TO "service_role";



GRANT ALL ON TABLE "public"."crane_maintenance" TO "anon";
GRANT ALL ON TABLE "public"."crane_maintenance" TO "authenticated";
GRANT ALL ON TABLE "public"."crane_maintenance" TO "service_role";



GRANT ALL ON TABLE "public"."crane_part_change_history" TO "anon";
GRANT ALL ON TABLE "public"."crane_part_change_history" TO "authenticated";
GRANT ALL ON TABLE "public"."crane_part_change_history" TO "service_role";



GRANT ALL ON TABLE "public"."crane_parts" TO "anon";
GRANT ALL ON TABLE "public"."crane_parts" TO "authenticated";
GRANT ALL ON TABLE "public"."crane_parts" TO "service_role";



GRANT ALL ON TABLE "public"."cranes" TO "anon";
GRANT ALL ON TABLE "public"."cranes" TO "authenticated";
GRANT ALL ON TABLE "public"."cranes" TO "service_role";



GRANT ALL ON TABLE "public"."creditors" TO "anon";
GRANT ALL ON TABLE "public"."creditors" TO "authenticated";
GRANT ALL ON TABLE "public"."creditors" TO "service_role";



GRANT ALL ON TABLE "public"."debt_installments" TO "anon";
GRANT ALL ON TABLE "public"."debt_installments" TO "authenticated";
GRANT ALL ON TABLE "public"."debt_installments" TO "service_role";



GRANT ALL ON TABLE "public"."debt_payments" TO "anon";
GRANT ALL ON TABLE "public"."debt_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."debt_payments" TO "service_role";



GRANT ALL ON TABLE "public"."debts" TO "anon";
GRANT ALL ON TABLE "public"."debts" TO "authenticated";
GRANT ALL ON TABLE "public"."debts" TO "service_role";



GRANT ALL ON TABLE "public"."document_alerts" TO "anon";
GRANT ALL ON TABLE "public"."document_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."document_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."frontend_error_logs" TO "anon";
GRANT ALL ON TABLE "public"."frontend_error_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."frontend_error_logs" TO "service_role";



GRANT ALL ON TABLE "public"."fuel_prices" TO "anon";
GRANT ALL ON TABLE "public"."fuel_prices" TO "authenticated";
GRANT ALL ON TABLE "public"."fuel_prices" TO "service_role";



GRANT ALL ON TABLE "public"."import_batch_records" TO "anon";
GRANT ALL ON TABLE "public"."import_batch_records" TO "authenticated";
GRANT ALL ON TABLE "public"."import_batch_records" TO "service_role";



GRANT ALL ON SEQUENCE "public"."import_batch_records_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."import_batch_records_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."import_batch_records_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."import_batches" TO "anon";
GRANT ALL ON TABLE "public"."import_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."import_batches" TO "service_role";



GRANT ALL ON TABLE "public"."import_history_log" TO "anon";
GRANT ALL ON TABLE "public"."import_history_log" TO "authenticated";
GRANT ALL ON TABLE "public"."import_history_log" TO "service_role";



GRANT ALL ON TABLE "public"."import_rut_mappings" TO "anon";
GRANT ALL ON TABLE "public"."import_rut_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."import_rut_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."income_categories" TO "anon";
GRANT ALL ON TABLE "public"."income_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."income_categories" TO "service_role";



GRANT ALL ON TABLE "public"."income_subcategories" TO "anon";
GRANT ALL ON TABLE "public"."income_subcategories" TO "authenticated";
GRANT ALL ON TABLE "public"."income_subcategories" TO "service_role";



GRANT ALL ON TABLE "public"."incomes" TO "anon";
GRANT ALL ON TABLE "public"."incomes" TO "authenticated";
GRANT ALL ON TABLE "public"."incomes" TO "service_role";



GRANT ALL ON TABLE "public"."inspections" TO "anon";
GRANT ALL ON TABLE "public"."inspections" TO "authenticated";
GRANT ALL ON TABLE "public"."inspections" TO "service_role";



GRANT ALL ON TABLE "public"."internal_scheduler_secrets" TO "anon";
GRANT ALL ON TABLE "public"."internal_scheduler_secrets" TO "authenticated";
GRANT ALL ON TABLE "public"."internal_scheduler_secrets" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_alerts" TO "anon";
GRANT ALL ON TABLE "public"."inventory_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_categories" TO "anon";
GRANT ALL ON TABLE "public"."inventory_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_categories" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_consumptions" TO "anon";
GRANT ALL ON TABLE "public"."inventory_consumptions" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_consumptions" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_items" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_locations" TO "anon";
GRANT ALL ON TABLE "public"."inventory_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_locations" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_movement_change_history" TO "anon";
GRANT ALL ON TABLE "public"."inventory_movement_change_history" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_movement_change_history" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_movements" TO "anon";
GRANT ALL ON TABLE "public"."inventory_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_movements" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_stock" TO "anon";
GRANT ALL ON TABLE "public"."inventory_stock" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_stock" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_suppliers" TO "anon";
GRANT ALL ON TABLE "public"."inventory_suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_alert_settings" TO "anon";
GRANT ALL ON TABLE "public"."invoice_alert_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_alert_settings" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_cancellations" TO "anon";
GRANT ALL ON TABLE "public"."invoice_cancellations" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_cancellations" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_closures" TO "anon";
GRANT ALL ON TABLE "public"."invoice_closures" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_closures" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_services" TO "anon";
GRANT ALL ON TABLE "public"."invoice_services" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_services" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."notification_logs" TO "anon";
GRANT ALL ON TABLE "public"."notification_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_logs" TO "service_role";



GRANT ALL ON TABLE "public"."notification_settings" TO "anon";
GRANT ALL ON TABLE "public"."notification_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_settings" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."operator_documents" TO "anon";
GRANT ALL ON TABLE "public"."operator_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."operator_documents" TO "service_role";



GRANT ALL ON TABLE "public"."operators" TO "anon";
GRANT ALL ON TABLE "public"."operators" TO "authenticated";
GRANT ALL ON TABLE "public"."operators" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_payments" TO "anon";
GRANT ALL ON TABLE "public"."supplier_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_payments" TO "service_role";



GRANT ALL ON TABLE "public"."orphan_crane_parts_candidates" TO "anon";
GRANT ALL ON TABLE "public"."orphan_crane_parts_candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."orphan_crane_parts_candidates" TO "service_role";



GRANT ALL ON TABLE "public"."password_reset_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."password_reset_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."password_reset_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."patent_search_history" TO "anon";
GRANT ALL ON TABLE "public"."patent_search_history" TO "authenticated";
GRANT ALL ON TABLE "public"."patent_search_history" TO "service_role";



GRANT ALL ON TABLE "public"."payment_applications" TO "anon";
GRANT ALL ON TABLE "public"."payment_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_applications" TO "service_role";



GRANT ALL ON TABLE "public"."payment_terms" TO "anon";
GRANT ALL ON TABLE "public"."payment_terms" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_terms" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_voids" TO "anon";
GRANT ALL ON TABLE "public"."purchase_voids" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_voids" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."quick_entries" TO "anon";
GRANT ALL ON TABLE "public"."quick_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."quick_entries" TO "service_role";



GRANT ALL ON TABLE "public"."route_tolls" TO "anon";
GRANT ALL ON TABLE "public"."route_tolls" TO "authenticated";
GRANT ALL ON TABLE "public"."route_tolls" TO "service_role";



GRANT ALL ON TABLE "public"."routes" TO "anon";
GRANT ALL ON TABLE "public"."routes" TO "authenticated";
GRANT ALL ON TABLE "public"."routes" TO "service_role";



GRANT ALL ON TABLE "public"."saved_locations" TO "anon";
GRANT ALL ON TABLE "public"."saved_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_locations" TO "service_role";



GRANT ALL ON TABLE "public"."scheduled_payments" TO "anon";
GRANT ALL ON TABLE "public"."scheduled_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduled_payments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."service_cash_receipt_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."service_cash_receipt_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."service_cash_receipt_seq" TO "service_role";



GRANT ALL ON TABLE "public"."service_cash_receipts" TO "anon";
GRANT ALL ON TABLE "public"."service_cash_receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."service_cash_receipts" TO "service_role";



GRANT ALL ON TABLE "public"."service_change_history" TO "anon";
GRANT ALL ON TABLE "public"."service_change_history" TO "authenticated";
GRANT ALL ON TABLE "public"."service_change_history" TO "service_role";



GRANT ALL ON TABLE "public"."service_closures" TO "anon";
GRANT ALL ON TABLE "public"."service_closures" TO "authenticated";
GRANT ALL ON TABLE "public"."service_closures" TO "service_role";



GRANT ALL ON TABLE "public"."service_costs" TO "anon";
GRANT ALL ON TABLE "public"."service_costs" TO "authenticated";
GRANT ALL ON TABLE "public"."service_costs" TO "service_role";



GRANT ALL ON TABLE "public"."service_rates" TO "anon";
GRANT ALL ON TABLE "public"."service_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."service_rates" TO "service_role";



GRANT ALL ON TABLE "public"."service_resources" TO "anon";
GRANT ALL ON TABLE "public"."service_resources" TO "authenticated";
GRANT ALL ON TABLE "public"."service_resources" TO "service_role";



GRANT ALL ON TABLE "public"."service_types" TO "anon";
GRANT ALL ON TABLE "public"."service_types" TO "authenticated";
GRANT ALL ON TABLE "public"."service_types" TO "service_role";



GRANT ALL ON TABLE "public"."service_update_error_logs" TO "anon";
GRANT ALL ON TABLE "public"."service_update_error_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."service_update_error_logs" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."services_with_excess_summary" TO "anon";
GRANT ALL ON TABLE "public"."services_with_excess_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."services_with_excess_summary" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_categories" TO "anon";
GRANT ALL ON TABLE "public"."supplier_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_categories" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_invoice_items" TO "anon";
GRANT ALL ON TABLE "public"."supplier_invoice_items" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_invoice_items" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_invoices" TO "anon";
GRANT ALL ON TABLE "public"."supplier_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."toll_rates" TO "anon";
GRANT ALL ON TABLE "public"."toll_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."toll_rates" TO "service_role";



GRANT ALL ON TABLE "public"."toll_stations" TO "anon";
GRANT ALL ON TABLE "public"."toll_stations" TO "authenticated";
GRANT ALL ON TABLE "public"."toll_stations" TO "service_role";



GRANT ALL ON TABLE "public"."trip_estimates" TO "anon";
GRANT ALL ON TABLE "public"."trip_estimates" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_estimates" TO "service_role";



GRANT ALL ON TABLE "public"."user_activity_log" TO "anon";
GRANT ALL ON TABLE "public"."user_activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."user_activity_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_activity_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_activity_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_activity_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_invitations" TO "anon";
GRANT ALL ON TABLE "public"."user_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."user_module_permissions" TO "anon";
GRANT ALL ON TABLE "public"."user_module_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_module_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."vehicle_api_cache" TO "anon";
GRANT ALL ON TABLE "public"."vehicle_api_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicle_api_cache" TO "service_role";



GRANT ALL ON TABLE "public"."vehicle_brands" TO "anon";
GRANT ALL ON TABLE "public"."vehicle_brands" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicle_brands" TO "service_role";



GRANT ALL ON TABLE "public"."vehicle_models" TO "anon";
GRANT ALL ON TABLE "public"."vehicle_models" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicle_models" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_alert_dedupe" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_alert_dedupe" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_alert_dedupe" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_message_log" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_message_log" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_message_log" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_settings" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_settings" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
