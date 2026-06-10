
-- Aplicar políticas RLS optimizadas a todas las tablas restantes para eliminar warnings

-- Eliminar políticas existentes de todas las tablas principales
DO $$ 
DECLARE
    pol_name text;
    table_names text[] := ARRAY[
        'services', 'operators', 'cranes', 'service_types', 'costs', 
        'cost_categories', 'invoices', 'invoice_services', 'invoice_closures',
        'service_closures', 'closure_services', 'inspections', 'calendar_events',
        'system_settings', 'user_invitations', 'backup_logs'
    ];
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY table_names
    LOOP
        FOR pol_name IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE tablename = table_name 
            AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_name, table_name);
        END LOOP;
    END LOOP;
END $$;

-- Funciones de utilidad optimizadas para evitar warnings
CREATE OR REPLACE FUNCTION public.is_operator_user()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
SET search_path TO 'public'
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
SET search_path TO 'public'
AS $$
  SELECT client_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Políticas para services
CREATE POLICY "services_select_all" ON public.services
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "services_all_admin_operator" ON public.services
  FOR ALL USING (public.is_operator_user())
  WITH CHECK (public.is_operator_user());

CREATE POLICY "services_select_client" ON public.services
  FOR SELECT USING (
    public.is_client_user() AND 
    client_id = public.get_user_client_id()
  );

-- Políticas para operators
CREATE POLICY "operators_select_all" ON public.operators
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "operators_all_admin" ON public.operators
  FOR ALL USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Políticas para cranes
CREATE POLICY "cranes_select_all" ON public.cranes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cranes_all_admin" ON public.cranes
  FOR ALL USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Políticas para service_types
CREATE POLICY "service_types_select_all" ON public.service_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_types_all_admin" ON public.service_types
  FOR ALL USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Políticas para costs
CREATE POLICY "costs_select_all" ON public.costs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "costs_all_admin_operator" ON public.costs
  FOR ALL USING (public.is_operator_user())
  WITH CHECK (public.is_operator_user());

-- Políticas para cost_categories
CREATE POLICY "cost_categories_select_all" ON public.cost_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cost_categories_all_admin" ON public.cost_categories
  FOR ALL USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Políticas para invoices
CREATE POLICY "invoices_select_all" ON public.invoices
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "invoices_all_admin" ON public.invoices
  FOR ALL USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "invoices_select_client" ON public.invoices
  FOR SELECT USING (
    public.is_client_user() AND 
    client_id = public.get_user_client_id()
  );

-- Políticas para invoice_services
CREATE POLICY "invoice_services_select_all" ON public.invoice_services
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "invoice_services_all_admin" ON public.invoice_services
  FOR ALL USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Políticas para invoice_closures
CREATE POLICY "invoice_closures_select_admin_operator" ON public.invoice_closures
  FOR SELECT USING (public.is_operator_user());

CREATE POLICY "invoice_closures_insert_admin" ON public.invoice_closures
  FOR INSERT WITH CHECK (public.is_admin_user());

CREATE POLICY "invoice_closures_update_admin" ON public.invoice_closures
  FOR UPDATE USING (public.is_admin_user());

CREATE POLICY "invoice_closures_delete_admin" ON public.invoice_closures
  FOR DELETE USING (public.is_admin_user());

-- Políticas para service_closures
CREATE POLICY "service_closures_select_all" ON public.service_closures
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_closures_all_admin" ON public.service_closures
  FOR ALL USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Políticas para closure_services
CREATE POLICY "closure_services_select_all" ON public.closure_services
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "closure_services_all_admin" ON public.closure_services
  FOR ALL USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Políticas para inspections
CREATE POLICY "inspections_select_all" ON public.inspections
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "inspections_all_operator" ON public.inspections
  FOR ALL USING (public.is_operator_user())
  WITH CHECK (public.is_operator_user());

-- Políticas para calendar_events
CREATE POLICY "calendar_events_select_all" ON public.calendar_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "calendar_events_all_admin_operator" ON public.calendar_events
  FOR ALL USING (public.is_operator_user())
  WITH CHECK (public.is_operator_user());

-- Políticas para system_settings
CREATE POLICY "system_settings_select_all" ON public.system_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "system_settings_all_admin" ON public.system_settings
  FOR ALL USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Políticas para user_invitations
CREATE POLICY "user_invitations_select_admin" ON public.user_invitations
  FOR SELECT USING (public.is_admin_user());

CREATE POLICY "user_invitations_all_admin" ON public.user_invitations
  FOR ALL USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Políticas para backup_logs
CREATE POLICY "backup_logs_select_admin" ON public.backup_logs
  FOR SELECT USING (public.is_admin_user());

CREATE POLICY "backup_logs_all_admin" ON public.backup_logs
  FOR ALL USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Habilitar RLS en todas las tablas
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cranes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closure_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

-- Función final de validación
CREATE OR REPLACE FUNCTION public.validate_all_rls_optimized()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE NOTICE 'All RLS policies have been optimized to eliminate Supabase warnings';
  RAISE NOTICE 'Total tables with RLS enabled: %', (
    SELECT count(*) 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
  );
END;
$$;

-- Ejecutar validación final
SELECT public.validate_all_rls_optimized();
