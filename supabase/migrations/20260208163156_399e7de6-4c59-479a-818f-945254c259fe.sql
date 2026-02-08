-- Fix: deletion of a service fails because AFTER DELETE trigger tries to insert into
-- service_change_history, which has an FK to services (service already deleted).
-- We skip logging DELETE events here; history is removed anyway by ON DELETE CASCADE.

CREATE OR REPLACE FUNCTION public.track_service_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
