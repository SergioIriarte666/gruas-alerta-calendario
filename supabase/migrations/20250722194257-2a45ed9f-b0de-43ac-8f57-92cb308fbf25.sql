-- Fix security warnings without system table access and resolve naming conflicts

-- 1. Drop ALL existing policies that allow anonymous access
DO $$ 
DECLARE
    tbl_name text;
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
        'service_types', 'services', 'system_settings', 'user_invitations'
    ];
BEGIN
    -- Drop all existing policies
    FOREACH tbl_name IN ARRAY table_names
    LOOP
        FOR policy_name IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE tablename = tbl_name AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, tbl_name);
        END LOOP;
    END LOOP;
END $$;

-- 2. Create secure policies that ONLY allow authenticated users

-- Profiles table - users can see own profile, admins can see all
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

-- Company data - authenticated users can read, only admins can modify
CREATE POLICY "company_data_select_auth" ON public.company_data
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "company_data_modify_admin" ON public.company_data
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Clients - authenticated users can view, only admins can modify
CREATE POLICY "clients_select_auth" ON public.clients
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "clients_modify_admin" ON public.clients
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Services - role-based access
CREATE POLICY "services_select_auth" ON public.services
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

-- Operators - admins see all, operators see only themselves
CREATE POLICY "operators_select_auth" ON public.operators
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user() OR 
    (public.is_operator_user() AND user_id = auth.uid())
  );

CREATE POLICY "operators_modify_admin" ON public.operators
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Costs - operators can see their own, admins see all
CREATE POLICY "costs_select_auth" ON public.costs
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user() OR 
    (public.is_operator_user() AND operator_id = public.get_operator_id_by_user(auth.uid()))
  );

CREATE POLICY "costs_modify_operator" ON public.costs
  FOR ALL TO authenticated
  USING (public.is_operator_user())
  WITH CHECK (public.is_operator_user());

-- Invoices - admins and related clients can see
CREATE POLICY "invoices_select_auth" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user() OR 
    (public.is_client_user() AND client_id = public.get_user_client_id())
  );

CREATE POLICY "invoices_modify_admin" ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Commission tables
CREATE POLICY "commission_payments_select_auth" ON public.commission_payments
  FOR SELECT TO authenticated
  USING (public.is_operator_user());

CREATE POLICY "commission_payments_modify_admin" ON public.commission_payments
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "commission_payment_items_select_auth" ON public.commission_payment_items
  FOR SELECT TO authenticated
  USING (public.is_operator_user());

CREATE POLICY "commission_payment_items_modify_admin" ON public.commission_payment_items
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Notification tables
CREATE POLICY "notification_logs_select_auth" ON public.notification_logs
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

-- Admin-only tables
CREATE POLICY "backup_logs_admin_only" ON public.backup_logs
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "quick_entries_admin_only" ON public.quick_entries
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- General read-access tables for authenticated users
CREATE POLICY "cranes_select_auth" ON public.cranes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cranes_modify_admin" ON public.cranes
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "service_types_select_auth" ON public.service_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_types_modify_admin" ON public.service_types
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "cost_categories_select_auth" ON public.cost_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cost_categories_modify_admin" ON public.cost_categories
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "calendar_events_select_auth" ON public.calendar_events
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "calendar_events_modify_operator" ON public.calendar_events
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

-- Inventory tables - operators can manage, authenticated can view
CREATE POLICY "inventory_categories_select_auth" ON public.inventory_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_categories_modify_operator" ON public.inventory_categories
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "inventory_items_select_auth" ON public.inventory_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_items_modify_operator" ON public.inventory_items
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "inventory_locations_select_auth" ON public.inventory_locations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_locations_modify_operator" ON public.inventory_locations
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "inventory_movements_select_auth" ON public.inventory_movements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_movements_modify_operator" ON public.inventory_movements
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "inventory_stock_select_auth" ON public.inventory_stock
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_stock_modify_operator" ON public.inventory_stock
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "inventory_suppliers_select_auth" ON public.inventory_suppliers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_suppliers_modify_operator" ON public.inventory_suppliers
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

-- Crane related tables
CREATE POLICY "crane_documents_select_auth" ON public.crane_documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "crane_documents_modify_admin" ON public.crane_documents
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "crane_maintenance_select_auth" ON public.crane_maintenance
  FOR SELECT TO authenticated USING (public.is_operator_user());
CREATE POLICY "crane_maintenance_modify_admin" ON public.crane_maintenance
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "crane_parts_select_auth" ON public.crane_parts
  FOR SELECT TO authenticated USING (public.is_operator_user());
CREATE POLICY "crane_parts_modify_admin" ON public.crane_parts
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Service related tables
CREATE POLICY "inspections_select_auth" ON public.inspections
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inspections_modify_operator" ON public.inspections
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "service_closures_select_auth" ON public.service_closures
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_closures_modify_admin" ON public.service_closures
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "closure_services_select_auth" ON public.closure_services
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "closure_services_modify_admin" ON public.closure_services
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "invoice_services_select_auth" ON public.invoice_services
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoice_services_modify_admin" ON public.invoice_services
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "invoice_closures_select_auth" ON public.invoice_closures
  FOR SELECT TO authenticated USING (public.is_operator_user());
CREATE POLICY "invoice_closures_modify_admin" ON public.invoice_closures
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- System tables
CREATE POLICY "system_settings_select_auth" ON public.system_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "system_settings_modify_admin" ON public.system_settings
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "user_invitations_select_auth" ON public.user_invitations
  FOR SELECT TO authenticated USING (public.is_operator_user());
CREATE POLICY "user_invitations_modify_admin" ON public.user_invitations
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Additional tables
CREATE POLICY "cost_centers_select_auth" ON public.cost_centers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cost_centers_modify_admin" ON public.cost_centers
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "cost_inventory_items_select_auth" ON public.cost_inventory_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cost_inventory_items_modify_operator" ON public.cost_inventory_items
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "inventory_alerts_select_auth" ON public.inventory_alerts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_alerts_modify_operator" ON public.inventory_alerts
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "inventory_consumptions_select_auth" ON public.inventory_consumptions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_consumptions_modify_operator" ON public.inventory_consumptions
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "document_alerts_select_auth" ON public.document_alerts
  FOR SELECT TO authenticated USING (public.is_operator_user());
CREATE POLICY "document_alerts_modify_admin" ON public.document_alerts
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "service_costs_select_auth" ON public.service_costs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_costs_modify_operator" ON public.service_costs
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

CREATE POLICY "service_resources_select_auth" ON public.service_resources
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_resources_modify_operator" ON public.service_resources
  FOR ALL TO authenticated USING (public.is_operator_user()) WITH CHECK (public.is_operator_user());

-- 3. Ensure RLS is enabled on all relevant tables
DO $$
DECLARE
    tbl_name text;
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
        'service_types', 'services', 'system_settings', 'user_invitations'
    ];
BEGIN
    FOREACH tbl_name IN ARRAY table_names
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl_name AND table_schema = 'public') THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl_name);
        END IF;
    END LOOP;
END $$;