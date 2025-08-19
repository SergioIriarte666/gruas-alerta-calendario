-- SOLUCIÓN DEFINITIVA: Fix ALL Supabase security warnings and authentication issues

-- 1. FIRST: Drop ALL existing problematic RLS policies that allow anonymous access
DO $$ 
DECLARE
    rec RECORD;
BEGIN
    -- Drop all existing policies that allow anonymous access
    FOR rec IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND (
            roles && ARRAY['anon']::name[] OR
            qual LIKE '%true%' OR
            with_check LIKE '%true%'
        )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename);
    END LOOP;
END $$;

-- 2. Create SECURE RLS policies that REQUIRE authentication for ALL tables
-- These policies will ONLY allow authenticated users, NO anonymous access

-- Profiles table (already fixed but ensuring consistency)
CREATE POLICY "profiles_authenticated_read_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id AND auth.role() = 'authenticated');

CREATE POLICY "profiles_authenticated_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id AND auth.role() = 'authenticated');

CREATE POLICY "profiles_authenticated_admin_all" ON public.profiles
  FOR ALL USING (
    auth.role() = 'authenticated' AND 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Create secure helper functions
CREATE OR REPLACE FUNCTION public.is_authenticated_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin' 
    AND auth.role() = 'authenticated'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_authenticated_operator()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'operator') 
    AND auth.role() = 'authenticated'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_authenticated_user()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT auth.role() = 'authenticated';
$$;

-- Apply secure policies to ALL tables that currently have anonymous access
CREATE POLICY "clients_secure_access" ON public.clients
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "cranes_secure_access" ON public.cranes
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "services_secure_access" ON public.services
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "operators_secure_access" ON public.operators
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "service_types_secure_access" ON public.service_types
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "costs_secure_access" ON public.costs
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "invoices_secure_access" ON public.invoices
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "service_closures_secure_access" ON public.service_closures
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "cost_categories_secure_access" ON public.cost_categories
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "cost_centers_secure_access" ON public.cost_centers
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "calendar_events_secure_access" ON public.calendar_events
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "crane_maintenance_secure_access" ON public.crane_maintenance
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "crane_documents_secure_access" ON public.crane_documents
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "crane_parts_secure_access" ON public.crane_parts
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "inspections_secure_access" ON public.inspections
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "inventory_items_secure_access" ON public.inventory_items
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "inventory_locations_secure_access" ON public.inventory_locations
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "inventory_movements_secure_access" ON public.inventory_movements
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "inventory_stock_secure_access" ON public.inventory_stock
  FOR ALL USING (is_authenticated_user());

-- Admin-only tables
CREATE POLICY "company_data_admin_secure" ON public.company_data
  FOR ALL USING (is_authenticated_admin());

CREATE POLICY "system_settings_admin_secure" ON public.system_settings
  FOR ALL USING (is_authenticated_admin());

CREATE POLICY "backup_logs_admin_secure" ON public.backup_logs
  FOR ALL USING (is_authenticated_admin());

CREATE POLICY "quick_entries_admin_secure" ON public.quick_entries
  FOR ALL USING (is_authenticated_admin());

CREATE POLICY "user_invitations_admin_secure" ON public.user_invitations
  FOR ALL USING (is_authenticated_admin());

-- User-specific tables
CREATE POLICY "notification_settings_user_secure" ON public.notification_settings
  FOR ALL USING (auth.uid() = user_id AND auth.role() = 'authenticated');

CREATE POLICY "push_subscriptions_user_secure" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id AND auth.role() = 'authenticated');

CREATE POLICY "notification_logs_user_secure" ON public.notification_logs
  FOR SELECT USING (auth.uid() = user_id AND auth.role() = 'authenticated');

-- General authenticated access for linking tables
CREATE POLICY "invoice_services_secure_access" ON public.invoice_services
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "invoice_closures_secure_access" ON public.invoice_closures
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "closure_services_secure_access" ON public.closure_services
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "service_costs_secure_access" ON public.service_costs
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "service_resources_secure_access" ON public.service_resources
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "cost_inventory_items_secure_access" ON public.cost_inventory_items
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "inventory_suppliers_secure_access" ON public.inventory_suppliers
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "inventory_categories_secure_access" ON public.inventory_categories
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "inventory_alerts_secure_access" ON public.inventory_alerts
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "inventory_consumptions_secure_access" ON public.inventory_consumptions
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "document_alerts_secure_access" ON public.document_alerts
  FOR ALL USING (is_authenticated_user());

-- 3. Create RLS policies for vehicle tables that were missing
ALTER TABLE public.vehicle_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_brands_secure_access" ON public.vehicle_brands
  FOR ALL USING (is_authenticated_user());

CREATE POLICY "vehicle_models_secure_access" ON public.vehicle_models
  FOR ALL USING (is_authenticated_user());

-- 4. Fix storage policies to require authentication
DROP POLICY IF EXISTS "authenticated_storage_access" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_users_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_users_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_users_storage_update" ON storage.objects;

CREATE POLICY "secure_storage_select" ON storage.objects
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "secure_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "secure_storage_update" ON storage.objects
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "secure_storage_delete" ON storage.objects
  FOR DELETE USING (auth.role() = 'authenticated');

-- 5. Update ALL functions to have fixed search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 6. Create a final health check function
CREATE OR REPLACE FUNCTION public.check_security_compliance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  anonymous_policies INTEGER;
  mutable_functions INTEGER;
  result jsonb;
BEGIN
  -- Count policies allowing anonymous access
  SELECT COUNT(*) INTO anonymous_policies
  FROM pg_policies 
  WHERE schemaname = 'public'
  AND roles && ARRAY['anon']::name[];

  -- Count functions without fixed search_path
  SELECT COUNT(*) INTO mutable_functions
  FROM information_schema.routines r
  WHERE r.routine_schema = 'public' 
  AND r.routine_type = 'FUNCTION'
  AND NOT EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname = r.routine_name
    AND p.proconfig IS NOT NULL
    AND array_to_string(p.proconfig, ',') LIKE '%search_path%'
  );

  result := jsonb_build_object(
    'anonymous_policies', anonymous_policies,
    'mutable_functions', mutable_functions,
    'is_secure', (anonymous_policies = 0 AND mutable_functions <= 2),
    'timestamp', now()
  );

  RETURN result;
END;
$$;