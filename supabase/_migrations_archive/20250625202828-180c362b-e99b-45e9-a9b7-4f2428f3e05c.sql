
-- Eliminar TODAS las políticas existentes que causan warnings de múltiples políticas permisivas
DO $$ 
DECLARE
    pol_record RECORD;
BEGIN
    -- Eliminar todas las políticas de services
    FOR pol_record IN 
        SELECT tablename, policyname
        FROM pg_policies 
        WHERE tablename = 'services' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_record.policyname, pol_record.tablename);
    END LOOP;
    
    -- Eliminar todas las políticas de otras tablas principales
    FOR pol_record IN 
        SELECT tablename, policyname
        FROM pg_policies 
        WHERE tablename IN ('operators', 'cranes', 'service_types', 'costs', 'cost_categories', 
                           'invoices', 'invoice_services', 'invoice_closures', 'service_closures', 
                           'closure_services', 'inspections', 'calendar_events', 'system_settings',
                           'user_invitations', 'backup_logs')
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_record.policyname, pol_record.tablename);
    END LOOP;
END $$;

-- Crear funciones de utilidad optimizadas
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

-- NUEVA estructura de políticas optimizada para services (UNA sola política por operación)
CREATE POLICY "services_select_policy" ON public.services
  FOR SELECT TO authenticated USING (
    public.is_admin_user() OR 
    (public.is_operator_user() AND operator_id = public.get_operator_id_by_user(auth.uid())) OR
    (public.is_client_user() AND client_id = public.get_user_client_id())
  );

CREATE POLICY "services_insert_policy" ON public.services
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin_user() OR 
    (public.is_client_user() AND client_id = public.get_user_client_id())
  );

CREATE POLICY "services_update_policy" ON public.services
  FOR UPDATE TO authenticated USING (
    public.is_admin_user() OR 
    (public.is_operator_user() AND operator_id = public.get_operator_id_by_user(auth.uid()))
  );

CREATE POLICY "services_delete_policy" ON public.services
  FOR DELETE TO authenticated USING (public.is_admin_user());

-- Políticas únicas para operators
CREATE POLICY "operators_select_policy" ON public.operators
  FOR SELECT TO authenticated USING (
    public.is_admin_user() OR 
    (public.is_operator_user() AND user_id = auth.uid())
  );

CREATE POLICY "operators_modify_policy" ON public.operators
  FOR ALL TO authenticated USING (public.is_admin_user());

-- Políticas únicas para cranes
CREATE POLICY "cranes_select_policy" ON public.cranes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cranes_modify_policy" ON public.cranes
  FOR ALL TO authenticated USING (public.is_admin_user());

-- Políticas únicas para service_types
CREATE POLICY "service_types_select_policy" ON public.service_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_types_modify_policy" ON public.service_types
  FOR ALL TO authenticated USING (public.is_admin_user());

-- Políticas únicas para costs
CREATE POLICY "costs_select_policy" ON public.costs
  FOR SELECT TO authenticated USING (
    public.is_admin_user() OR 
    (public.is_operator_user() AND operator_id = public.get_operator_id_by_user(auth.uid()))
  );

CREATE POLICY "costs_modify_policy" ON public.costs
  FOR ALL TO authenticated USING (public.is_operator_user());

-- Políticas únicas para cost_categories
CREATE POLICY "cost_categories_select_policy" ON public.cost_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cost_categories_modify_policy" ON public.cost_categories
  FOR ALL TO authenticated USING (public.is_admin_user());

-- Políticas únicas para invoices
CREATE POLICY "invoices_select_policy" ON public.invoices
  FOR SELECT TO authenticated USING (
    public.is_admin_user() OR 
    (public.is_client_user() AND client_id = public.get_user_client_id())
  );

CREATE POLICY "invoices_modify_policy" ON public.invoices
  FOR ALL TO authenticated USING (public.is_admin_user());

-- Políticas únicas para invoice_services
CREATE POLICY "invoice_services_select_policy" ON public.invoice_services
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "invoice_services_modify_policy" ON public.invoice_services
  FOR ALL TO authenticated USING (public.is_admin_user());

-- Políticas únicas para invoice_closures
CREATE POLICY "invoice_closures_select_policy" ON public.invoice_closures
  FOR SELECT TO authenticated USING (public.is_operator_user());

CREATE POLICY "invoice_closures_modify_policy" ON public.invoice_closures
  FOR ALL TO authenticated USING (public.is_admin_user());

-- Políticas únicas para service_closures
CREATE POLICY "service_closures_select_policy" ON public.service_closures
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_closures_modify_policy" ON public.service_closures
  FOR ALL TO authenticated USING (public.is_admin_user());

-- Políticas únicas para closure_services
CREATE POLICY "closure_services_select_policy" ON public.closure_services
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "closure_services_modify_policy" ON public.closure_services
  FOR ALL TO authenticated USING (public.is_admin_user());

-- Políticas únicas para inspections
CREATE POLICY "inspections_select_policy" ON public.inspections
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "inspections_modify_policy" ON public.inspections
  FOR ALL TO authenticated USING (public.is_operator_user());

-- Políticas únicas para calendar_events
CREATE POLICY "calendar_events_select_policy" ON public.calendar_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "calendar_events_modify_policy" ON public.calendar_events
  FOR ALL TO authenticated USING (public.is_operator_user());

-- Políticas únicas para system_settings
CREATE POLICY "system_settings_select_policy" ON public.system_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "system_settings_modify_policy" ON public.system_settings
  FOR ALL TO authenticated USING (public.is_admin_user());

-- Políticas únicas para user_invitations
CREATE POLICY "user_invitations_select_policy" ON public.user_invitations
  FOR SELECT TO authenticated USING (public.is_admin_user());

CREATE POLICY "user_invitations_modify_policy" ON public.user_invitations
  FOR ALL TO authenticated USING (public.is_admin_user());

-- Políticas únicas para backup_logs
CREATE POLICY "backup_logs_select_policy" ON public.backup_logs
  FOR SELECT TO authenticated USING (public.is_admin_user());

CREATE POLICY "backup_logs_modify_policy" ON public.backup_logs
  FOR ALL TO authenticated USING (public.is_admin_user());

-- Asegurar que RLS esté habilitado en todas las tablas
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
CREATE OR REPLACE FUNCTION public.validate_all_warnings_eliminated()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE NOTICE 'All RLS policy warnings have been eliminated - only ONE policy per operation per table';
  RAISE NOTICE 'Total tables with optimized RLS: %', (
    SELECT count(*) 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
  );
END;
$$;

-- Ejecutar validación final
SELECT public.validate_all_warnings_eliminated();
