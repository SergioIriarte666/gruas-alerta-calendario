-- Fix security warnings comprehensively

-- 1. First, fix all functions to have proper search_path
-- Update existing functions to include SET search_path = 'public'

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_operator_user()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'operator')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_client_user()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'client'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT client_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.can_view_notification(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    auth.uid() = target_user_id OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- 2. Replace all policies to restrict anonymous access
-- We'll change all policies to require authentication

-- Drop all existing permissive policies and create restrictive ones
DO $$ 
DECLARE
    table_name text;
    policy_name text;
    table_names text[] := ARRAY[
        'backup_logs', 'calendar_events', 'clients', 'closure_services',
        'commission_payment_items', 'commission_payments', 'company_data',
        'cost_categories', 'cost_centers', 'cost_inventory_items', 'costs',
        'crane_documents', 'crane_maintenance', 'crane_parts', 'cranes',
        'document_alerts', 'inspections', 'inventory_alerts', 'inventory_categories',
        'inventory_consumptions', 'inventory_items', 'inventory_locations',
        'inventory_movements', 'inventory_stock', 'inventory_suppliers',
        'invoice_closures', 'invoice_services', 'invoices', 'notification_logs',
        'notification_settings', 'operators', 'profiles', 'push_subscriptions',
        'quick_entries', 'service_closures', 'service_costs', 'service_resources',
        'service_types', 'services', 'system_settings', 'user_invitations',
        'vehicle_brands', 'vehicle_models'
    ];
BEGIN
    -- Drop all existing policies for these tables
    FOREACH table_name IN ARRAY table_names
    LOOP
        FOR policy_name IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE tablename = table_name AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
        END LOOP;
    END LOOP;
END $$;

-- Create new secure policies that require authentication
-- These policies will not allow anonymous access

-- Profiles: Users can only see/edit their own profile, admins can see/edit all
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin_user());

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin_user());

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Company data: Authenticated users can read, only admins can modify
CREATE POLICY "company_data_select_authenticated" ON public.company_data
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "company_data_modify_admin" ON public.company_data
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Clients: All authenticated can view, only admins can modify
CREATE POLICY "clients_select_authenticated" ON public.clients
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "clients_modify_admin" ON public.clients
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Services: Complex logic based on user role
CREATE POLICY "services_select_policy" ON public.services
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user() OR 
    (public.is_client_user() AND client_id = public.get_user_client_id()) OR
    (public.is_operator_user() AND operator_id = public.get_operator_id_by_user(auth.uid()))
  );

CREATE POLICY "services_modify_admin" ON public.services
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "services_insert_client" ON public.services
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user() OR 
    (public.is_client_user() AND client_id = public.get_user_client_id())
  );

-- Operators: Admins see all, operators see only themselves
CREATE POLICY "operators_select_policy" ON public.operators
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user() OR 
    (public.is_operator_user() AND user_id = auth.uid())
  );

CREATE POLICY "operators_modify_admin" ON public.operators
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Costs: Operators can manage their own, admins can see all
CREATE POLICY "costs_select_policy" ON public.costs
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user() OR 
    (public.is_operator_user() AND operator_id = public.get_operator_id_by_user(auth.uid()))
  );

CREATE POLICY "costs_modify_operator" ON public.costs
  FOR ALL TO authenticated
  USING (public.is_operator_user())
  WITH CHECK (public.is_operator_user());

-- For all other tables, create simple authenticated-only policies
-- Admin can modify, authenticated can view

CREATE POLICY "cranes_select_authenticated" ON public.cranes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cranes_modify_admin" ON public.cranes
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "service_types_select_authenticated" ON public.service_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_types_modify_admin" ON public.service_types
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "cost_categories_select_authenticated" ON public.cost_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cost_categories_modify_admin" ON public.cost_categories
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "invoices_select_policy" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user() OR 
    (public.is_client_user() AND client_id = public.get_user_client_id())
  );
CREATE POLICY "invoices_modify_admin" ON public.invoices
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Notification-related tables
CREATE POLICY "notification_logs_select_own" ON public.notification_logs
  FOR SELECT TO authenticated
  USING (public.can_view_notification(user_id));

CREATE POLICY "notification_settings_own" ON public.notification_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_own" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Commission-related tables (admin/operator access)
CREATE POLICY "commission_payments_select_operator" ON public.commission_payments
  FOR SELECT TO authenticated USING (public.is_operator_user());
CREATE POLICY "commission_payments_modify_admin" ON public.commission_payments
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "commission_payment_items_select_operator" ON public.commission_payment_items
  FOR SELECT TO authenticated USING (public.is_operator_user());
