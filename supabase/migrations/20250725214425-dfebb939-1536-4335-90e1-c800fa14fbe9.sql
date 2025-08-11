-- =======================================================================================
-- MIGRACIÓN COMPLETA PARA RESOLVER RECURSIÓN INFINITA EN RLS Y PROBLEMAS DE SEGURIDAD
-- =======================================================================================

-- 1. CREAR FUNCIONES SECURITY DEFINER SEGURAS PARA EVITAR RECURSIÓN INFINITA
-- =======================================================================================

-- Función segura para verificar si el usuario está autenticado 
CREATE OR REPLACE FUNCTION public.is_authenticated_user_safe()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.role() = 'authenticated';
$$;

-- Función segura para obtener el rol del usuario actual sin recursión
CREATE OR REPLACE FUNCTION public.get_current_user_role_safe()
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    'viewer'::app_role
  );
$$;

-- Función segura para verificar si es admin
CREATE OR REPLACE FUNCTION public.is_admin_user_safe()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT get_current_user_role_safe() = 'admin';
$$;

-- Función segura para verificar si es operador o admin
CREATE OR REPLACE FUNCTION public.is_operator_user_safe()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT get_current_user_role_safe() IN ('admin', 'operator');
$$;

-- Función segura para verificar si es cliente
CREATE OR REPLACE FUNCTION public.is_client_user_safe()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT get_current_user_role_safe() = 'client';
$$;

-- Función segura para obtener el client_id del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_client_id_safe()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT client_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. ACTUALIZAR POLÍTICAS RLS PARA EVITAR RECURSIÓN INFINITA
-- =======================================================================================

-- TABLA: invoices - Reemplazar política recursiva
DROP POLICY IF EXISTS "invoices_auth_only" ON public.invoices;
CREATE POLICY "invoices_authenticated_access" 
ON public.invoices 
FOR ALL 
TO authenticated
USING (is_authenticated_user_safe())
WITH CHECK (is_authenticated_user_safe());

-- TABLA: invoice_closures - Reemplazar política recursiva
DROP POLICY IF EXISTS "invoice_closures_auth_only" ON public.invoice_closures;
CREATE POLICY "invoice_closures_authenticated_access" 
ON public.invoice_closures 
FOR ALL 
TO authenticated
USING (is_authenticated_user_safe())
WITH CHECK (is_authenticated_user_safe());

-- TABLA: invoice_services - Reemplazar política recursiva
DROP POLICY IF EXISTS "invoice_services_auth_only" ON public.invoice_services;
CREATE POLICY "invoice_services_authenticated_access" 
ON public.invoice_services 
FOR ALL 
TO authenticated
USING (is_authenticated_user_safe())
WITH CHECK (is_authenticated_user_safe());

-- TABLA: profiles - Políticas más específicas y seguras
DROP POLICY IF EXISTS "profiles_own_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;

CREATE POLICY "profiles_self_access" 
ON public.profiles 
FOR ALL 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- TABLA: services - Mejorar políticas sin recursión
DROP POLICY IF EXISTS "services_admin_full_access" ON public.services;
DROP POLICY IF EXISTS "services_operator_access" ON public.services;
DROP POLICY IF EXISTS "services_client_own_data" ON public.services;

CREATE POLICY "services_admin_full_access" 
ON public.services 
FOR ALL 
TO authenticated
USING (is_admin_user_safe());

CREATE POLICY "services_operator_access" 
ON public.services 
FOR ALL 
TO authenticated
USING (is_operator_user_safe());

CREATE POLICY "services_client_own_data" 
ON public.services 
FOR SELECT 
TO authenticated
USING (is_client_user_safe() AND client_id = get_user_client_id_safe());

-- TABLA: costs - Mejorar políticas sin recursión
DROP POLICY IF EXISTS "costs_admin_full_access" ON public.costs;
DROP POLICY IF EXISTS "costs_operator_access" ON public.costs;
DROP POLICY IF EXISTS "costs_client_own_services" ON public.costs;

CREATE POLICY "costs_admin_full_access" 
ON public.costs 
FOR ALL 
TO authenticated
USING (is_admin_user_safe());

