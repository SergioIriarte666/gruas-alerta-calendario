-- Las comisiones tienen un dueño único: el motor automático.
--
-- Evidencia (folio 3263006-1, 27/07 21:12): apareció "Comisión Juan Carlos
-- Sanchez" creada a mano desde el formulario de costos, en la categoría
-- Comisión Operador. Ese registro convive con la comisión que el trigger genera
-- desde service_resources: dos filas para el mismo hecho, una que se recalcula
-- sola y otra que no. El diseño vigente es trigger-como-única-fuente; faltaba
-- la guarda que lo hiciera cierto.
--
-- Quedan permitidos exactamente dos orígenes, ambos deliberados y atribuibles:
--   * sync_service_commissions  — el motor: deriva de service_resources.
--   * create_manual_commission  — el ajuste manual explícito de admin
--     (is_manual_adjustment = true, folio 9999, con su propia auditoría).
--     Es el camino sancionado para pagar una comisión fuera de un servicio; lo
--     que se cierra es escribirla disfrazada de costo operativo cualquiera.
--
-- Los registros manuales HISTÓRICOS no se tocan: la guarda es BEFORE INSERT.
-- La comisión manual del folio 3263006-1 queda tal cual para revisión aparte.

BEGIN;

-- El flag es local a la transacción (set_config con is_local = true): no
-- sobrevive al commit ni se filtra a otra sesión. Misma técnica que el candado
-- de cierre de servicio.
CREATE OR REPLACE FUNCTION public.prevent_manual_commission_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_commission_category_id uuid;
BEGIN
  SELECT id INTO v_commission_category_id
  FROM public.cost_categories
  WHERE name = 'Comisión Operador'
  LIMIT 1;

  IF v_commission_category_id IS NULL OR NEW.category_id IS DISTINCT FROM v_commission_category_id THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.commission_autoflow', true) = 'true' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Las comisiones de operador se generan automáticamente al completar el servicio. No se pueden crear como costo manual.'
    USING ERRCODE = '42501',
          HINT = 'Ajusta la comisión en la sección "Operadores del Servicio" o usa el registro de comisión manual de administración.';
END;
$$;

COMMENT ON FUNCTION public.prevent_manual_commission_cost() IS
  'Rechaza costos nuevos en la categoría Comisión Operador salvo desde el motor automático o la comisión manual de admin.';

DROP TRIGGER IF EXISTS prevent_manual_commission_cost_trigger ON public.costs;
CREATE TRIGGER prevent_manual_commission_cost_trigger
  BEFORE INSERT ON public.costs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_manual_commission_cost();

