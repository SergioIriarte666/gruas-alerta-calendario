-- Harden commissions payment batches:
-- - Enforce "one operator per batch" at DB level
-- - Keep payment_date/payment_batch_id consistent
-- - Make commission payment updates work even when paid-cost protection is enabled

CREATE OR REPLACE FUNCTION public.update_commission_payment_date(
  p_commission_ids UUID[],
  p_payment_date DATE,
  p_payment_batch_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    RAISE EXCEPTION 'Algunas comisiones no existen o no pertenecen a Comisión Operador';
  END IF;

  SELECT COUNT(DISTINCT operator_id), MIN(operator_id)
  INTO v_distinct_operator_count, v_operator_id
  FROM public.costs
  WHERE id = ANY(p_commission_ids)
    AND category_id = v_commission_category_id;

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

CREATE OR REPLACE FUNCTION public.get_commissions_with_details()
 RETURNS TABLE(
   id uuid,
   date date,
   payment_date date,
   payment_batch_id text,
   description text,
   amount numeric,
   operator_id uuid,
   service_id uuid,
   service_folio text,
   subcategory text,
   created_at timestamp with time zone,
   updated_at timestamp with time zone,
   operator_name text,
   operator_rut text,
   service_date date,
   service_value numeric,
   client_name text,
   commission_percentage numeric
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_operator_id uuid;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role = 'operator' THEN
    v_operator_id := public.get_operator_id_by_user(auth.uid());
  END IF;

  RETURN QUERY
  SELECT 
    c.id,
    c.date,
    c.payment_date,
    c.payment_batch_id,
    c.description,
    c.amount,
    c.operator_id,
    c.service_id,
    c.service_folio,
    c.subcategory,
    c.created_at,
    c.updated_at,
    o.name as operator_name,
    o.rut as operator_rut,
    s.service_date,
    s.value as service_value,
    cl.name as client_name,
    CASE 
      WHEN s.value > 0 AND c.amount > 0 THEN 
        ROUND((c.amount * 100.0 / s.value), 2)
      ELSE 0
    END as commission_percentage
  FROM public.costs c
  LEFT JOIN public.operators o ON c.operator_id = o.id
  LEFT JOIN public.services s ON c.service_id = s.id
  LEFT JOIN public.clients cl ON s.client_id = cl.id
  LEFT JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE (cc.name = 'Comisión Operador' OR c.subcategory IN ('comisiones', 'comisiones_pagadas'))
    AND (
      v_role IN ('admin', 'viewer')
      OR (v_role = 'operator' AND v_operator_id IS NOT NULL AND c.operator_id = v_operator_id)
    )
  ORDER BY c.date DESC, c.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_commission_batch_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

DROP TRIGGER IF EXISTS enforce_commission_batch_consistency_trigger ON public.costs;
CREATE TRIGGER enforce_commission_batch_consistency_trigger
BEFORE INSERT OR UPDATE OF payment_batch_id, payment_date, operator_id, category_id
ON public.costs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_commission_batch_consistency();

REVOKE ALL ON FUNCTION public.get_commissions_with_details() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_commissions_with_details() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_commissions_with_details() TO authenticated;

REVOKE ALL ON FUNCTION public.update_commission_payment_date(uuid[], date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_commission_payment_date(uuid[], date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_commission_payment_date(uuid[], date, text) TO authenticated;