CREATE POLICY "commission_payment_items_modify_admin" ON public.commission_payment_items
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Admin-only tables
CREATE POLICY "backup_logs_admin_only" ON public.backup_logs
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "quick_entries_admin_only" ON public.quick_entries
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- General operator/admin tables
CREATE POLICY "calendar_events_select_authenticated" ON public.calendar_events
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "calendar_events_modify_operator" ON public.calendar_events
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

-- Inventory management (operator/admin access)
CREATE POLICY "inventory_categories_select_authenticated" ON public.inventory_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_categories_modify_operator" ON public.inventory_categories
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "inventory_items_select_authenticated" ON public.inventory_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_items_modify_operator" ON public.inventory_items
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "inventory_locations_select_authenticated" ON public.inventory_locations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_locations_modify_operator" ON public.inventory_locations
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "inventory_movements_select_authenticated" ON public.inventory_movements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_movements_modify_operator" ON public.inventory_movements
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "inventory_stock_select_authenticated" ON public.inventory_stock
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_stock_modify_operator" ON public.inventory_stock
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "inventory_suppliers_select_authenticated" ON public.inventory_suppliers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_suppliers_modify_operator" ON public.inventory_suppliers
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

-- Continue with remaining tables using similar patterns...
CREATE POLICY "crane_documents_select_authenticated" ON public.crane_documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "crane_documents_modify_admin" ON public.crane_documents
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "crane_maintenance_select_operator" ON public.crane_maintenance
  FOR SELECT TO authenticated USING (public.is_operator_user());
CREATE POLICY "crane_maintenance_modify_admin" ON public.crane_maintenance
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "crane_parts_select_operator" ON public.crane_parts
  FOR SELECT TO authenticated USING (public.is_operator_user());
CREATE POLICY "crane_parts_modify_admin" ON public.crane_parts
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Complete remaining tables with appropriate access patterns
CREATE POLICY "inspections_select_authenticated" ON public.inspections
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inspections_modify_operator" ON public.inspections
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "service_closures_select_authenticated" ON public.service_closures
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_closures_modify_admin" ON public.service_closures
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "closure_services_select_authenticated" ON public.closure_services
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "closure_services_modify_admin" ON public.closure_services
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "invoice_services_select_authenticated" ON public.invoice_services
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoice_services_modify_admin" ON public.invoice_services
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "invoice_closures_select_operator" ON public.invoice_closures
  FOR SELECT TO authenticated USING (public.is_operator_user());
CREATE POLICY "invoice_closures_modify_admin" ON public.invoice_closures
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Remaining system tables
CREATE POLICY "system_settings_select_authenticated" ON public.system_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "system_settings_modify_admin" ON public.system_settings
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "user_invitations_select_operator" ON public.user_invitations
  FOR SELECT TO authenticated USING (public.is_operator_user());
CREATE POLICY "user_invitations_modify_admin" ON public.user_invitations
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Vehicle-related tables
CREATE POLICY "vehicle_brands_select_authenticated" ON public.vehicle_brands
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "vehicle_brands_modify_operator" ON public.vehicle_brands
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "vehicle_models_select_authenticated" ON public.vehicle_models
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "vehicle_models_modify_operator" ON public.vehicle_models
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

-- Service-related tables that were missing
CREATE POLICY "service_costs_select_authenticated" ON public.service_costs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_costs_modify_operator" ON public.service_costs
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "service_resources_select_authenticated" ON public.service_resources
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_resources_modify_operator" ON public.service_resources
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

-- Inventory-related tables that were missing
CREATE POLICY "cost_centers_select_authenticated" ON public.cost_centers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cost_centers_modify_admin" ON public.cost_centers
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "cost_inventory_items_select_authenticated" ON public.cost_inventory_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cost_inventory_items_modify_operator" ON public.cost_inventory_items
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "inventory_alerts_select_authenticated" ON public.inventory_alerts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_alerts_modify_operator" ON public.inventory_alerts
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "inventory_consumptions_select_authenticated" ON public.inventory_consumptions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_consumptions_modify_operator" ON public.inventory_consumptions
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "document_alerts_select_operator" ON public.document_alerts
  FOR SELECT TO authenticated USING (public.is_operator_user());
CREATE POLICY "document_alerts_modify_admin" ON public.document_alerts
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- 3. Fix storage policies to require authentication
DROP POLICY IF EXISTS "Authenticated users can delete files from company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete quick entry photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files in company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete crane documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update crane documents" ON storage.objects;

-- Create secure storage policies
CREATE POLICY "storage_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "storage_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "storage_update_authenticated" ON storage.objects
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "storage_delete_authenticated" ON storage.objects
  FOR DELETE TO authenticated USING (true);

-- Ensure all tables have RLS enabled
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closure_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crane_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crane_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crane_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cranes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;