BEGIN;

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
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    -- Solo es duplicado si también coincide bank_reference
    -- (o si ambos tienen bank_reference NULL)
    AND (
      (NEW.bank_reference IS NULL AND bank_reference IS NULL)
      OR bank_reference = NEW.bank_reference
    );

  IF existing_count > 0 THEN
    RAISE EXCEPTION 'Ya existe un pago similar para este cliente en las últimas 24 horas. Posible duplicado detectado.';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
