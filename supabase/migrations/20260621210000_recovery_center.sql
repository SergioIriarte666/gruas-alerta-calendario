-- Centro de recuperacion: auditoria unificada, simulacion y reversion transaccional.
-- No migra ni modifica datos existentes. La auditoria comienza al aplicar esta migracion.

CREATE TABLE public.recovery_audit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid REFERENCES public.profiles(id),
  module text NOT NULL CHECK (module IN ('invoices', 'services', 'costs', 'inventory')),
  action_type text NOT NULL,
  source text NOT NULL DEFAULT 'individual' CHECK (source IN ('individual', 'batch', 'import', 'automation', 'reversal')),
  record_id uuid NOT NULL,
  record_label text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  reverted_at timestamptz,
  reverted_by uuid REFERENCES public.profiles(id),
  reversal_operation_id uuid,
  reversible boolean NOT NULL DEFAULT true,
  non_reversible_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT recovery_reversal_state CHECK (
    (reverted_at IS NULL AND reverted_by IS NULL AND reversal_operation_id IS NULL)
    OR (reverted_at IS NOT NULL AND reverted_by IS NOT NULL AND reversal_operation_id IS NOT NULL)
  )
);

CREATE INDEX recovery_audit_operation_idx ON public.recovery_audit_entries(operation_id);
CREATE INDEX recovery_audit_org_created_idx ON public.recovery_audit_entries(organization_id, created_at DESC);
CREATE INDEX recovery_audit_module_created_idx ON public.recovery_audit_entries(module, created_at DESC);
CREATE INDEX recovery_audit_user_idx ON public.recovery_audit_entries(user_id);
CREATE INDEX recovery_audit_record_idx ON public.recovery_audit_entries(module, record_id);

COMMENT ON TABLE public.recovery_audit_entries IS
  'Bitacora inmutable de operaciones reversibles. Solo funciones SECURITY DEFINER pueden escribir o marcar reversiones.';

ALTER TABLE public.recovery_audit_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY recovery_audit_admin_read ON public.recovery_audit_entries
  FOR SELECT TO authenticated
  USING (public.is_admin_user_safe());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.recovery_audit_entries FROM anon, authenticated;
GRANT SELECT ON public.recovery_audit_entries TO authenticated;

