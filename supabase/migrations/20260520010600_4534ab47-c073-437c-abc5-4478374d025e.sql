
-- crane_documents: admin/operator only
DROP POLICY IF EXISTS "crane_documents_authenticated_users" ON public.crane_documents;
CREATE POLICY "crane_documents_admin_operator_all" ON public.crane_documents
  FOR ALL TO authenticated
  USING (is_admin_user_safe() OR is_operator_user_safe())
  WITH CHECK (is_admin_user_safe() OR is_operator_user_safe());

-- incomes: write restricted to admin, read for authenticated
DROP POLICY IF EXISTS "incomes_insert_authenticated" ON public.incomes;
DROP POLICY IF EXISTS "incomes_update_authenticated" ON public.incomes;
CREATE POLICY "incomes_insert_admin" ON public.incomes
  FOR INSERT TO authenticated WITH CHECK (is_admin_user_safe());
CREATE POLICY "incomes_update_admin" ON public.incomes
  FOR UPDATE TO authenticated USING (is_admin_user_safe()) WITH CHECK (is_admin_user_safe());

-- invoice_closures
DROP POLICY IF EXISTS "invoice_closures_authenticated_access" ON public.invoice_closures;
CREATE POLICY "invoice_closures_select_auth" ON public.invoice_closures
  FOR SELECT TO authenticated USING (is_authenticated_user_safe());
CREATE POLICY "invoice_closures_write_admin" ON public.invoice_closures
  FOR ALL TO authenticated USING (is_admin_user_safe()) WITH CHECK (is_admin_user_safe());

-- payment_applications
DROP POLICY IF EXISTS "payment_applications_authenticated_access" ON public.payment_applications;
CREATE POLICY "payment_applications_select_auth" ON public.payment_applications
  FOR SELECT TO authenticated USING (is_authenticated_user_safe());
CREATE POLICY "payment_applications_write_admin" ON public.payment_applications
  FOR ALL TO authenticated USING (is_admin_user_safe()) WITH CHECK (is_admin_user_safe());

-- invoice_services
DROP POLICY IF EXISTS "invoice_services_authenticated_access" ON public.invoice_services;
CREATE POLICY "invoice_services_select_auth" ON public.invoice_services
  FOR SELECT TO authenticated USING (is_authenticated_user_safe());
CREATE POLICY "invoice_services_write_admin" ON public.invoice_services
  FOR ALL TO authenticated USING (is_admin_user_safe()) WITH CHECK (is_admin_user_safe());

-- suppliers: tighten USING(true)
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar proveedores" ON public.suppliers;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar proveedores" ON public.suppliers;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar proveedores" ON public.suppliers;
CREATE POLICY "suppliers_insert_admin" ON public.suppliers
  FOR INSERT TO authenticated WITH CHECK (is_admin_user_safe());
CREATE POLICY "suppliers_update_admin" ON public.suppliers
  FOR UPDATE TO authenticated USING (is_admin_user_safe()) WITH CHECK (is_admin_user_safe());
CREATE POLICY "suppliers_delete_admin" ON public.suppliers
  FOR DELETE TO authenticated USING (is_admin_user_safe());

-- calendar_events: write to admin/operator
DROP POLICY IF EXISTS "calendar_events_authenticated_users" ON public.calendar_events;
CREATE POLICY "calendar_events_select_auth" ON public.calendar_events
  FOR SELECT TO authenticated USING (is_authenticated_user_safe());
CREATE POLICY "calendar_events_write_admin_operator" ON public.calendar_events
  FOR ALL TO authenticated
  USING (is_admin_user_safe() OR is_operator_user_safe())
  WITH CHECK (is_admin_user_safe() OR is_operator_user_safe());

-- cranes: write to admin
DROP POLICY IF EXISTS "cranes_authenticated_users" ON public.cranes;
CREATE POLICY "cranes_select_auth" ON public.cranes
  FOR SELECT TO authenticated USING (is_authenticated_user_safe());
CREATE POLICY "cranes_write_admin" ON public.cranes
  FOR ALL TO authenticated USING (is_admin_user_safe()) WITH CHECK (is_admin_user_safe());

-- crane_maintenance: operator read-only
DROP POLICY IF EXISTS "crane_maintenance_operator_access" ON public.crane_maintenance;
CREATE POLICY "crane_maintenance_operator_select" ON public.crane_maintenance
  FOR SELECT TO authenticated USING (is_operator_user_safe());

-- import_batches: restrict insert to admin/operator
DROP POLICY IF EXISTS "import_batches_insert_own" ON public.import_batches;
CREATE POLICY "import_batches_insert_admin_operator" ON public.import_batches
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (is_admin_user_safe() OR is_operator_user_safe()));