-- Motor automático: se identifica ante la guarda y vuelve a bajar la bandera al
-- salir, para no dejar la puerta abierta al resto de la transacción.
CREATE OR REPLACE FUNCTION public.sync_service_commissions(p_service_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_service RECORD;
  v_category_id UUID := '440296d4-09c2-4f3a-b02b-835f861df4c4';
BEGIN
  PERFORM set_config('app.commission_autoflow', 'true', true);

  SELECT id, folio, service_date, crane_id, status
  INTO v_service
  FROM services
  WHERE id = p_service_id;

  IF NOT FOUND THEN
    PERFORM set_config('app.commission_autoflow', 'false', true);
    RETURN;
  END IF;

  -- Estados sin comisión: anular las no pagadas; las pagadas quedan como
  -- registro histórico contable
  IF v_service.status NOT IN ('completed', 'with_purchase_order', 'invoiced') THEN
    DELETE FROM costs
    WHERE service_id = p_service_id
      AND category_id = v_category_id
      AND payment_date IS NULL
      AND payment_batch_id IS NULL;
    PERFORM set_config('app.commission_autoflow', 'false', true);
    RETURN;
  END IF;

  -- 1) Anular pendientes que ya no corresponden (reasignación, monto en 0,
  --    operador ahora exento)
  DELETE FROM costs c
  WHERE c.service_id = p_service_id
    AND c.category_id = v_category_id
    AND c.payment_date IS NULL
    AND c.payment_batch_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM service_resources sr
      JOIN operators o ON o.id = sr.operator_id
      WHERE sr.service_id = p_service_id
        AND sr.resource_type = 'operator'
        AND sr.operator_id = c.operator_id
        AND sr.commission_amount > 0
        AND NOT o.commission_exempt
    );

  -- 2) Actualizar monto de pendientes que difieren de service_resources
  UPDATE costs c
  SET amount = sr.commission_amount,
      updated_at = now()
  FROM service_resources sr
  WHERE c.service_id = p_service_id
    AND c.category_id = v_category_id
    AND c.payment_date IS NULL
    AND c.payment_batch_id IS NULL
    AND sr.service_id = p_service_id
    AND sr.resource_type = 'operator'
    AND sr.operator_id = c.operator_id
    AND sr.commission_amount > 0
    AND c.amount IS DISTINCT FROM sr.commission_amount;

  -- 3) Crear las faltantes (operadores no exentos sin fila previa,
  --    pagada o pendiente)
  INSERT INTO costs (
    amount, category_id, service_id, operator_id,
    service_folio, date, description, subcategory, notes, crane_id
  )
  SELECT
    sr.commission_amount,
    v_category_id,
    p_service_id,
    sr.operator_id,
    v_service.folio,
    v_service.service_date,
    'Comisión ' || o.name,
    'comisiones',
    'Comisión generada automáticamente',
    v_service.crane_id
  FROM service_resources sr
  JOIN operators o ON o.id = sr.operator_id
  WHERE sr.service_id = p_service_id
    AND sr.resource_type = 'operator'
    AND sr.commission_amount > 0
    AND NOT o.commission_exempt
    AND NOT EXISTS (
      SELECT 1 FROM costs c
      WHERE c.service_id = p_service_id
        AND c.operator_id = sr.operator_id
        AND c.category_id = v_category_id
    );

  PERFORM set_config('app.commission_autoflow', 'false', true);
END;
$$;

-- Comisión manual de admin: sigue siendo un camino válido, pero ahora tiene que
-- declararse como tal ante la guarda.
CREATE OR REPLACE FUNCTION public.create_manual_commission(
  p_date date,
  p_operator_id uuid,
  p_amount numeric,
  p_description text,
  p_notes text DEFAULT NULL::text,
  p_service_folio text DEFAULT '9999'::text,
  p_crane_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_category_id uuid;
  v_cost_id uuid;
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Solo administradores pueden registrar comisiones manuales';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a cero';
  END IF;

  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RAISE EXCEPTION 'La descripción es obligatoria';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.operators WHERE id = p_operator_id) THEN
    RAISE EXCEPTION 'Operador no encontrado';
  END IF;

  SELECT id INTO v_category_id FROM public.cost_categories WHERE name = 'Comisión Operador' LIMIT 1;
  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Categoría "Comisión Operador" no encontrada';
  END IF;

  PERFORM set_config('app.commission_autoflow', 'true', true);
  PERFORM set_config('app.change_context', 'manual_commission', true);

  INSERT INTO public.costs (
    date, category_id, subcategory, operator_id, crane_id, amount, description,
    notes, service_id, service_folio, is_manual_adjustment, created_by
  ) VALUES (
    p_date, v_category_id, 'comisiones_pagadas', p_operator_id, p_crane_id, p_amount, btrim(p_description),
    p_notes, NULL, COALESCE(NULLIF(btrim(p_service_folio), ''), '9999'), true, auth.uid()
  )
  RETURNING id INTO v_cost_id;

  PERFORM set_config('app.commission_autoflow', 'false', true);

  PERFORM public.log_audit_entry(
    'costs',
    'create_manual_commission',
    NULL,
    jsonb_build_object(
      'id', v_cost_id,
      'date', p_date,
      'operator_id', p_operator_id,
      'amount', p_amount,
      'description', p_description,
      'service_folio', p_service_folio,
      'is_manual_adjustment', true
    )
  );

  RETURN v_cost_id;
END;
$$;

COMMIT;
