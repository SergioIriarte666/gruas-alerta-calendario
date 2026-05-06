
-- 1. Backfill user_roles from profiles for any user not yet present
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, p.role
FROM public.profiles p
WHERE p.role IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id)
ON CONFLICT DO NOTHING;

-- 2. Rewrite role-check helpers to use user_roles exclusively
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() ORDER BY role LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_role_safe()
RETURNS app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() ORDER BY role LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() ORDER BY role LIMIT 1),
    'viewer'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid DEFAULT auth.uid())
RETURNS app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_roles WHERE user_roles.user_id = get_user_role.user_id ORDER BY role LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_client_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client');
$$;

-- 3. Replace policies that referenced profiles.role with has_role() against user_roles
DROP POLICY IF EXISTS backup_logs_admin_only ON public.backup_logs;
CREATE POLICY backup_logs_admin_only ON public.backup_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS company_data_admin_only ON public.company_data;
CREATE POLICY company_data_admin_only ON public.company_data
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS system_settings_admin_only ON public.system_settings;
CREATE POLICY system_settings_admin_only ON public.system_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS quick_entries_admin_only ON public.quick_entries;
CREATE POLICY quick_entries_admin_only ON public.quick_entries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS user_invitations_admin_only ON public.user_invitations;
CREATE POLICY user_invitations_admin_only ON public.user_invitations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS service_update_error_logs_admin_only ON public.service_update_error_logs;
CREATE POLICY service_update_error_logs_admin_only ON public.service_update_error_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS audit_log_user_select ON public.audit_log;
CREATE POLICY audit_log_user_select ON public.audit_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS audit_log_admin_select ON public.audit_log;
CREATE POLICY audit_log_admin_select ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage all permissions" ON public.user_module_permissions;
CREATE POLICY "Admins can manage all permissions" ON public.user_module_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS services_viewer_read_access ON public.services;
CREATE POLICY services_viewer_read_access ON public.services
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'));

-- 4. Harden profiles update policy: forbid changing role from the client at all
DROP POLICY IF EXISTS profiles_update_own_restricted ON public.profiles;
CREATE POLICY profiles_update_own_restricted ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND is_active IS NOT DISTINCT FROM (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid())
  );

-- 5. Storage: allow users to delete their own files in quick-entry-photos
DROP POLICY IF EXISTS "quick_entry_photos_user_delete" ON storage.objects;
CREATE POLICY "quick_entry_photos_user_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'quick-entry-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
