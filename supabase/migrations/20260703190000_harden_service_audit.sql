BEGIN;

-- =====================================================================
-- FIX 1: el historial sobrevive al borrado del servicio
-- =====================================================================

ALTER TABLE public.service_change_history
  ADD COLUMN IF NOT EXISTS event_id uuid;

-- Backfill: agrupar entradas existentes por (service_id, changed_by, changed_at).
-- track_service_changes() usa now() (estable dentro de una transacción), así que
-- filas insertadas en la misma transacción comparten el mismo changed_at exacto —
-- agrupar por timestamp completo es más preciso que truncar a segundo.
UPDATE public.service_change_history t
SET event_id = g.event_id
FROM (
  SELECT service_id, changed_by, changed_at, gen_random_uuid() AS event_id
  FROM public.service_change_history
  GROUP BY service_id, changed_by, changed_at
) g
WHERE t.service_id = g.service_id
  AND t.changed_by IS NOT DISTINCT FROM g.changed_by
  AND t.changed_at = g.changed_at
  AND t.event_id IS NULL;

ALTER TABLE public.service_change_history
  ALTER COLUMN event_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_change_history_event_id
  ON public.service_change_history USING btree (event_id);

-- El historial deja de depender de que el servicio siga existiendo: se permite
-- service_id NULL y el FK pasa de CASCADE a SET NULL. service_folio (ya NOT NULL)
-- sigue permitiendo ubicar el historial de un servicio eliminado.
ALTER TABLE public.service_change_history
  ALTER COLUMN service_id DROP NOT NULL;

ALTER TABLE public.service_change_history
  DROP CONSTRAINT IF EXISTS service_change_history_service_id_fkey;

ALTER TABLE public.service_change_history
  ADD CONSTRAINT service_change_history_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;

-- =====================================================================
-- Helper: formateo de montos CLP sin dependencias de locale del servidor
-- =====================================================================

CREATE OR REPLACE FUNCTION public.format_clp_amount(p_value numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT regexp_replace(round(COALESCE(p_value, 0))::bigint::text, '(\d)(?=(\d{3})+(?!\d))', '\1.', 'g');
$$;

GRANT EXECUTE ON FUNCTION public.format_clp_amount(numeric) TO anon, authenticated, service_role;

-- =====================================================================
-- track_service_changes(): agrega event_id (FIX 5), resuelve nombres de FK
-- (FIX 4) y mueve el manejo de DELETE a un trigger BEFORE separado (FIX 1)
-- para poder registrar la eliminación con el servicio todavía existente.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.track_service_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $_$
DECLARE
  v_user_id uuid;
  v_event_id uuid;
  v_field_labels jsonb := '{
    "value": "Valor del Servicio",
    "purchase_order": "Orden de Compra",
    "purchase_order_number": "N° Orden de Compra",
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
    "license_plate": "Patente",
    "has_excess": "Tiene Excedente",
    "outsourced_cost": "Costo Tercerización",
    "custody_mode": "Modo de Custodia",
    "custody_days": "Días de Custodia",
    "custody_daily_rate": "Tarifa Diaria de Custodia",
    "custody_start_date": "Fecha Inicio Custodia",
    "custody_end_date": "Fecha Término Custodia",
    "custody_vehicle_type": "Tipo de Vehículo (Custodia)",
    "custody_discount_percentage": "Descuento Custodia (%)",
    "custody_total_amount": "Total Custodia",
    "custody_notes": "Notas de Custodia",
    "custody_rate_type": "Tipo de Tarifa Custodia"
  }';
  v_field_name text;
  v_old_value text;
  v_new_value text;
  v_label text;
  v_client_name text;
  v_old_name text;
  v_new_name text;
