-- Bloquea la creación de registros operacionales/financieros asociados a grúas
-- vendidas (sold) o dadas de baja (written_off). Un solo punto de control en la
-- base cubre todos los flujos de la app (formularios, cargas XML/CSV, módulos).
--
-- Reglas:
--   - INSERT con crane_id de una grúa sold/written_off → rechazado
--   - UPDATE que CAMBIA crane_id hacia una grúa sold/written_off → rechazado
--   - UPDATE que no toca crane_id → permitido (editar historial sigue funcionando)
--   - crane_documents y document_alerts quedan fuera: la documentación de la
--     venta/baja y las alertas existentes deben poder seguir registrándose.

CREATE OR REPLACE FUNCTION public.prevent_disposed_crane_records()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.crane_status;
  v_plate text;
BEGIN
  IF NEW.crane_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- En UPDATE solo validar si la grúa referenciada cambió
  IF TG_OP = 'UPDATE' AND NEW.crane_id IS NOT DISTINCT FROM OLD.crane_id THEN
    RETURN NEW;
  END IF;

  SELECT status, license_plate INTO v_status, v_plate
  FROM public.cranes
  WHERE id = NEW.crane_id;

  IF v_status IN ('sold', 'written_off') THEN
    RAISE EXCEPTION 'La grúa % está % y no admite nuevos registros (%)',
      v_plate,
      CASE v_status WHEN 'sold' THEN 'vendida' ELSE 'dada de baja' END,
      TG_TABLE_NAME
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'services',
    'costs',
    'crane_maintenance',
    'crane_parts',
    'inventory_movements',
    'inventory_consumptions',
    'debts',
    'service_costs',
    'service_resources',
    'calendar_events',
    'supplier_payments'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_block_disposed_crane ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_block_disposed_crane
         BEFORE INSERT OR UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.prevent_disposed_crane_records()',
      t
    );
  END LOOP;
END;
$$;
