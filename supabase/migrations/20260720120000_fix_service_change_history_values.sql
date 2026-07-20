BEGIN;

-- El formulario representa varios NULL de la base de datos como '' o 0. La
-- auditoria anterior comparaba esas representaciones literalmente, generando
-- cambios como "(vacio) -> (vacio)" y dejando fuera el folio.
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
    "folio": "Folio",
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
  v_old_row jsonb;
  v_new_row jsonb;
  v_field_name text;
  v_old_value text;
  v_new_value text;
  v_values_differ boolean;
  v_label text;
  v_client_name text;
  v_old_name text;
  v_new_name text;
BEGIN
  v_user_id := auth.uid();

  IF TG_OP = 'DELETE' THEN
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
    -- Comparar desde una representacion comun permite normalizar los valores
    -- del formulario antes de decidir si hubo un cambio real.
    v_old_row := to_jsonb(OLD);
    v_new_row := to_jsonb(NEW);

    FOREACH v_field_name IN ARRAY ARRAY[
      'folio', 'value', 'purchase_order', 'purchase_order_number', 'quote_number', 'status',
      'operator_commission', 'client_covered_amount', 'excess_amount', 'insured_name',
      'origin', 'destination', 'observations', 'vehicle_brand', 'vehicle_model', 'license_plate',
      'has_excess', 'outsourced_cost',
      'custody_mode', 'custody_days', 'custody_daily_rate', 'custody_start_date', 'custody_end_date',
      'custody_vehicle_type', 'custody_discount_percentage', 'custody_total_amount', 'custody_notes',
      'custody_rate_type'
    ] LOOP
      v_old_value := v_old_row ->> v_field_name;
      v_new_value := v_new_row ->> v_field_name;

      -- En campos de texto, NULL y '' representan el mismo valor visible.
      IF v_field_name = ANY (ARRAY[
        'purchase_order', 'purchase_order_number', 'quote_number', 'insured_name',
        'origin', 'destination', 'observations', 'vehicle_brand', 'vehicle_model',
        'license_plate', 'custody_vehicle_type', 'custody_notes'
      ]) THEN
        v_old_value := NULLIF(v_old_value, '');
        v_new_value := NULLIF(v_new_value, '');
      END IF;

      -- Estos campos tienen 0 como valor funcional por defecto. Algunos
      -- registros antiguos conservan NULL y el formulario los devuelve como 0.
      IF v_field_name = ANY (ARRAY[
        'operator_commission', 'outsourced_cost', 'custody_discount_percentage'
      ]) THEN
        v_values_differ := COALESCE(v_old_value::numeric, 0)
          IS DISTINCT FROM COALESCE(v_new_value::numeric, 0);
        v_old_value := COALESCE(v_old_value, '0');
        v_new_value := COALESCE(v_new_value, '0');
      ELSE
        v_values_differ := v_old_value IS DISTINCT FROM v_new_value;
      END IF;

      IF v_values_differ THEN
        v_label := COALESCE(v_field_labels->>v_field_name, v_field_name);

        INSERT INTO public.service_change_history
          (service_id, service_folio, changed_by, change_type, field_name, old_value, new_value, change_summary, event_id)
        VALUES (
          NEW.id,
          NEW.folio,
          v_user_id,
          'UPDATE',
          v_field_name,
          v_old_value,
          v_new_value,
          format('%s: %s → %s', v_label, COALESCE(v_old_value, 'vacío'), COALESCE(v_new_value, 'vacío')),
          v_event_id
        );
      END IF;
    END LOOP;

    -- Campos FK: mantener UUID en old/new y nombres legibles en el resumen.
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

GRANT ALL ON FUNCTION public.track_service_changes() TO anon;
GRANT ALL ON FUNCTION public.track_service_changes() TO authenticated;
GRANT ALL ON FUNCTION public.track_service_changes() TO service_role;

COMMIT;
