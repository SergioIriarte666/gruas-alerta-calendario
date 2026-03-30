-- Fix 2: Tighten RLS on 6 tables with overly permissive USING(true) policies
-- Replace with role-scoped policies using existing helper functions

-- 1. service_resources: restrict to admin/operator only
DROP POLICY IF EXISTS "service_resources_auth_only" ON service_resources;

CREATE POLICY "service_resources_read" ON service_resources
  FOR SELECT TO authenticated
  USING (is_admin_user_safe() OR is_operator_user_safe());

CREATE POLICY "service_resources_write" ON service_resources
  FOR ALL TO authenticated
  USING (is_admin_user_safe())
  WITH CHECK (is_admin_user_safe());

-- 2. service_closures: admin only
DROP POLICY IF EXISTS "service_closures_authenticated_access" ON service_closures;

CREATE POLICY "service_closures_read" ON service_closures
  FOR SELECT TO authenticated
  USING (is_admin_user_safe() OR is_operator_user_safe());

CREATE POLICY "service_closures_write" ON service_closures
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_user_safe());

CREATE POLICY "service_closures_update" ON service_closures
  FOR UPDATE TO authenticated
  USING (is_admin_user_safe())
  WITH CHECK (is_admin_user_safe());

CREATE POLICY "service_closures_delete" ON service_closures
  FOR DELETE TO authenticated
  USING (is_admin_user_safe());

-- 3. saved_locations: all authenticated can read, admin can write
DROP POLICY IF EXISTS "saved_locations_auth_only" ON saved_locations;

CREATE POLICY "saved_locations_read" ON saved_locations
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "saved_locations_write" ON saved_locations
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_user_safe() OR is_operator_user_safe());

CREATE POLICY "saved_locations_update" ON saved_locations
  FOR UPDATE TO authenticated
  USING (is_admin_user_safe() OR is_operator_user_safe())
  WITH CHECK (is_admin_user_safe() OR is_operator_user_safe());

CREATE POLICY "saved_locations_delete" ON saved_locations
  FOR DELETE TO authenticated
  USING (is_admin_user_safe());

-- 4. trip_estimates: all authenticated can read, admin/operator can write
DROP POLICY IF EXISTS "trip_estimates_auth_only" ON trip_estimates;

CREATE POLICY "trip_estimates_read" ON trip_estimates
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "trip_estimates_write" ON trip_estimates
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_user_safe() OR is_operator_user_safe());

CREATE POLICY "trip_estimates_update" ON trip_estimates
  FOR UPDATE TO authenticated
  USING (is_admin_user_safe() OR is_operator_user_safe())
  WITH CHECK (is_admin_user_safe() OR is_operator_user_safe());

CREATE POLICY "trip_estimates_delete" ON trip_estimates
  FOR DELETE TO authenticated
  USING (is_admin_user_safe());

-- 5. payment_terms: all can read, admin only can write
DROP POLICY IF EXISTS "payment_terms_authenticated_access" ON payment_terms;

CREATE POLICY "payment_terms_read" ON payment_terms
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "payment_terms_write" ON payment_terms
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_user_safe());

CREATE POLICY "payment_terms_update" ON payment_terms
  FOR UPDATE TO authenticated
  USING (is_admin_user_safe())
  WITH CHECK (is_admin_user_safe());

CREATE POLICY "payment_terms_delete" ON payment_terms
  FOR DELETE TO authenticated
  USING (is_admin_user_safe());

-- 6. supplier_categories: all can read, admin only can write
DROP POLICY IF EXISTS "supplier_categories_authenticated_access" ON supplier_categories;

CREATE POLICY "supplier_categories_read" ON supplier_categories
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "supplier_categories_write" ON supplier_categories
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_user_safe());

CREATE POLICY "supplier_categories_update" ON supplier_categories
  FOR UPDATE TO authenticated
  USING (is_admin_user_safe())
  WITH CHECK (is_admin_user_safe());

CREATE POLICY "supplier_categories_delete" ON supplier_categories
  FOR DELETE TO authenticated
  USING (is_admin_user_safe());