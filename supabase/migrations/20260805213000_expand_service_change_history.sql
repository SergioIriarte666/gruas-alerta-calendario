-- Amplía el Historial de Cambios para cubrir todos los datos de negocio
-- editables del servicio y la fuente vigente de operadores/comisiones.

BEGIN;

CREATE OR REPLACE FUNCTION public.track_service_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $_$
DECLARE
  v_user_id uuid;
  v_event_id uuid;
  v_field_labels jsonb := '{
    "folio": "Folio",
    "request_date": "Fecha de Solicitud",
    "service_date": "Fecha del Servicio",
    "start_time": "Hora de Inicio",
    "end_time": "Hora de Término",
    "crane_mileage": "Kilometraje",
    "value": "Valor del Servicio",
    "purchase_order": "Orden de Compra",
    "purchase_order_number": "N° Orden de Compra",
    "quote_number": "Número de Cotización",
    "status": "Estado",
    "client_covered_amount": "Monto Cubierto Cliente",
    "excess_amount": "Excedente",
    "insured_name": "Nombre Asegurado",
    "contact_person": "Persona en el Lugar",
    "contact_phone": "Teléfono Persona en el Lugar",
    "origin": "Origen",
    "destination": "Destino",
    "origin_lat": "Latitud de Origen",
    "origin_lng": "Longitud de Origen",
    "origin_location_source": "Fuente de Ubicación de Origen",
    "destination_lat": "Latitud de Destino",
    "destination_lng": "Longitud de Destino",
    "destination_location_source": "Fuente de Ubicación de Destino",
    "observations": "Observaciones",
    "vehicle_brand": "Marca Vehículo",
    "vehicle_model": "Modelo Vehículo",
    "license_plate": "Patente",
    "has_excess": "Tiene Excedente",
    "outsourced_cost": "Costo Tercerización",
    "outsourced_notes": "Notas de Tercerización",
    "custody_mode": "Modo de Custodia",
    "custody_days": "Días de Custodia",
    "custody_daily_rate": "Tarifa Diaria de Custodia",
    "custody_start_date": "Fecha Inicio Custodia",
    "custody_end_date": "Fecha Término Custodia",
    "custody_vehicle_type": "Tipo de Vehículo (Custodia)",
    "custody_discount_percentage": "Descuento Custodia (%)",
    "custody_total_amount": "Total Custodia",
    "custody_notes": "Notas de Custodia",
    "custody_rate_type": "Tipo de Tarifa Custodia",
    "invoice_folio": "Folio de Factura",
    "invoice_numero_fiscal": "Número Fiscal de Factura",
    "company_rut": "RUT Empresa",
    "company_name": "Empresa",
    "preferred_time": "Horario Preferido",
    "urgency": "Urgencia",
    "service_relationship_type": "Tipo de Relación",
    "client_notifications_enabled": "Notificaciones al Cliente"
  }';
  v_old_row jsonb;
  v_new_row jsonb;
  v_snapshot jsonb;
  v_field_name text;
  v_old_value text;
  v_new_value text;
  v_values_differ boolean;
  v_label text;
  v_client_name text;
  v_old_name text;
  v_new_name text;
  v_snapshot_client_name text;
  v_snapshot_crane_name text;
  v_snapshot_operator_name text;
  v_snapshot_service_type_name text;
  v_snapshot_third_party_name text;
  v_snapshot_supplier_name text;
  v_snapshot_related_folio text;
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
      (service_id, service_folio, changed_by, change_type, field_name,
       old_value, new_value, change_summary, change_context, event_id)
    VALUES (
      OLD.id, OLD.folio, v_user_id, 'DELETE', 'servicio', NULL, NULL,
      format('Servicio eliminado — Cliente: %s, Valor: $%s, Estado: %s',
        COALESCE(v_client_name, '(sin cliente)'),
        public.format_clp_amount(OLD.value),
        COALESCE(OLD.status::text, '—')),
      'service', v_event_id
    );
    RETURN OLD;
  END IF;

  v_event_id := NULLIF(current_setting('app.audit_event_id', true), '')::uuid;
  IF v_event_id IS NULL THEN
    v_event_id := gen_random_uuid();
    PERFORM set_config('app.audit_event_id', v_event_id::text, true);
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT name INTO v_snapshot_client_name FROM public.clients WHERE id = NEW.client_id;
    SELECT license_plate INTO v_snapshot_crane_name FROM public.cranes WHERE id = NEW.crane_id;
    SELECT name INTO v_snapshot_operator_name FROM public.operators WHERE id = NEW.operator_id;
    SELECT name INTO v_snapshot_service_type_name FROM public.service_types WHERE id = NEW.service_type_id;
    SELECT name INTO v_snapshot_third_party_name FROM public.clients WHERE id = NEW.third_party_client_id;
    SELECT name INTO v_snapshot_supplier_name FROM public.suppliers WHERE id = NEW.outsourced_provider_id;
    SELECT folio INTO v_snapshot_related_folio FROM public.services WHERE id = NEW.related_service_id;

    v_snapshot := jsonb_strip_nulls(jsonb_build_object(
      'folio', NEW.folio,
      'request_date', NEW.request_date,
      'service_date', NEW.service_date,
      'start_time', NEW.start_time,
      'end_time', NEW.end_time,
      'crane_mileage', NEW.crane_mileage,
      'client_id', v_snapshot_client_name,
      'service_type_id', v_snapshot_service_type_name,
      'crane_id', v_snapshot_crane_name,
      'operator_id', v_snapshot_operator_name,
      'value', NEW.value,
      'purchase_order', NEW.purchase_order,
      'purchase_order_number', NEW.purchase_order_number,
      'quote_number', NEW.quote_number,
      'status', NEW.status,
      'vehicle_brand', NEW.vehicle_brand,
      'vehicle_model', NEW.vehicle_model,
      'license_plate', NEW.license_plate,
      'origin', NEW.origin,
      'destination', NEW.destination,
      'observations', NEW.observations,
      'has_excess', NEW.has_excess,
      'client_covered_amount', NEW.client_covered_amount,
      'excess_amount', NEW.excess_amount,
      'third_party_client_id', v_snapshot_third_party_name,
      'insured_name', NEW.insured_name,
      'contact_person', NEW.contact_person,
      'contact_phone', NEW.contact_phone,
      'outsourced_provider_id', v_snapshot_supplier_name,
      'outsourced_cost', NEW.outsourced_cost,
      'outsourced_notes', NEW.outsourced_notes,
      'related_service_id', v_snapshot_related_folio,
      'service_relationship_type', NEW.service_relationship_type,
      'custody_mode', NEW.custody_mode,
      'custody_days', NEW.custody_days,
      'custody_daily_rate', NEW.custody_daily_rate,
      'custody_rate_type', NEW.custody_rate_type,
      'custody_start_date', NEW.custody_start_date,
      'custody_end_date', NEW.custody_end_date,
      'custody_vehicle_type', NEW.custody_vehicle_type,
      'custody_discount_percentage', NEW.custody_discount_percentage,
      'custody_total_amount', NEW.custody_total_amount,
      'custody_notes', NEW.custody_notes,
      'client_notifications_enabled', NEW.client_notifications_enabled
    ));

    INSERT INTO public.service_change_history
      (service_id, service_folio, changed_by, change_type, field_name,
       new_value, change_summary, change_context, event_id)
    VALUES (
      NEW.id, NEW.folio, v_user_id, 'CREATE', 'servicio',
      v_snapshot::text, 'Servicio creado', 'service', v_event_id
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old_row := to_jsonb(OLD);
    v_new_row := to_jsonb(NEW);

    -- operator_id y operator_commission se excluyen deliberadamente: son
    -- espejos heredados. La fuente vigente service_resources se audita abajo.
    FOREACH v_field_name IN ARRAY ARRAY[
      'folio', 'request_date', 'service_date', 'start_time', 'end_time', 'crane_mileage',
      'value', 'purchase_order', 'purchase_order_number', 'quote_number', 'status',
      'client_covered_amount', 'excess_amount', 'insured_name', 'contact_person', 'contact_phone',
      'origin', 'destination', 'origin_lat', 'origin_lng', 'origin_location_source',
      'destination_lat', 'destination_lng', 'destination_location_source',
      'observations', 'vehicle_brand', 'vehicle_model', 'license_plate', 'has_excess',
      'outsourced_cost', 'outsourced_notes',
      'custody_mode', 'custody_days', 'custody_daily_rate', 'custody_start_date', 'custody_end_date',
      'custody_vehicle_type', 'custody_discount_percentage', 'custody_total_amount', 'custody_notes',
      'custody_rate_type', 'invoice_folio', 'invoice_numero_fiscal', 'company_rut', 'company_name',
      'preferred_time', 'urgency', 'service_relationship_type', 'client_notifications_enabled'
    ] LOOP
      v_old_value := v_old_row ->> v_field_name;
      v_new_value := v_new_row ->> v_field_name;

      IF v_field_name = ANY (ARRAY[
        'purchase_order', 'purchase_order_number', 'quote_number', 'insured_name',
        'contact_person', 'contact_phone', 'origin', 'destination', 'observations',
        'vehicle_brand', 'vehicle_model', 'license_plate', 'origin_location_source',
        'destination_location_source', 'outsourced_notes', 'custody_vehicle_type',
        'custody_notes', 'invoice_folio', 'invoice_numero_fiscal', 'company_rut',
        'company_name', 'preferred_time', 'service_relationship_type'
      ]) THEN
        v_old_value := NULLIF(v_old_value, '');
        v_new_value := NULLIF(v_new_value, '');
      END IF;

      IF v_field_name = ANY (ARRAY[
        'outsourced_cost', 'custody_discount_percentage'
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
          (service_id, service_folio, changed_by, change_type, field_name,
           old_value, new_value, change_summary, change_context, event_id)
        VALUES (
          NEW.id, NEW.folio, v_user_id, 'UPDATE', v_field_name,
          v_old_value, v_new_value,
          format('%s: %s → %s', v_label, COALESCE(v_old_value, 'vacío'), COALESCE(v_new_value, 'vacío')),
          'service', v_event_id
        );
      END IF;
    END LOOP;

    IF NEW.crane_id IS DISTINCT FROM OLD.crane_id THEN
      SELECT license_plate INTO v_old_name FROM public.cranes WHERE id = OLD.crane_id;
      SELECT license_plate INTO v_new_name FROM public.cranes WHERE id = NEW.crane_id;
      INSERT INTO public.service_change_history
        (service_id, service_folio, changed_by, change_type, field_name,
         old_value, new_value, change_summary, change_context, event_id)
      VALUES (
        NEW.id, NEW.folio, v_user_id, 'UPDATE', 'crane_id', OLD.crane_id::text, NEW.crane_id::text,
        format('Grúa: %s → %s', COALESCE(v_old_name, '(sin asignar)'), COALESCE(v_new_name, '(sin asignar)')),
        'service', v_event_id
      );
    END IF;

    IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
      SELECT name INTO v_old_name FROM public.clients WHERE id = OLD.client_id;
      SELECT name INTO v_new_name FROM public.clients WHERE id = NEW.client_id;
      INSERT INTO public.service_change_history
        (service_id, service_folio, changed_by, change_type, field_name,
         old_value, new_value, change_summary, change_context, event_id)
      VALUES (
        NEW.id, NEW.folio, v_user_id, 'UPDATE', 'client_id', OLD.client_id::text, NEW.client_id::text,
        format('Cliente: %s → %s', COALESCE(v_old_name, '(sin asignar)'), COALESCE(v_new_name, '(sin asignar)')),
        'service', v_event_id
      );
    END IF;

    IF NEW.service_type_id IS DISTINCT FROM OLD.service_type_id THEN
      SELECT name INTO v_old_name FROM public.service_types WHERE id = OLD.service_type_id;
      SELECT name INTO v_new_name FROM public.service_types WHERE id = NEW.service_type_id;
      INSERT INTO public.service_change_history
        (service_id, service_folio, changed_by, change_type, field_name,
         old_value, new_value, change_summary, change_context, event_id)
      VALUES (
        NEW.id, NEW.folio, v_user_id, 'UPDATE', 'service_type_id', OLD.service_type_id::text, NEW.service_type_id::text,
        format('Tipo de Servicio: %s → %s', COALESCE(v_old_name, '(sin asignar)'), COALESCE(v_new_name, '(sin asignar)')),
        'service', v_event_id
      );
    END IF;

    IF NEW.third_party_client_id IS DISTINCT FROM OLD.third_party_client_id THEN
      SELECT name INTO v_old_name FROM public.clients WHERE id = OLD.third_party_client_id;
      SELECT name INTO v_new_name FROM public.clients WHERE id = NEW.third_party_client_id;
      INSERT INTO public.service_change_history
        (service_id, service_folio, changed_by, change_type, field_name,
         old_value, new_value, change_summary, change_context, event_id)
      VALUES (
        NEW.id, NEW.folio, v_user_id, 'UPDATE', 'third_party_client_id',
        OLD.third_party_client_id::text, NEW.third_party_client_id::text,
        format('Tercero que Paga Excedente: %s → %s', COALESCE(v_old_name, '(sin asignar)'), COALESCE(v_new_name, '(sin asignar)')),
        'service', v_event_id
      );
    END IF;

    IF NEW.outsourced_provider_id IS DISTINCT FROM OLD.outsourced_provider_id THEN
      SELECT name INTO v_old_name FROM public.suppliers WHERE id = OLD.outsourced_provider_id;
      SELECT name INTO v_new_name FROM public.suppliers WHERE id = NEW.outsourced_provider_id;
      INSERT INTO public.service_change_history
        (service_id, service_folio, changed_by, change_type, field_name,
         old_value, new_value, change_summary, change_context, event_id)
      VALUES (
        NEW.id, NEW.folio, v_user_id, 'UPDATE', 'outsourced_provider_id',
        OLD.outsourced_provider_id::text, NEW.outsourced_provider_id::text,
        format('Proveedor Tercerizado: %s → %s', COALESCE(v_old_name, '(sin asignar)'), COALESCE(v_new_name, '(sin asignar)')),
        'service', v_event_id
      );
    END IF;

    IF NEW.related_service_id IS DISTINCT FROM OLD.related_service_id THEN
      SELECT folio INTO v_old_name FROM public.services WHERE id = OLD.related_service_id;
      SELECT folio INTO v_new_name FROM public.services WHERE id = NEW.related_service_id;
      INSERT INTO public.service_change_history
        (service_id, service_folio, changed_by, change_type, field_name,
         old_value, new_value, change_summary, change_context, event_id)
      VALUES (
        NEW.id, NEW.folio, v_user_id, 'UPDATE', 'related_service_id',
        OLD.related_service_id::text, NEW.related_service_id::text,
        format('Servicio Relacionado: %s → %s', COALESCE(v_old_name, '(sin asignar)'), COALESCE(v_new_name, '(sin asignar)')),
        'service', v_event_id
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$_$;

REVOKE ALL ON FUNCTION public.track_service_changes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_service_changes() TO service_role;

-- service_resources es la fuente vigente para operadores, roles y comisiones.
CREATE OR REPLACE FUNCTION public.track_service_resource_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_event_id uuid;
  v_service_id uuid := COALESCE(NEW.service_id, OLD.service_id);
  v_service_folio text;
  v_old_label text;
  v_new_label text;
  v_resource_label text;
BEGIN
  SELECT folio INTO v_service_folio
  FROM public.services
  WHERE id = v_service_id;

  -- Al eliminar el servicio, su evento DELETE ya conserva el hecho contable.
  IF v_service_folio IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_event_id := NULLIF(current_setting('app.audit_event_id', true), '')::uuid;
  IF v_event_id IS NULL THEN
    v_event_id := gen_random_uuid();
    PERFORM set_config('app.audit_event_id', v_event_id::text, true);
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF OLD.resource_type = 'operator' THEN
      SELECT name INTO v_old_label FROM public.operators WHERE id = OLD.operator_id;
    ELSE
      SELECT license_plate INTO v_old_label FROM public.cranes WHERE id = OLD.crane_id;
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.resource_type = 'operator' THEN
      SELECT name INTO v_new_label FROM public.operators WHERE id = NEW.operator_id;
    ELSE
      SELECT license_plate INTO v_new_label FROM public.cranes WHERE id = NEW.crane_id;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_resource_label := CASE NEW.resource_type
      WHEN 'operator' THEN 'Operador'
      ELSE 'Grúa'
    END;

    INSERT INTO public.service_change_history
      (service_id, service_folio, changed_by, change_type, field_name,
       new_value, change_summary, change_context, event_id)
    VALUES (
      v_service_id, v_service_folio, v_user_id, 'CREATE', 'service_resource',
      COALESCE(v_new_label, '(sin identificar)'),
      CASE NEW.resource_type
        WHEN 'operator' THEN format(
          'Operador agregado: %s — Rol: %s — Comisión: $%s%s',
          COALESCE(v_new_label, '(sin identificar)'),
          COALESCE(NEW.role, 'Principal'),
          public.format_clp_amount(COALESCE(NEW.commission_amount, 0)),
          CASE WHEN COALESCE(NEW.is_primary, false) THEN ' — Principal' ELSE '' END
        )
        ELSE format('Grúa agregada: %s%s',
          COALESCE(v_new_label, '(sin identificar)'),
          CASE WHEN COALESCE(NEW.is_primary, false) THEN ' — Principal' ELSE '' END)
      END,
      'service_resource', v_event_id
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_resource_label := CASE OLD.resource_type
      WHEN 'operator' THEN 'Operador'
      ELSE 'Grúa'
    END;

    INSERT INTO public.service_change_history
      (service_id, service_folio, changed_by, change_type, field_name,
       old_value, change_summary, change_context, event_id)
    VALUES (
      v_service_id, v_service_folio, v_user_id, 'DELETE', 'service_resource',
      COALESCE(v_old_label, '(sin identificar)'),
      format('%s eliminado: %s', v_resource_label, COALESCE(v_old_label, '(sin identificar)')),
      'service_resource', v_event_id
    );
    RETURN OLD;
  END IF;

  IF NEW.resource_type IS DISTINCT FROM OLD.resource_type
     OR NEW.operator_id IS DISTINCT FROM OLD.operator_id
     OR NEW.crane_id IS DISTINCT FROM OLD.crane_id THEN
    INSERT INTO public.service_change_history
      (service_id, service_folio, changed_by, change_type, field_name,
       old_value, new_value, change_summary, change_context, event_id)
    VALUES (
      v_service_id, v_service_folio, v_user_id, 'UPDATE', 'service_resource',
      COALESCE(v_old_label, '(sin identificar)'), COALESCE(v_new_label, '(sin identificar)'),
      format('Recurso asignado: %s → %s',
        COALESCE(v_old_label, '(sin identificar)'), COALESCE(v_new_label, '(sin identificar)')),
      'service_resource', v_event_id
    );
  END IF;

  IF NEW.resource_type = 'operator'
     AND COALESCE(NEW.commission_amount, 0) IS DISTINCT FROM COALESCE(OLD.commission_amount, 0) THEN
    INSERT INTO public.service_change_history
      (service_id, service_folio, changed_by, change_type, field_name,
       old_value, new_value, change_summary, change_context, event_id)
    VALUES (
      v_service_id, v_service_folio, v_user_id, 'UPDATE', 'resource_commission',
      COALESCE(OLD.commission_amount, 0)::text, COALESCE(NEW.commission_amount, 0)::text,
      format('Comisión de %s: $%s → $%s',
        COALESCE(v_new_label, v_old_label, '(sin identificar)'),
        public.format_clp_amount(COALESCE(OLD.commission_amount, 0)),
        public.format_clp_amount(COALESCE(NEW.commission_amount, 0))),
      'service_resource', v_event_id
    );
  END IF;

  IF NEW.resource_type = 'operator'
     AND COALESCE(NEW.role, 'Principal') IS DISTINCT FROM COALESCE(OLD.role, 'Principal') THEN
    INSERT INTO public.service_change_history
      (service_id, service_folio, changed_by, change_type, field_name,
       old_value, new_value, change_summary, change_context, event_id)
    VALUES (
      v_service_id, v_service_folio, v_user_id, 'UPDATE', 'resource_role',
      COALESCE(OLD.role, 'Principal'), COALESCE(NEW.role, 'Principal'),
      format('Rol de %s: %s → %s',
        COALESCE(v_new_label, v_old_label, '(sin identificar)'),
        COALESCE(OLD.role, 'Principal'), COALESCE(NEW.role, 'Principal')),
      'service_resource', v_event_id
    );
  END IF;

  IF COALESCE(NEW.is_primary, false) IS DISTINCT FROM COALESCE(OLD.is_primary, false) THEN
    INSERT INTO public.service_change_history
      (service_id, service_folio, changed_by, change_type, field_name,
       old_value, new_value, change_summary, change_context, event_id)
    VALUES (
      v_service_id, v_service_folio, v_user_id, 'UPDATE', 'resource_primary',
      COALESCE(OLD.is_primary, false)::text, COALESCE(NEW.is_primary, false)::text,
      format('%s %s como recurso principal',
        COALESCE(v_new_label, v_old_label, '(sin identificar)'),
        CASE WHEN COALESCE(NEW.is_primary, false) THEN 'quedó' ELSE 'dejó de estar' END),
      'service_resource', v_event_id
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.track_service_resource_changes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_service_resource_changes() TO service_role;

DROP TRIGGER IF EXISTS trigger_track_service_resource_changes ON public.service_resources;
CREATE TRIGGER trigger_track_service_resource_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.service_resources
  FOR EACH ROW EXECUTE FUNCTION public.track_service_resource_changes();

COMMIT;
