
-- ============================================================
-- 1. STANDARDIZE ROLE CHECK FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'); $$;

CREATE OR REPLACE FUNCTION public.is_operator_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'operator')); $$;

CREATE OR REPLACE FUNCTION public.is_operator_user_safe()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'operator'); $$;

-- ============================================================
-- 2. PROFILES: Block DELETE
-- ============================================================
CREATE POLICY "profiles_no_delete" ON public.profiles FOR DELETE TO public USING (false);

-- ============================================================
-- 3. INVOICES: Role-scoped
-- ============================================================
DROP POLICY IF EXISTS "invoices_authenticated_access" ON public.invoices;

CREATE POLICY "invoices_admin_full_access" ON public.invoices FOR ALL TO authenticated
USING (is_admin_user_safe()) WITH CHECK (is_admin_user_safe());

CREATE POLICY "invoices_operator_read" ON public.invoices FOR SELECT TO authenticated
USING (is_operator_user_safe() AND EXISTS (
  SELECT 1 FROM operators o
  JOIN services s ON s.client_id = invoices.client_id
  WHERE o.user_id = auth.uid()
  AND (s.operator_id = o.id OR EXISTS (SELECT 1 FROM service_resources sr WHERE sr.service_id = s.id AND sr.operator_id = o.id))
));

CREATE POLICY "invoices_client_own" ON public.invoices FOR SELECT TO authenticated
USING (is_client_user_safe() AND client_id = get_user_client_id_safe());

-- ============================================================
-- 4. PAYMENTS: Role-scoped (payments has client_id directly)
-- ============================================================
DROP POLICY IF EXISTS "payments_authenticated_access" ON public.payments;

CREATE POLICY "payments_admin_full_access" ON public.payments FOR ALL TO authenticated
USING (is_admin_user_safe()) WITH CHECK (is_admin_user_safe());

CREATE POLICY "payments_operator_read" ON public.payments FOR SELECT TO authenticated
USING (is_operator_user_safe() AND EXISTS (
  SELECT 1 FROM operators o
  JOIN services s ON s.client_id = payments.client_id
  WHERE o.user_id = auth.uid()
  AND (s.operator_id = o.id OR EXISTS (SELECT 1 FROM service_resources sr WHERE sr.service_id = s.id AND sr.operator_id = o.id))
));

CREATE POLICY "payments_client_own" ON public.payments FOR SELECT TO authenticated
USING (is_client_user_safe() AND client_id = get_user_client_id_safe());

-- ============================================================
-- 5. OPERATORS: Role-scoped
-- ============================================================
DROP POLICY IF EXISTS "operators_auth_only" ON public.operators;

CREATE POLICY "operators_admin_full_access" ON public.operators FOR ALL TO authenticated
USING (is_admin_user_safe()) WITH CHECK (is_admin_user_safe());

CREATE POLICY "operators_read_self" ON public.operators FOR SELECT TO authenticated
USING (is_operator_user_safe() AND user_id = auth.uid());

CREATE POLICY "operators_admin_operator_read_all" ON public.operators FOR SELECT TO authenticated
USING (is_admin_user_safe());

-- ============================================================
-- 6. SERVICE_RATES: Role-scoped
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view service rates" ON public.service_rates;
DROP POLICY IF EXISTS "Authenticated users can insert service rates" ON public.service_rates;
DROP POLICY IF EXISTS "Authenticated users can update service rates" ON public.service_rates;
DROP POLICY IF EXISTS "Authenticated users can delete service rates" ON public.service_rates;

CREATE POLICY "service_rates_admin_full" ON public.service_rates FOR ALL TO authenticated
USING (is_admin_user_safe()) WITH CHECK (is_admin_user_safe());

CREATE POLICY "service_rates_operator_read" ON public.service_rates FOR SELECT TO authenticated
USING (is_operator_user_safe());

CREATE POLICY "service_rates_client_own" ON public.service_rates FOR SELECT TO authenticated
USING (is_client_user_safe() AND client_id = get_user_client_id_safe());

-- ============================================================
-- 7. IMPORT_BATCH_RECORDS: Require auth + ownership
-- ============================================================
DROP POLICY IF EXISTS "import_batch_records_insert_via_functions" ON public.import_batch_records;

CREATE POLICY "import_batch_records_insert_own" ON public.import_batch_records FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM import_batches WHERE id = batch_id AND created_by = auth.uid()));

-- ============================================================
-- 8. INSPECTIONS: Admin + operator only
-- ============================================================
DROP POLICY IF EXISTS "inspections_auth_only" ON public.inspections;

CREATE POLICY "inspections_admin_full" ON public.inspections FOR ALL TO authenticated
USING (is_admin_user_safe()) WITH CHECK (is_admin_user_safe());

CREATE POLICY "inspections_operator_access" ON public.inspections FOR ALL TO authenticated
USING (is_operator_user_safe()) WITH CHECK (is_operator_user_safe());

-- ============================================================
-- 9. CRANE_MAINTENANCE: Admin + operator only
-- ============================================================
DROP POLICY IF EXISTS "crane_maintenance_auth_only" ON public.crane_maintenance;

CREATE POLICY "crane_maintenance_admin_full" ON public.crane_maintenance FOR ALL TO authenticated
USING (is_admin_user_safe()) WITH CHECK (is_admin_user_safe());

CREATE POLICY "crane_maintenance_operator_access" ON public.crane_maintenance FOR ALL TO authenticated
USING (is_operator_user_safe()) WITH CHECK (is_operator_user_safe());

-- ============================================================
-- 10. INVENTORY_SUPPLIERS: Read admin/operator, write admin
-- ============================================================
DROP POLICY IF EXISTS "inventory_suppliers_auth_only" ON public.inventory_suppliers;

CREATE POLICY "inventory_suppliers_admin_full" ON public.inventory_suppliers FOR ALL TO authenticated
USING (is_admin_user_safe()) WITH CHECK (is_admin_user_safe());

CREATE POLICY "inventory_suppliers_operator_read" ON public.inventory_suppliers FOR SELECT TO authenticated
USING (is_operator_user_safe());

-- ============================================================
-- 11. COST_SUBCATEGORIES: Write admin, read all authenticated
-- ============================================================
DROP POLICY IF EXISTS "cost_subcategories_auth_only" ON public.cost_subcategories;

CREATE POLICY "cost_subcategories_admin_write" ON public.cost_subcategories FOR ALL TO authenticated
USING (is_admin_user_safe()) WITH CHECK (is_admin_user_safe());

CREATE POLICY "cost_subcategories_read" ON public.cost_subcategories FOR SELECT TO authenticated
USING (is_authenticated_user_safe());

-- ============================================================
-- 12. CLIENTS: Restrict operator insert
-- ============================================================
DROP POLICY IF EXISTS "clients_operator_insert_only" ON public.clients;

CREATE POLICY "clients_operator_insert_restricted" ON public.clients FOR INSERT TO authenticated
WITH CHECK (is_operator_user_safe() AND created_by = auth.uid());

-- ============================================================
-- 13. STORAGE: Remove blanket policies
-- ============================================================
DROP POLICY IF EXISTS "storage_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "storage_authenticated_insert" ON storage.objects;