BEGIN
  v_user_id := auth.uid();

  IF TG_OP = 'DELETE' THEN
    -- Disparado como BEFORE DELETE: OLD todavía es una fila válida de services,
    -- así que el INSERT satisface el FK sin necesidad de trucos adicionales.
    v_event_id := NULLIF(current_setting('app.audit_event_id', true), '')::uuid;
    IF v_event_id IS NULL THEN
      v_event_id := gen_random_uuid();
      PERFORM set_config('app.audit_event_id', v_event_id::text, true);
    END IF;

    SELECT name INTO v_client_name FROM public.clients WHERE id = OLD.client_id;

    INSERT INTO public.service_change_history
      (service_id, service_folio, changed_by, change_type, field_name, old_value, new_value, change_summary, event_id)
    VALUES (
      OLD.id, OLD.folio, v_user_id, 'DELETE', 'servicio', NULL, NULL,
      format('Servicio eliminado — Cliente: %s, Valor: $%s, Estado: %s',
        COALESCE(v_client_name, '(sin cliente)'),
        public.format_clp_amount(OLD.value),
        COALESCE(OLD.status::text, '—')),
      v_event_id
    );
    RETURN OLD;
  END IF;

  v_event_id := NULLIF(current_setting('app.audit_event_id', true), '')::uuid;
  IF v_event_id IS NULL THEN
    v_event_id := gen_random_uuid();
    PERFORM set_config('app.audit_event_id', v_event_id::text, true);
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.service_change_history
      (service_id, service_folio, changed_by, change_type, field_name, new_value, change_summary, event_id)
    VALUES (NEW.id, NEW.folio, v_user_id, 'CREATE', 'servicio', NULL, 'Servicio creado', v_event_id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Comparar campos escalares (texto/número/fecha/booleano vía cast a texto)
    FOREACH v_field_name IN ARRAY ARRAY[
      'value', 'purchase_order', 'purchase_order_number', 'quote_number', 'status',
      'operator_commission', 'client_covered_amount', 'excess_amount', 'insured_name',
      'origin', 'destination', 'observations', 'vehicle_brand', 'vehicle_model', 'license_plate',
      'has_excess', 'outsourced_cost',
      'custody_mode', 'custody_days', 'custody_daily_rate', 'custody_start_date', 'custody_end_date',
      'custody_vehicle_type', 'custody_discount_percentage', 'custody_total_amount', 'custody_notes',
      'custody_rate_type'
    ] LOOP
      EXECUTE format('SELECT ($1).%I::TEXT, ($2).%I::TEXT', v_field_name, v_field_name)
        INTO v_old_value, v_new_value USING OLD, NEW;

      IF v_old_value IS DISTINCT FROM v_new_value THEN
        v_label := COALESCE(v_field_labels->>v_field_name, v_field_name);

        INSERT INTO public.service_change_history
          (service_id, service_folio, changed_by, change_type, field_name, old_value, new_value, change_summary, event_id)
        VALUES (NEW.id, NEW.folio, v_user_id, 'UPDATE', v_field_name, v_old_value, v_new_value,
          format('%s: %s → %s', v_label, COALESCE(v_old_value, 'vacío'), COALESCE(v_new_value, 'vacío')),
          v_event_id);
      END IF;
    END LOOP;

    -- Campos FK: resolver nombre legible en vez de UUID crudo
    IF NEW.crane_id IS DISTINCT FROM OLD.crane_id THEN
      SELECT license_plate INTO v_old_name FROM public.cranes WHERE id = OLD.crane_id;
      SELECT license_plate INTO v_new_name FROM public.cranes WHERE id = NEW.crane_id;
      INSERT INTO public.service_change_history
        (service_id, service_folio, changed_by, change_type, field_name, old_value, new_value, change_summary, event_id)
      VALUES (NEW.id, NEW.folio, v_user_id, 'UPDATE', 'crane_id', OLD.crane_id::text, NEW.crane_id::text,
        format('Grúa: %s → %s', COALESCE(v_old_name, '(sin asignar)'), COALESCE(v_new_name, '(sin asignar)')),
        v_event_id);
    END IF;

    IF NEW.operator_id IS DISTINCT FROM OLD.operator_id THEN
      SELECT name INTO v_old_name FROM public.operators WHERE id = OLD.operator_id;
      SELECT name INTO v_new_name FROM public.operators WHERE id = NEW.operator_id;
      INSERT INTO public.service_change_history
        (service_id, service_folio, changed_by, change_type, field_name, old_value, new_value, change_summary, event_id)
      VALUES (NEW.id, NEW.folio, v_user_id, 'UPDATE', 'operator_id', OLD.operator_id::text, NEW.operator_id::text,
        format('Operador: %s → %s', COALESCE(v_old_name, '(sin asignar)'), COALESCE(v_new_name, '(sin asignar)')),
        v_event_id);
    END IF;

    IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
      SELECT name INTO v_old_name FROM public.clients WHERE id = OLD.client_id;
      SELECT name INTO v_new_name FROM public.clients WHERE id = NEW.client_id;
      INSERT INTO public.service_change_history
        (service_id, service_folio, changed_by, change_type, field_name, old_value, new_value, change_summary, event_id)
      VALUES (NEW.id, NEW.folio, v_user_id, 'UPDATE', 'client_id', OLD.client_id::text, NEW.client_id::text,
        format('Cliente: %s → %s', COALESCE(v_old_name, '(sin asignar)'), COALESCE(v_new_name, '(sin asignar)')),
        v_event_id);
    END IF;

    IF NEW.service_type_id IS DISTINCT FROM OLD.service_type_id THEN
      SELECT name INTO v_old_name FROM public.service_types WHERE id = OLD.service_type_id;
      SELECT name INTO v_new_name FROM public.service_types WHERE id = NEW.service_type_id;
      INSERT INTO public.service_change_history
        (service_id, service_folio, changed_by, change_type, field_name, old_value, new_value, change_summary, event_id)
      VALUES (NEW.id, NEW.folio, v_user_id, 'UPDATE', 'service_type_id', OLD.service_type_id::text, NEW.service_type_id::text,
        format('Tipo de Servicio: %s → %s', COALESCE(v_old_name, '(sin asignar)'), COALESCE(v_new_name, '(sin asignar)')),
        v_event_id);
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$_$;

DROP TRIGGER IF EXISTS trigger_track_service_changes ON public.services;
CREATE TRIGGER trigger_track_service_changes
  AFTER INSERT OR UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.track_service_changes();

-- BEFORE DELETE: separado del trigger anterior para poder loguear con el
-- servicio todavía presente (evita el problema de FK que impedía auditar DELETE).
DROP TRIGGER IF EXISTS trigger_track_service_deletion ON public.services;
CREATE TRIGGER trigger_track_service_deletion
  BEFORE DELETE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.track_service_changes();

GRANT ALL ON FUNCTION public.track_service_changes() TO anon;
GRANT ALL ON FUNCTION public.track_service_changes() TO authenticated;
GRANT ALL ON FUNCTION public.track_service_changes() TO service_role;

-- =====================================================================
-- FIX 2: auditoría de service_items
-- =====================================================================

CREATE OR REPLACE FUNCTION public.track_service_item_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $_$
DECLARE
  v_user_id uuid;
  v_event_id uuid;
  v_service_id uuid;
  v_service_folio text;
  v_field_name text;
  v_old_detail text;
  v_new_detail text;
  v_old_qty text;
  v_new_qty text;
BEGIN
  v_user_id := auth.uid();
  v_service_id := COALESCE(NEW.service_id, OLD.service_id);

  SELECT folio INTO v_service_folio FROM public.services WHERE id = v_service_id;
  IF v_service_folio IS NULL THEN
    -- El servicio padre ya no existe: ocurre cuando el borrado del servicio
    -- cascadea a sus items. El evento "Servicio eliminado" ya cubre este caso,
    -- así que no se duplica una entrada por cada item.
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_event_id := NULLIF(current_setting('app.audit_event_id', true), '')::uuid;
  IF v_event_id IS NULL THEN
    v_event_id := gen_random_uuid();
    PERFORM set_config('app.audit_event_id', v_event_id::text, true);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_field_name := 'Item: ' || NEW.glosa;
    v_new_qty := regexp_replace(NEW.cantidad::text, '\.?0+$', '');
    v_new_detail := format('%s × $%s = $%s', v_new_qty,
      public.format_clp_amount(NEW.valor_unitario), public.format_clp_amount(NEW.cantidad * NEW.valor_unitario));

    INSERT INTO public.service_change_history
      (service_id, service_folio, changed_by, change_type, field_name, old_value, new_value, change_summary, event_id)
    VALUES (v_service_id, v_service_folio, v_user_id, 'CREATE', v_field_name, NULL, v_new_detail,
      format('%s: (nuevo) → %s', v_field_name, v_new_detail), v_event_id);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_field_name := 'Item: ' || NEW.glosa;
    v_old_qty := regexp_replace(OLD.cantidad::text, '\.?0+$', '');
    v_new_qty := regexp_replace(NEW.cantidad::text, '\.?0+$', '');
    v_old_detail := format('%s × $%s = $%s', v_old_qty,
      public.format_clp_amount(OLD.valor_unitario), public.format_clp_amount(OLD.cantidad * OLD.valor_unitario));
    v_new_detail := format('%s × $%s = $%s', v_new_qty,
      public.format_clp_amount(NEW.valor_unitario), public.format_clp_amount(NEW.cantidad * NEW.valor_unitario));

    IF v_old_detail IS DISTINCT FROM v_new_detail OR OLD.glosa IS DISTINCT FROM NEW.glosa THEN
      INSERT INTO public.service_change_history
        (service_id, service_folio, changed_by, change_type, field_name, old_value, new_value, change_summary, event_id)
      VALUES (v_service_id, v_service_folio, v_user_id, 'UPDATE', v_field_name, v_old_detail, v_new_detail,
        format('%s: %s → %s', v_field_name, v_old_detail, v_new_detail), v_event_id);
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_field_name := 'Item: ' || OLD.glosa;
    v_old_qty := regexp_replace(OLD.cantidad::text, '\.?0+$', '');
    v_old_detail := format('%s × $%s = $%s', v_old_qty,
      public.format_clp_amount(OLD.valor_unitario), public.format_clp_amount(OLD.cantidad * OLD.valor_unitario));

    INSERT INTO public.service_change_history
      (service_id, service_folio, changed_by, change_type, field_name, old_value, new_value, change_summary, event_id)
    VALUES (v_service_id, v_service_folio, v_user_id, 'DELETE', v_field_name, v_old_detail, NULL,
      format('%s: %s → (eliminado)', v_field_name, v_old_detail), v_event_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$_$;

DROP TRIGGER IF EXISTS trigger_track_service_item_changes ON public.service_items;
CREATE TRIGGER trigger_track_service_item_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.service_items
  FOR EACH ROW EXECUTE FUNCTION public.track_service_item_changes();

GRANT ALL ON FUNCTION public.track_service_item_changes() TO anon;
GRANT ALL ON FUNCTION public.track_service_item_changes() TO authenticated;
GRANT ALL ON FUNCTION public.track_service_item_changes() TO service_role;

-- =====================================================================
-- FIX 3: cerrar RLS de INSERT — solo el trigger (SECURITY DEFINER, dueño
-- postgres, que no está sujeto a RLS) puede escribir en el historial.
-- UPDATE/DELETE ya estaban negados por defecto (RLS habilitado, sin
-- políticas que los permitan); no se requiere cambio para esos.
-- =====================================================================

DROP POLICY IF EXISTS "Authenticated users can insert" ON public.service_change_history;

COMMIT;