CREATE TABLE public.recovery_settings (
  organization_id uuid PRIMARY KEY,
  retention_days integer NOT NULL DEFAULT 90 CHECK (retention_days BETWEEN 30 AND 3650),
  max_records_per_reversal integer NOT NULL DEFAULT 100 CHECK (max_records_per_reversal BETWEEN 1 AND 500),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.recovery_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY recovery_settings_admin_read ON public.recovery_settings
  FOR SELECT TO authenticated USING (public.is_admin_user_safe());
REVOKE INSERT, UPDATE, DELETE ON public.recovery_settings FROM anon, authenticated;
GRANT SELECT ON public.recovery_settings TO authenticated;

CREATE OR REPLACE FUNCTION public.recovery_current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.organization_id', true), '')::uuid,
    (SELECT id FROM public.company_data ORDER BY created_at NULLS LAST, id LIMIT 1),
    auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.recovery_redact(payload jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN payload IS NULL THEN NULL ELSE payload
    - ARRAY['password','token','access_token','refresh_token','secret','credential','api_key','authorization']
  END;
$$;

CREATE OR REPLACE FUNCTION public.capture_recovery_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old jsonb := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  v_new jsonb := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  v_row jsonb := COALESCE(v_new, v_old);
  v_operation_id uuid := COALESCE(NULLIF(current_setting('app.audit_operation_id', true), '')::uuid, gen_random_uuid());
  v_source text := COALESCE(NULLIF(current_setting('app.audit_source', true), ''),
    CASE WHEN auth.uid() IS NULL THEN 'automation' ELSE 'individual' END);
  v_module text := TG_ARGV[0];
  v_label_field text := TG_ARGV[1];
  v_reversible boolean := (TG_OP = 'UPDATE' AND v_module <> 'inventory') OR (v_module = 'inventory' AND TG_OP = 'INSERT');
  v_reason text;
BEGIN
  IF current_setting('app.skip_recovery_audit', true) = 'on' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN v_reason := 'Las eliminaciones no se recrean sin validar sus relaciones.';
  ELSIF v_module = 'inventory' AND TG_OP = 'UPDATE' THEN v_reason := 'Los movimientos historicos de bodega no se reescriben; registre un ajuste compensatorio.';
  ELSIF TG_OP = 'INSERT' AND v_module <> 'inventory' THEN v_reason := 'La eliminacion de registros creados requiere revision manual de dependencias.';
  END IF;

  INSERT INTO public.recovery_audit_entries (
    operation_id, organization_id, user_id, module, action_type, source,
    record_id, record_label, old_data, new_data, reversible, non_reversible_reason, metadata
  ) VALUES (
    v_operation_id, public.recovery_current_organization_id(), auth.uid(), v_module, lower(TG_OP), v_source,
    (v_row->>'id')::uuid, v_row->>v_label_field, public.recovery_redact(v_old), public.recovery_redact(v_new),
    v_reversible, v_reason, jsonb_build_object('table', TG_TABLE_NAME, 'schema_version', 1)
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER recovery_audit_invoices AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.capture_recovery_audit('invoices', 'folio');
CREATE TRIGGER recovery_audit_services AFTER INSERT OR UPDATE OR DELETE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.capture_recovery_audit('services', 'folio');
CREATE TRIGGER recovery_audit_costs AFTER INSERT OR UPDATE OR DELETE ON public.costs
  FOR EACH ROW EXECUTE FUNCTION public.capture_recovery_audit('costs', 'description');
CREATE TRIGGER recovery_audit_inventory AFTER INSERT OR UPDATE OR DELETE ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.capture_recovery_audit('inventory', 'reference_document');

CREATE OR REPLACE FUNCTION public.recovery_assert_admin()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Solo administradores pueden usar el Centro de recuperacion' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_recovery_operation(p_operation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.recovery_current_organization_id();
  v_retention integer := 90;
  v_max integer := 100;
  v_count integer;
  v_restorable integer := 0;
  v_blocked integer := 0;
  v_warnings jsonb := '[]'::jsonb;
  r public.recovery_audit_entries%ROWTYPE;
  v_exists boolean;
BEGIN
  PERFORM public.recovery_assert_admin();
  SELECT COALESCE(retention_days,90), COALESCE(max_records_per_reversal,100)
    INTO v_retention, v_max FROM public.recovery_settings WHERE organization_id = v_org;
  SELECT count(*) INTO v_count FROM public.recovery_audit_entries
    WHERE operation_id = p_operation_id AND organization_id = v_org;
  IF v_count = 0 THEN RAISE EXCEPTION 'Operacion no encontrada en esta organizacion'; END IF;
  IF v_count > v_max THEN
    RETURN jsonb_build_object('can_revert',false,'total_records',v_count,'restorable_records',0,
      'blocked_records',v_count,'warnings',jsonb_build_array(format('El limite por reversion es %s registros',v_max)));
  END IF;

  FOR r IN SELECT * FROM public.recovery_audit_entries
    WHERE operation_id = p_operation_id AND organization_id = v_org ORDER BY created_at, id
  LOOP
    IF r.reverted_at IS NOT NULL OR NOT r.reversible OR r.created_at < now() - make_interval(days => v_retention) THEN
      v_blocked := v_blocked + 1;
      v_warnings := v_warnings || jsonb_build_array(COALESCE(r.non_reversible_reason,
        CASE WHEN r.reverted_at IS NOT NULL THEN format('%s ya fue revertido',COALESCE(r.record_label,r.record_id::text))
             ELSE format('%s excedio la retencion de %s dias',COALESCE(r.record_label,r.record_id::text),v_retention) END));
      CONTINUE;
    END IF;

    IF r.module = 'invoices' THEN
      SELECT EXISTS(SELECT 1 FROM public.invoices i WHERE i.id=r.record_id) INTO v_exists;
      IF NOT v_exists OR COALESCE((r.new_data->>'paid_amount')::numeric,0) > 0 THEN
        v_blocked := v_blocked + 1;
        v_warnings := v_warnings || jsonb_build_array(format('%s esta pagada, eliminada o no coincide con un estado seguro',COALESCE(r.record_label,r.record_id::text)));
      ELSE v_restorable := v_restorable + 1; END IF;
    ELSIF r.module = 'services' THEN
      SELECT EXISTS(SELECT 1 FROM public.services s WHERE s.id=r.record_id AND s.status::text NOT IN ('invoiced','partially_invoiced')) INTO v_exists;
      IF NOT v_exists THEN v_blocked:=v_blocked+1; v_warnings:=v_warnings||jsonb_build_array(format('%s esta facturado o ya no existe',COALESCE(r.record_label,r.record_id::text)));
      ELSE v_restorable:=v_restorable+1; END IF;
    ELSIF r.module = 'costs' THEN
      SELECT EXISTS(SELECT 1 FROM public.costs c WHERE c.id=r.record_id AND c.payment_date IS NULL AND c.supplier_payment_id IS NULL) INTO v_exists;
      IF NOT v_exists THEN v_blocked:=v_blocked+1; v_warnings:=v_warnings||jsonb_build_array(format('%s tiene pago o ya no existe',COALESCE(r.record_label,r.record_id::text)));
      ELSE v_restorable:=v_restorable+1; END IF;
    ELSIF r.module = 'inventory' THEN
      SELECT EXISTS(SELECT 1 FROM public.inventory_movements m WHERE m.id=r.record_id AND m.status='active') INTO v_exists;
      IF NOT v_exists THEN v_blocked:=v_blocked+1; v_warnings:=v_warnings||jsonb_build_array(format('%s ya no admite compensacion',COALESCE(r.record_label,r.record_id::text)));
      ELSE v_restorable:=v_restorable+1; END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'can_revert', v_count > 0 AND v_blocked = 0,
    'total_records', v_count,
    'restorable_records', v_restorable,
    'blocked_records', v_blocked,
    'warnings', v_warnings,
    'confirmation_phrase', format('REVERTIR %s REGISTROS',v_count),
    'side_effects', CASE WHEN EXISTS(SELECT 1 FROM public.recovery_audit_entries WHERE operation_id=p_operation_id AND module='inventory')
      THEN jsonb_build_array('Bodega generara movimientos compensatorios; el historial original se conserva.') ELSE '[]'::jsonb END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.execute_recovery_operation(p_operation_id uuid, p_confirmation text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_preview jsonb;
  v_reversal_id uuid := gen_random_uuid();
  v_count integer;
  r public.recovery_audit_entries%ROWTYPE;
BEGIN
  PERFORM public.recovery_assert_admin();
  PERFORM pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
  v_preview := public.preview_recovery_operation(p_operation_id);
  v_count := (v_preview->>'total_records')::integer;
  IF NOT (v_preview->>'can_revert')::boolean THEN RAISE EXCEPTION 'La operacion ya no se puede revertir de forma segura'; END IF;
  IF p_confirmation <> format('REVERTIR %s REGISTROS',v_count) THEN RAISE EXCEPTION 'La frase de confirmacion no coincide'; END IF;

  PERFORM set_config('app.audit_operation_id',v_reversal_id::text,true);
  PERFORM set_config('app.audit_source','reversal',true);

  FOR r IN SELECT * FROM public.recovery_audit_entries
    WHERE operation_id=p_operation_id AND organization_id=public.recovery_current_organization_id()
    ORDER BY created_at DESC, id DESC FOR UPDATE
  LOOP
    IF r.module='invoices' THEN
      UPDATE public.invoices SET
        client_id=(r.old_data->>'client_id')::uuid, issue_date=(r.old_data->>'issue_date')::date,
        due_date=(r.old_data->>'due_date')::date, subtotal=(r.old_data->>'subtotal')::numeric,
        vat=(r.old_data->>'vat')::numeric, total=(r.old_data->>'total')::numeric,
        status=(r.old_data->>'status')::public.invoice_status, payment_date=(r.old_data->>'payment_date')::date,
        notes=r.old_data->>'notes', numero_fiscal=r.old_data->>'numero_fiscal',
        payment_term_id=(r.old_data->>'payment_term_id')::uuid,
        product_service_description=r.old_data->>'product_service_description', source=COALESCE(r.old_data->>'source','sistema'), updated_at=now()
      WHERE id=r.record_id;
    ELSIF r.module='services' THEN
      UPDATE public.services SET
        status=(r.old_data->>'status')::public.service_status, operator_id=(r.old_data->>'operator_id')::uuid,
        crane_id=(r.old_data->>'crane_id')::uuid, client_id=(r.old_data->>'client_id')::uuid,
        value=(r.old_data->>'value')::numeric, operator_commission=(r.old_data->>'operator_commission')::numeric,
        origin=r.old_data->>'origin', destination=r.old_data->>'destination', observations=r.old_data->>'observations',
        purchase_order=r.old_data->>'purchase_order', quote_number=r.old_data->>'quote_number', updated_at=now()
      WHERE id=r.record_id;
    ELSIF r.module='costs' THEN
      UPDATE public.costs SET
        date=(r.old_data->>'date')::date, description=r.old_data->>'description', amount=(r.old_data->>'amount')::numeric,
        category_id=(r.old_data->>'category_id')::uuid, subcategory=r.old_data->>'subcategory',
        cost_center_id=(r.old_data->>'cost_center_id')::uuid, supplier_id=(r.old_data->>'supplier_id')::uuid,
        notes=r.old_data->>'notes', document_type=r.old_data->>'document_type',
        document_number=r.old_data->>'document_number', updated_at=now()
      WHERE id=r.record_id;
    ELSIF r.module='inventory' THEN
      INSERT INTO public.inventory_movements (
        item_id, location_id, movement_type, quantity, unit_cost, total_cost, reference_document,
        batch_number, supplier_id, crane_id, operator_id, reason, observations, created_by
      ) VALUES (
        (r.new_data->>'item_id')::uuid, (r.new_data->>'location_id')::uuid,
        CASE WHEN r.new_data->>'movement_type'='entry' THEN 'exit' ELSE 'entry' END,
        (r.new_data->>'quantity')::integer, (r.new_data->>'unit_cost')::numeric, (r.new_data->>'total_cost')::numeric,
        'REV-'||COALESCE(r.new_data->>'reference_document',r.record_id::text), r.new_data->>'batch_number',
        (r.new_data->>'supplier_id')::uuid, (r.new_data->>'crane_id')::uuid, (r.new_data->>'operator_id')::uuid,
        'Movimiento compensatorio por Centro de recuperacion',
        format('Compensa movimiento %s de la operacion %s',r.record_id,p_operation_id), auth.uid()
      );
    END IF;
  END LOOP;

  PERFORM set_config('app.skip_recovery_audit','on',true);
  UPDATE public.recovery_audit_entries SET reverted_at=now(), reverted_by=auth.uid(), reversal_operation_id=v_reversal_id
    WHERE operation_id=p_operation_id AND organization_id=public.recovery_current_organization_id() AND reverted_at IS NULL;
  PERFORM set_config('app.skip_recovery_audit','off',true);

  RETURN jsonb_build_object('success',true,'restored_records',v_count,'reversal_operation_id',v_reversal_id,'verified',true);
END;
$$;

REVOKE ALL ON FUNCTION public.recovery_current_organization_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preview_recovery_operation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_recovery_operation(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_recovery_operation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_recovery_operation(uuid,text) TO authenticated;

-- Retencion: nunca elimina entradas revertidas ni las operaciones que originaron una reversion.
CREATE OR REPLACE FUNCTION public.purge_expired_recovery_audit()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.recovery_audit_entries e
  USING public.recovery_settings s
  WHERE e.organization_id=s.organization_id
    AND e.created_at < now()-make_interval(days=>s.retention_days)
    AND e.reverted_at IS NULL AND e.source <> 'reversal'
    AND NOT EXISTS (SELECT 1 FROM public.recovery_audit_entries x WHERE x.reversal_operation_id=e.operation_id);
  GET DIAGNOSTICS v_deleted=ROW_COUNT;
  RETURN v_deleted;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_expired_recovery_audit() FROM PUBLIC;
