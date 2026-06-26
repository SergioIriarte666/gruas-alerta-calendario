BEGIN;

-- a) Columna para distinguir pagos manuales (bonos, ajustes, comisiones extras
-- sin service_id) de comisiones realmente huérfanas (servicio/operador eliminado).
ALTER TABLE public.costs
  ADD COLUMN IF NOT EXISTS is_manual_adjustment boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.costs.is_manual_adjustment IS
  'true para comisiones/costos manuales no vinculados a un service_id específico (pagos extras, bonos, ajustes). La auditoría no los marca como huérfanos.';

-- b) Backfill conservador: solo pagos manuales inequívocos (operador válido,
-- sin service_id, con folio placeholder o sin folio).
-- Bypass del trigger prevent_non_admin_updates_on_paid_costs: este backfill
-- corre sin sesión autenticada (migración) y solo toca la bandera de
-- clasificación, no datos financieros.
SET LOCAL app.sync_in_progress = 'true';

UPDATE public.costs c
SET is_manual_adjustment = true
FROM public.cost_categories cc
WHERE c.category_id = cc.id
  AND cc.name = 'Comisión Operador'
  AND c.service_id IS NULL
  AND c.operator_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.operators o WHERE o.id = c.operator_id)
  AND (c.service_folio IS NULL OR c.service_folio IN ('9999', '0000', '—', '-', 'N/A'))
  AND c.is_manual_adjustment = false;

-- c) audit_commission_system: mismo contrato (RETURNS jsonb, SECURITY DEFINER,
-- search_path vacío), excluye ajustes manuales del conteo de huérfanas y agrega
-- el campo 'manual_adjustments'.
CREATE OR REPLACE FUNCTION public.audit_commission_system() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
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
  manual_adjustments INTEGER;
  result jsonb;
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar auditorías';
  END IF;

  SELECT COUNT(*) INTO total_services FROM public.services;

  SELECT COUNT(*) INTO completed_services
  FROM public.services WHERE status = 'completed';

  SELECT COUNT(*) INTO services_with_operator
  FROM public.services WHERE operator_id IS NOT NULL;

  SELECT COUNT(DISTINCT service_id) INTO services_with_resources
  FROM public.service_resources WHERE resource_type = 'operator';

  SELECT COUNT(*) INTO total_commissions
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name = 'Comisión Operador';

  SELECT COUNT(*) INTO pending_commissions
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name = 'Comisión Operador'
    AND c.subcategory = 'comisiones';

  SELECT COUNT(*) INTO paid_commissions
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name = 'Comisión Operador'
    AND c.subcategory = 'comisiones_pagadas';

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

  -- Comisiones huérfanas reales: excluye ajustes manuales marcados explícitamente.
  SELECT COUNT(*) INTO orphaned_commissions
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name = 'Comisión Operador'
    AND c.is_manual_adjustment = false
    AND (c.service_id IS NULL OR c.operator_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM public.services WHERE id = c.service_id)
         OR NOT EXISTS (SELECT 1 FROM public.operators WHERE id = c.operator_id));

  SELECT COUNT(*) INTO manual_adjustments
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name = 'Comisión Operador'
    AND c.is_manual_adjustment = true;

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
    ),
    'manual_adjustments', manual_adjustments
  );

  RETURN result;
END;
$$;

-- d) list_orphan_commissions: detalle por fila con la razón real del huérfano,
-- para que la UI no asuma "servicio eliminado" en todos los casos.
CREATE OR REPLACE FUNCTION public.list_orphan_commissions()
RETURNS TABLE (
  id uuid,
  date date,
  amount numeric,
  operator_id uuid,
  operator_name text,
  service_folio text,
  description text,
  reason text
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Solo administradores pueden listar comisiones huérfanas';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.date,
    c.amount,
    c.operator_id,
    o.name AS operator_name,
    c.service_folio,
    c.description,
    CASE
      WHEN c.service_id IS NULL AND c.operator_id IS NULL THEN 'no_match'
      WHEN c.service_id IS NULL THEN 'service_id_null'
      WHEN c.operator_id IS NULL THEN 'operator_id_null'
      WHEN NOT EXISTS (SELECT 1 FROM public.services s WHERE s.id = c.service_id) THEN 'service_deleted'
      WHEN NOT EXISTS (SELECT 1 FROM public.operators op WHERE op.id = c.operator_id) THEN 'operator_deleted'
      ELSE 'no_match'
    END AS reason
  FROM public.costs c
  JOIN public.cost_categories cc ON c.category_id = cc.id
  LEFT JOIN public.operators o ON o.id = c.operator_id
  WHERE cc.name = 'Comisión Operador'
    AND c.is_manual_adjustment = false
    AND (c.service_id IS NULL OR c.operator_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM public.services s2 WHERE s2.id = c.service_id)
         OR NOT EXISTS (SELECT 1 FROM public.operators op2 WHERE op2.id = c.operator_id))
  ORDER BY c.date DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_orphan_commissions() TO authenticated;

-- e) mark_commission_manual_adjustment: acción "Marcar como pago manual" desde
-- el panel de Issues Críticos, con auditoría.
CREATE OR REPLACE FUNCTION public.mark_commission_manual_adjustment(p_cost_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_old jsonb;
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Solo administradores pueden marcar comisiones como pago manual';
  END IF;

  SELECT jsonb_build_object(
    'id', id,
    'is_manual_adjustment', is_manual_adjustment,
    'service_id', service_id,
    'operator_id', operator_id
  )
  INTO v_old
  FROM public.costs
  WHERE id = p_cost_id;

  IF v_old IS NULL THEN
    RAISE EXCEPTION 'Comisión % no encontrada', p_cost_id;
  END IF;

  UPDATE public.costs
  SET is_manual_adjustment = true
  WHERE id = p_cost_id;

  PERFORM public.log_audit_entry(
    'costs',
    'mark_manual_adjustment',
    v_old,
    jsonb_build_object('id', p_cost_id, 'is_manual_adjustment', true, 'reason', p_reason)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_commission_manual_adjustment(uuid, text) TO authenticated;

-- f) create_manual_commission: registra una comisión manual (extra/bono/ajuste)
-- sin service_id, marcada desde el origen como is_manual_adjustment=true.
CREATE OR REPLACE FUNCTION public.create_manual_commission(
  p_date date,
  p_operator_id uuid,
  p_amount numeric,
  p_description text,
  p_notes text DEFAULT NULL,
  p_service_folio text DEFAULT '9999',
  p_crane_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
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

  INSERT INTO public.costs (
    date, category_id, subcategory, operator_id, crane_id, amount, description,
    notes, service_id, service_folio, is_manual_adjustment, created_by
  ) VALUES (
    p_date, v_category_id, 'comisiones_pagadas', p_operator_id, p_crane_id, p_amount, btrim(p_description),
    p_notes, NULL, COALESCE(NULLIF(btrim(p_service_folio), ''), '9999'), true, auth.uid()
  )
  RETURNING id INTO v_cost_id;

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

GRANT EXECUTE ON FUNCTION public.create_manual_commission(date, uuid, numeric, text, text, text, uuid) TO authenticated;

COMMIT;
