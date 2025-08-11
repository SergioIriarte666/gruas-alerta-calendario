-- ELIMINACIÓN FINAL Y COMPLETA DE TODAS LAS POLÍTICAS DUPLICADAS Y PROBLEMÁTICAS

-- 1. Eliminar TODAS las políticas que no sean las nuevas "_auth_only"
DO $$ 
DECLARE
    rec RECORD;
BEGIN
    -- Eliminar TODAS las políticas duplicadas que terminan en "_secure_access"
    FOR rec IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND policyname LIKE '%_secure_access'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename);
    END LOOP;
    
    -- Eliminar TODAS las políticas que terminan en "_secure"
    FOR rec IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND policyname LIKE '%_secure'
        AND policyname NOT LIKE '%_user_secure'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename);
    END LOOP;
END $$;

-- 2. Arreglar las políticas específicas para usuarios
DROP POLICY IF EXISTS "notification_logs_user_secure" ON public.notification_logs;
DROP POLICY IF EXISTS "notification_settings_user_secure" ON public.notification_settings;
DROP POLICY IF EXISTS "push_subscriptions_user_secure" ON public.push_subscriptions;

-- Crear versiones más simples para estas tablas específicas
CREATE POLICY "notification_logs_own" ON public.notification_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notification_settings_own" ON public.notification_settings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_own" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- 3. Arreglar políticas administrativas
DROP POLICY IF EXISTS "backup_logs_admin_secure" ON public.backup_logs;
DROP POLICY IF EXISTS "company_data_admin_secure" ON public.company_data;
DROP POLICY IF EXISTS "system_settings_admin_secure" ON public.system_settings;
DROP POLICY IF EXISTS "quick_entries_admin_secure" ON public.quick_entries;
DROP POLICY IF EXISTS "user_invitations_admin_secure" ON public.user_invitations;

-- Crear versiones completamente seguras para tablas administrativas
-- Estas solo permitirán acceso cuando el usuario esté autenticado Y sea admin
CREATE POLICY "backup_logs_admin_only" ON public.backup_logs
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "company_data_admin_only" ON public.company_data
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "system_settings_admin_only" ON public.system_settings
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "quick_entries_admin_only" ON public.quick_entries
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "user_invitations_admin_only" ON public.user_invitations
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. Configurar función para verificar el estado final
CREATE OR REPLACE FUNCTION public.final_security_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  duplicate_policies INTEGER;
  anonymous_policies INTEGER;
  secure_policies INTEGER;
  result jsonb;
BEGIN
  -- Contar políticas duplicadas (que tengan "_secure" en el nombre)
  SELECT COUNT(*) INTO duplicate_policies
  FROM pg_policies 
  WHERE schemaname = 'public'
  AND policyname LIKE '%_secure%';

  -- Contar políticas que permiten acceso anónimo (que tengan "true" literal)
  SELECT COUNT(*) INTO anonymous_policies
  FROM pg_policies 
  WHERE schemaname = 'public'
  AND (qual LIKE '%true%' OR with_check LIKE '%true%');

  -- Contar políticas seguras (que requieren autenticación)
  SELECT COUNT(*) INTO secure_policies
  FROM pg_policies 
  WHERE schemaname = 'public'
  AND (policyname LIKE '%_auth_only' OR policyname LIKE '%_only' OR policyname LIKE '%_own');

  result := jsonb_build_object(
    'duplicate_policies', duplicate_policies,
    'anonymous_policies', anonymous_policies,
    'secure_policies', secure_policies,
    'is_fully_secure', (duplicate_policies = 0 AND anonymous_policies = 0),
    'profiles_accessible', EXISTS (SELECT 1 FROM public.profiles LIMIT 1),
    'timestamp', now()
  );
  
  RETURN result;
END;
$$;