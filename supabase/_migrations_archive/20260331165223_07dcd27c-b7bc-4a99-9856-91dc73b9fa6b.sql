
CREATE OR REPLACE FUNCTION public.update_commission_payment_date(
  p_commission_ids UUID[],
  p_payment_date DATE DEFAULT NULL,
  p_payment_batch_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
