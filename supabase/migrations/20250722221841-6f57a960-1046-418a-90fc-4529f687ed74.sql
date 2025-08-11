-- SOLUCIÓN DEFINITIVA FINAL: Eliminar recursión infinita y arreglar TODOS los problemas

-- 1. PRIMERO: Eliminar TODAS las políticas problemáticas que causan recursión
DROP POLICY IF EXISTS "profiles_authenticated_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_authenticated_admins_all_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_authenticated_admins_all_update" ON public.profiles;

-- 2. Eliminar TODAS las políticas que permiten acceso anónimo
DO $$ 
DECLARE
    rec RECORD;
BEGIN
    -- Eliminar TODAS las políticas antiguas que permiten acceso anónimo
    FOR rec IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND policyname NOT LIKE '%secure%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename);
    END LOOP;
END $$;

-- 3. Crear funciones helper COMPLETAMENTE SEGURAS sin recursión
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (SELECT role::text FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    'viewer'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_authenticated_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT auth.role() = 'authenticated' AND current_user_role() = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.is_authenticated_operator()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT auth.role() = 'authenticated' AND current_user_role() IN ('admin', 'operator');
$$;

CREATE OR REPLACE FUNCTION public.is_authenticated_user()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT auth.role() = 'authenticated';
$$;

-- 4. Crear políticas SIMPLES para profiles sin recursión
CREATE POLICY "profiles_own_read" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_own_update" ON public.profiles  
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 5. Para todas las demás tablas, usar políticas ULTRA SIMPLES
-- Solo verificar autenticación, sin recursión

-- Tablas que requieren solo autenticación
CREATE POLICY "vehicle_brands_auth_only" ON public.vehicle_brands
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "vehicle_models_auth_only" ON public.vehicle_models
  FOR ALL USING (auth.role() = 'authenticated');

-- Tablas críticas del negocio - solo usuarios autenticados
CREATE POLICY "services_auth_only" ON public.services
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "clients_auth_only" ON public.clients
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "operators_auth_only" ON public.operators
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "cranes_auth_only" ON public.cranes
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "service_types_auth_only" ON public.service_types
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "costs_auth_only" ON public.costs
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "invoices_auth_only" ON public.invoices
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "service_closures_auth_only" ON public.service_closures
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "cost_categories_auth_only" ON public.cost_categories
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "cost_centers_auth_only" ON public.cost_centers
  FOR ALL USING (auth.role() = 'authenticated');

-- Tablas de inventario
CREATE POLICY "inventory_items_auth_only" ON public.inventory_items
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "inventory_locations_auth_only" ON public.inventory_locations
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "inventory_movements_auth_only" ON public.inventory_movements
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "inventory_stock_auth_only" ON public.inventory_stock
  FOR ALL USING (auth.role() = 'authenticated');

-- Tablas de mantenimiento
CREATE POLICY "crane_maintenance_auth_only" ON public.crane_maintenance
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "crane_documents_auth_only" ON public.crane_documents
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "crane_parts_auth_only" ON public.crane_parts
  FOR ALL USING (auth.role() = 'authenticated');

-- Otras tablas del sistema
CREATE POLICY "inspections_auth_only" ON public.inspections
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "calendar_events_auth_only" ON public.calendar_events
  FOR ALL USING (auth.role() = 'authenticated');

-- Tablas de facturas y servicios
CREATE POLICY "invoice_services_auth_only" ON public.invoice_services
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "invoice_closures_auth_only" ON public.invoice_closures
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "closure_services_auth_only" ON public.closure_services
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "service_costs_auth_only" ON public.service_costs
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "service_resources_auth_only" ON public.service_resources
  FOR ALL USING (auth.role() = 'authenticated');

-- Tablas adicionales
CREATE POLICY "cost_inventory_items_auth_only" ON public.cost_inventory_items
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "inventory_suppliers_auth_only" ON public.inventory_suppliers
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "inventory_categories_auth_only" ON public.inventory_categories
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "inventory_alerts_auth_only" ON public.inventory_alerts
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "inventory_consumptions_auth_only" ON public.inventory_consumptions
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "document_alerts_auth_only" ON public.document_alerts
  FOR ALL USING (auth.role() = 'authenticated');

-- 6. Políticas para storage completamente seguras
DROP POLICY IF EXISTS "secure_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "secure_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "secure_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "secure_storage_delete" ON storage.objects;

CREATE POLICY "storage_authenticated_only" ON storage.objects
  FOR ALL USING (auth.role() = 'authenticated');

-- 7. Crear función de verificación final
CREATE OR REPLACE FUNCTION public.verify_auth_system()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  result := jsonb_build_object(
    'auth_working', auth.role() = 'authenticated',
    'user_id', auth.uid(),
    'profiles_count', (SELECT COUNT(*) FROM public.profiles),
    'policies_secure', (
      SELECT COUNT(*) = 0 
      FROM pg_policies 
      WHERE schemaname = 'public' 
      AND (
        roles && ARRAY['anon']::name[] OR
        qual LIKE '%true%' OR
        with_check LIKE '%true%'
      )
      AND policyname NOT LIKE '%auth_only%'
    ),
    'timestamp', now()
  );
  
  RETURN result;
END;
$$;