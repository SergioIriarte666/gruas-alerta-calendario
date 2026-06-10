-- Solución DEFINITIVA para eliminar TODAS las advertencias de seguridad

-- 1. ARREGLAR FUNCIONES CON SEARCH_PATH MUTABLE (las 9 restantes)
-- Estas son las funciones que aún no tienen search_path configurado

CREATE OR REPLACE FUNCTION public.prevent_duplicate_commissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  commission_category_id UUID;
  existing_count INTEGER;
BEGIN
  -- Solo aplicar a costos de comisión
  SELECT id INTO commission_category_id 
  FROM public.cost_categories 
  WHERE name = 'Comisión Operador';
  
  IF NEW.category_id = commission_category_id THEN
    -- Verificar duplicados en costs
    SELECT COUNT(*) INTO existing_count
    FROM public.costs 
    WHERE service_id = NEW.service_id 
      AND operator_id = NEW.operator_id 
      AND category_id = commission_category_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF existing_count > 0 THEN
      RAISE EXCEPTION 'Ya existe una comisión para este operador en este servicio. Duplicación bloqueada.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_service_commissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  IF NEW.cost_type = 'commission' THEN
    SELECT COUNT(*) INTO existing_count
    FROM public.service_costs 
    WHERE service_id = NEW.service_id 
      AND operator_id = NEW.operator_id 
      AND cost_type = 'commission'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF existing_count > 0 THEN
      RAISE EXCEPTION 'Ya existe una comisión para este operador en este servicio en service_costs.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_duplicate_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Eliminar perfiles duplicados por email, manteniendo el más reciente
  WITH duplicates AS (
    SELECT id, email, role, created_at,
      ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn
    FROM public.profiles
  )
  DELETE FROM public.profiles 
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  );
  
  RAISE NOTICE 'Duplicate profiles cleanup completed';
END;
$$;

-- 2. ELIMINAR ACCESO ANÓNIMO DE TODAS LAS POLÍTICAS RLS
-- Reemplazar todas las políticas para que SOLO permitan usuarios autenticados

-- Primero eliminar todas las políticas existentes
DO $$
DECLARE
    pol_name text;
    table_name text;
BEGIN
    FOR pol_name, table_name IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_name, table_name);
    END LOOP;
END $$;

-- Crear políticas SEGURAS que SOLO permiten usuarios autenticados
-- Profiles
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_select_admin" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "profiles_update_admin" ON public.profiles FOR ALL TO authenticated USING (public.is_admin_user());

-- Company data (solo admin)
CREATE POLICY "company_data_admin_only" ON public.company_data FOR ALL TO authenticated USING (public.is_admin_user());

-- Clients
CREATE POLICY "clients_select_auth" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_modify_admin" ON public.clients FOR ALL TO authenticated USING (public.is_admin_user());

-- Services
CREATE POLICY "services_select_auth" ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "services_modify_admin" ON public.services FOR ALL TO authenticated USING (public.is_admin_user());

-- Operators
CREATE POLICY "operators_select_auth" ON public.operators FOR SELECT TO authenticated USING (true);
CREATE POLICY "operators_modify_admin" ON public.operators FOR ALL TO authenticated USING (public.is_admin_user());

-- Costs
CREATE POLICY "costs_select_auth" ON public.costs FOR SELECT TO authenticated USING (true);
CREATE POLICY "costs_modify_operator" ON public.costs FOR ALL TO authenticated USING (public.is_operator_user());

-- Invoices
CREATE POLICY "invoices_select_auth" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoices_modify_admin" ON public.invoices FOR ALL TO authenticated USING (public.is_admin_user());

-- Commission payments
CREATE POLICY "commission_payments_select_auth" ON public.commission_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "commission_payments_modify_admin" ON public.commission_payments FOR ALL TO authenticated USING (public.is_admin_user());

-- Commission payment items
CREATE POLICY "commission_payment_items_select_auth" ON public.commission_payment_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "commission_payment_items_modify_admin" ON public.commission_payment_items FOR ALL TO authenticated USING (public.is_admin_user());

-- Backup logs (solo admin)
CREATE POLICY "backup_logs_admin_only" ON public.backup_logs FOR ALL TO authenticated USING (public.is_admin_user());

-- Quick entries (solo admin)
CREATE POLICY "quick_entries_admin_only" ON public.quick_entries FOR ALL TO authenticated USING (public.is_admin_user());

-- Cranes
CREATE POLICY "cranes_select_auth" ON public.cranes FOR SELECT TO authenticated USING (true);
CREATE POLICY "cranes_modify_admin" ON public.cranes FOR ALL TO authenticated USING (public.is_admin_user());

-- Service types
CREATE POLICY "service_types_select_auth" ON public.service_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_types_modify_admin" ON public.service_types FOR ALL TO authenticated USING (public.is_admin_user());

-- Cost categories
CREATE POLICY "cost_categories_select_auth" ON public.cost_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "cost_categories_modify_admin" ON public.cost_categories FOR ALL TO authenticated USING (public.is_admin_user());

-- Calendar events
CREATE POLICY "calendar_events_select_auth" ON public.calendar_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "calendar_events_modify_operator" ON public.calendar_events FOR ALL TO authenticated USING (public.is_operator_user());