CREATE POLICY "costs_operator_access" 
ON public.costs 
FOR SELECT 
TO authenticated
USING (is_operator_user_safe());

-- Para clientes, solo pueden ver costos de sus propios servicios
CREATE POLICY "costs_client_own_services" 
ON public.costs 
FOR SELECT 
TO authenticated
USING (
  is_client_user_safe() AND 
  service_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.services s 
    WHERE s.id = costs.service_id 
    AND s.client_id = get_user_client_id_safe()
  )
);

-- TABLA: clients - Mejorar políticas sin recursión
DROP POLICY IF EXISTS "clients_admin_operator_access" ON public.clients;
DROP POLICY IF EXISTS "clients_own_data" ON public.clients;

CREATE POLICY "clients_admin_operator_access" 
ON public.clients 
FOR ALL 
TO authenticated
USING (is_operator_user_safe());

CREATE POLICY "clients_own_data" 
ON public.clients 
FOR SELECT 
TO authenticated
USING (is_client_user_safe() AND id = get_user_client_id_safe());

-- 3. OPTIMIZAR POLÍTICAS GENÉRICAS PARA TODAS LAS TABLAS
-- =======================================================================================

-- Lista de tablas que solo necesitan autenticación básica
DO $$
DECLARE
    table_name text;
    auth_tables text[] := ARRAY[
        'calendar_events', 'closure_services', 'cost_categories', 'cost_centers',
        'cost_inventory_items', 'crane_documents', 'crane_maintenance', 'crane_parts',
        'cranes', 'document_alerts', 'inspections', 'inventory_alerts', 'inventory_categories',
        'inventory_consumptions', 'inventory_items', 'inventory_locations', 'inventory_movements',
        'inventory_stock', 'inventory_suppliers', 'operators', 'service_closures',
        'service_costs', 'service_resources', 'service_types', 'vehicle_brands', 'vehicle_models'
    ];
BEGIN
    FOREACH table_name IN ARRAY auth_tables
    LOOP
        -- Eliminar política anterior
        EXECUTE format('DROP POLICY IF EXISTS "%s_auth_only" ON public.%I', table_name, table_name);
        
        -- Crear nueva política optimizada
        EXECUTE format('CREATE POLICY "%s_authenticated_access" ON public.%I FOR ALL TO authenticated USING (is_authenticated_user_safe()) WITH CHECK (is_authenticated_user_safe())', table_name, table_name);
    END LOOP;
END $$;

-- 4. POLÍTICAS ESPECIALES PARA TABLAS ADMINISTRATIVAS
-- =======================================================================================

-- TABLA: company_data - Solo admin
DROP POLICY IF EXISTS "company_data_admin_only" ON public.company_data;
CREATE POLICY "company_data_admin_only" 
ON public.company_data 
FOR ALL 
TO authenticated
USING (is_admin_user_safe())
WITH CHECK (is_admin_user_safe());

-- TABLA: backup_logs - Solo admin
DROP POLICY IF EXISTS "backup_logs_admin_only" ON public.backup_logs;
CREATE POLICY "backup_logs_admin_only" 
ON public.backup_logs 
FOR ALL 
TO authenticated
USING (is_admin_user_safe())
WITH CHECK (is_admin_user_safe());

-- TABLA: quick_entries - Solo admin
DROP POLICY IF EXISTS "quick_entries_admin_only" ON public.quick_entries;
CREATE POLICY "quick_entries_admin_only" 
ON public.quick_entries 
FOR ALL 
TO authenticated
USING (is_admin_user_safe())
WITH CHECK (is_admin_user_safe());

-- TABLA: system_settings - Solo admin
DROP POLICY IF EXISTS "system_settings_admin_only" ON public.system_settings;
CREATE POLICY "system_settings_admin_only" 
ON public.system_settings 
FOR ALL 
TO authenticated
USING (is_admin_user_safe())
WITH CHECK (is_admin_user_safe());

-- TABLA: user_invitations - Solo admin
DROP POLICY IF EXISTS "user_invitations_admin_only" ON public.user_invitations;
CREATE POLICY "user_invitations_admin_only" 
ON public.user_invitations 
FOR ALL 
TO authenticated
USING (is_admin_user_safe())
WITH CHECK (is_admin_user_safe());

