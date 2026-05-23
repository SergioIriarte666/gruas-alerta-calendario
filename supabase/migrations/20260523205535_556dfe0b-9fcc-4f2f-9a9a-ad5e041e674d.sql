
-- Helper macro pattern: drop the broad "auth_only/auth_access" policies and create
-- a permissive SELECT for authenticated + admin-only (or admin/operator) write policies.

-- ============ ADMIN-ONLY WRITE TABLES ============
DO $$
DECLARE
  t text;
  admin_only_tables text[] := ARRAY[
    'closure_services','cost_categories','cost_centers','cost_inventory_items',
    'crane_consumption_rates','document_alerts','fuel_prices','routes','route_tolls',
    'service_types','supplier_invoice_items','toll_stations','toll_rates',
    'scheduled_payments','supplier_invoices','supplier_payments'
  ];
  admin_op_tables text[] := ARRAY[
    'inventory_items','inventory_stock','inventory_categories','inventory_locations',
    'inventory_alerts','inventory_consumptions','inventory_movements',
    'vehicle_brands','vehicle_models'
  ];
  pol record;
BEGIN
  -- Drop ALL existing policies on these tables (we will replace them)
  FOREACH t IN ARRAY admin_only_tables || admin_op_tables LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
  END LOOP;

  -- Admin-only write tables: authenticated SELECT, admin write
  FOREACH t IN ARRAY admin_only_tables LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      t||'_select_auth', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin_user_safe())',
      t||'_insert_admin', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_admin_user_safe()) WITH CHECK (public.is_admin_user_safe())',
      t||'_update_admin', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_admin_user_safe())',
      t||'_delete_admin', t
    );
  END LOOP;

  -- Admin/operator write tables
  FOREACH t IN ARRAY admin_op_tables LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      t||'_select_auth', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin_user_safe() OR public.is_operator_user_safe())',
      t||'_insert_staff', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_admin_user_safe() OR public.is_operator_user_safe()) WITH CHECK (public.is_admin_user_safe() OR public.is_operator_user_safe())',
      t||'_update_staff', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_admin_user_safe() OR public.is_operator_user_safe())',
      t||'_delete_staff', t
    );
  END LOOP;
END $$;

-- ============ service_costs: restrict SELECT too (no clients/viewers) ============
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='service_costs' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.service_costs', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY service_costs_select_staff ON public.service_costs
  FOR SELECT TO authenticated
  USING (public.is_admin_user_safe() OR public.is_operator_user_safe());

CREATE POLICY service_costs_insert_staff ON public.service_costs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user_safe() OR public.is_operator_user_safe());

CREATE POLICY service_costs_update_staff ON public.service_costs
  FOR UPDATE TO authenticated
  USING (public.is_admin_user_safe() OR public.is_operator_user_safe())
  WITH CHECK (public.is_admin_user_safe() OR public.is_operator_user_safe());

CREATE POLICY service_costs_delete_admin ON public.service_costs
  FOR DELETE TO authenticated
  USING (public.is_admin_user_safe());