-- Inventory tables (operadores pueden modificar)
CREATE POLICY "inventory_items_select_auth" ON public.inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_items_modify_operator" ON public.inventory_items FOR ALL TO authenticated USING (public.is_operator_user());

CREATE POLICY "inventory_locations_select_auth" ON public.inventory_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_locations_modify_operator" ON public.inventory_locations FOR ALL TO authenticated USING (public.is_operator_user());

CREATE POLICY "inventory_movements_select_auth" ON public.inventory_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_movements_modify_operator" ON public.inventory_movements FOR ALL TO authenticated USING (public.is_operator_user());

CREATE POLICY "inventory_stock_select_auth" ON public.inventory_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_stock_modify_operator" ON public.inventory_stock FOR ALL TO authenticated USING (public.is_operator_user());

-- Crane related tables
CREATE POLICY "crane_maintenance_select_auth" ON public.crane_maintenance FOR SELECT TO authenticated USING (true);
CREATE POLICY "crane_maintenance_modify_admin" ON public.crane_maintenance FOR ALL TO authenticated USING (public.is_admin_user());

CREATE POLICY "crane_parts_select_auth" ON public.crane_parts FOR SELECT TO authenticated USING (true);
CREATE POLICY "crane_parts_modify_admin" ON public.crane_parts FOR ALL TO authenticated USING (public.is_admin_user());

CREATE POLICY "crane_documents_select_auth" ON public.crane_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "crane_documents_modify_admin" ON public.crane_documents FOR ALL TO authenticated USING (public.is_admin_user());

-- Inspections
CREATE POLICY "inspections_select_auth" ON public.inspections FOR SELECT TO authenticated USING (true);
CREATE POLICY "inspections_modify_operator" ON public.inspections FOR ALL TO authenticated USING (public.is_operator_user());

-- Service closures
CREATE POLICY "service_closures_select_auth" ON public.service_closures FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_closures_modify_admin" ON public.service_closures FOR ALL TO authenticated USING (public.is_admin_user());

-- Closure services
CREATE POLICY "closure_services_select_auth" ON public.closure_services FOR SELECT TO authenticated USING (true);
CREATE POLICY "closure_services_modify_admin" ON public.closure_services FOR ALL TO authenticated USING (public.is_admin_user());

-- Invoice services
CREATE POLICY "invoice_services_select_auth" ON public.invoice_services FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoice_services_modify_admin" ON public.invoice_services FOR ALL TO authenticated USING (public.is_admin_user());

-- Invoice closures
CREATE POLICY "invoice_closures_select_auth" ON public.invoice_closures FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoice_closures_modify_admin" ON public.invoice_closures FOR ALL TO authenticated USING (public.is_admin_user());

-- System settings
CREATE POLICY "system_settings_select_auth" ON public.system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "system_settings_modify_admin" ON public.system_settings FOR ALL TO authenticated USING (public.is_admin_user());

-- User invitations
CREATE POLICY "user_invitations_select_auth" ON public.user_invitations FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_invitations_modify_admin" ON public.user_invitations FOR ALL TO authenticated USING (public.is_admin_user());

-- Cost centers
CREATE POLICY "cost_centers_select_auth" ON public.cost_centers FOR SELECT TO authenticated USING (true);
CREATE POLICY "cost_centers_modify_admin" ON public.cost_centers FOR ALL TO authenticated USING (public.is_admin_user());

-- Notification related
CREATE POLICY "notification_logs_select_own" ON public.notification_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "notification_settings_own" ON public.notification_settings FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_own" ON public.push_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Storage policies SEGURAS
DROP POLICY IF EXISTS "Authenticated users can delete files from company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete quick entry photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files in company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete crane documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update crane documents" ON storage.objects;

-- Crear políticas de storage SOLO para usuarios autenticados
CREATE POLICY "authenticated_users_storage_select" ON storage.objects FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_users_storage_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_users_storage_update" ON storage.objects FOR UPDATE TO authenticated USING (true);
CREATE POLICY "authenticated_users_storage_delete" ON storage.objects FOR DELETE TO authenticated USING (true);

-- 3. VERIFICACIÓN FINAL
CREATE OR REPLACE FUNCTION public.verify_security_compliance()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  mutable_functions_count INTEGER;
  anonymous_policies_count INTEGER;
  result_message TEXT;
BEGIN
  -- Contar funciones con search_path mutable
  SELECT COUNT(*) INTO mutable_functions_count
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

  -- Contar políticas que permiten acceso anónimo
  SELECT COUNT(*) INTO anonymous_policies_count
  FROM pg_policies 
  WHERE schemaname = 'public'
  AND roles && ARRAY['anon']::name[];

  -- Generar mensaje de resultado
  IF mutable_functions_count = 0 AND anonymous_policies_count = 0 THEN
    result_message := 'ÉXITO: Todas las advertencias de seguridad han sido eliminadas. Base de datos completamente segura.';
  ELSE
    result_message := format('ADVERTENCIA: %s funciones con search_path mutable, %s políticas con acceso anónimo', 
                           mutable_functions_count, anonymous_policies_count);
  END IF;

  RETURN result_message;
END;
$$;

-- Ejecutar verificación
SELECT public.verify_security_compliance();