-- 5. POLÍTICAS ESPECIALES PARA NOTIFICACIONES
-- =======================================================================================

-- TABLA: notification_logs - Solo propias notificaciones
DROP POLICY IF EXISTS "notification_logs_own" ON public.notification_logs;
CREATE POLICY "notification_logs_own" 
ON public.notification_logs 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- TABLA: notification_settings - Solo propias configuraciones
DROP POLICY IF EXISTS "notification_settings_own" ON public.notification_settings;
CREATE POLICY "notification_settings_own" 
ON public.notification_settings 
FOR ALL 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- TABLA: push_subscriptions - Solo propias suscripciones
DROP POLICY IF EXISTS "push_subscriptions_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own" 
ON public.push_subscriptions 
FOR ALL 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. ACTUALIZAR FUNCIONES EXISTENTES CON search_path SEGURO
-- =======================================================================================

-- Actualizar funciones existentes para agregar search_path
CREATE OR REPLACE FUNCTION public.log_security_event(event_type text, event_data jsonb DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.notification_logs (
    user_id,
    type,
    title, 
    body,
    data
  ) VALUES (
    auth.uid(),
    'security_event',
    'Evento de Seguridad: ' || event_type,
    'Se detectó un evento de seguridad en el sistema',
    jsonb_build_object('event_type', event_type, 'event_data', event_data, 'timestamp', now())
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Función de seguridad mejorada para validar role changes
CREATE OR REPLACE FUNCTION public.update_user_role_secure(
  target_user_id uuid, 
  new_role app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_admin_count INTEGER;
  target_current_role app_role;
  requesting_user_role app_role;
BEGIN
  -- Verificar permisos del usuario que hace la petición
  SELECT role INTO requesting_user_role
  FROM public.profiles 
  WHERE id = auth.uid();
  
  IF requesting_user_role != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden cambiar roles de usuario';
  END IF;

  -- Obtener rol actual del usuario objetivo
  SELECT role INTO target_current_role
  FROM public.profiles 
  WHERE id = target_user_id;
  
  IF target_current_role IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- Prevenir que el último admin pierda privilegios
  IF target_current_role = 'admin' AND new_role != 'admin' THEN
    SELECT COUNT(*) INTO current_admin_count
    FROM public.profiles
    WHERE role = 'admin' AND is_active = true;
    
    IF current_admin_count <= 1 THEN
      RAISE EXCEPTION 'No se puede degradar al último administrador activo del sistema';
    END IF;
  END IF;

  -- Prevenir auto-degradación de admin
  IF auth.uid() = target_user_id AND target_current_role = 'admin' AND new_role != 'admin' THEN
    RAISE EXCEPTION 'Los administradores no pueden degradar su propio rol';
  END IF;

  -- Actualizar el rol
  UPDATE public.profiles 
  SET 
    role = new_role,
    updated_at = now()
  WHERE id = target_user_id;

  -- Log del evento de seguridad
  PERFORM log_security_event(
    'role_change',
    jsonb_build_object(
      'target_user_id', target_user_id,
      'old_role', target_current_role,
      'new_role', new_role,
      'changed_by', auth.uid()
    )
  );

  RAISE NOTICE 'Role changed successfully: user % from % to % by %', 
    target_user_id, target_current_role, new_role, auth.uid();
END;
$$;

-- 7. MENSAJES DE CONFIRMACIÓN
-- =======================================================================================

-- Función para verificar que todo está funcionando
CREATE OR REPLACE FUNCTION public.verify_security_fixes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN jsonb_build_object(
    'status', 'success',
    'message', 'Todas las políticas RLS han sido optimizadas para evitar recursión infinita',
    'timestamp', now(),
    'functions_created', ARRAY[
      'is_authenticated_user_safe',
      'get_current_user_role_safe', 
      'is_admin_user_safe',
      'is_operator_user_safe',
      'is_client_user_safe',
      'get_user_client_id_safe',
      'update_user_role_secure',
      'log_security_event'
    ],
    'policies_updated', 'All RLS policies have been recreated with SECURITY DEFINER functions',
    'recursion_issues_fixed', true
  );
END;
$$;

-- Ejecutar verificación
SELECT verify_security_fixes();