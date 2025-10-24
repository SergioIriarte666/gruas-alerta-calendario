-- ============================================================
-- COMPREHENSIVE SECURITY FIX - ALL 4 CRITICAL VULNERABILITIES
-- ============================================================

-- 1. CREATE USER_ROLES TABLE (Privilege Escalation Fix)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz DEFAULT now()
);

-- Migrate existing roles from profiles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Only admins can manage roles
CREATE POLICY "admin_only_role_management"
ON public.user_roles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Users can view their own role
CREATE POLICY "users_view_own_role"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

-- 2. SECURITY DEFINER FUNCTIONS (Schema Hijacking Fix)
-- ============================================================

-- Drop and recreate has_role function
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

CREATE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Drop and recreate get_user_role function
DROP FUNCTION IF EXISTS public.get_user_role_from_table(uuid);

CREATE FUNCTION public.get_user_role_from_table(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Update role check functions to use user_roles table
CREATE OR REPLACE FUNCTION public.is_admin_user_safe()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_operator_user_safe()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'operator'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_client_user_safe()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'client'
  )
$$;

-- 3. FIX PROFILES RLS POLICIES (Privilege Escalation Fix)
-- ============================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "profiles_self_access" ON public.profiles;

-- Create restrictive policies
CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "profiles_update_own_restricted"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND
  role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- 4. FIX CLIENT DATA EXPOSURE (Data Exposure Fix)
-- ============================================================

-- Drop the overly permissive operator policy
DROP POLICY IF EXISTS "clients_operator_read_only" ON public.clients;

-- Create restricted policy - operators only see assigned clients
CREATE POLICY "clients_operator_assigned_only"
ON public.clients FOR SELECT
USING (
  public.is_operator_user_safe() AND
  EXISTS (
    SELECT 1 
    FROM public.services s
    JOIN public.service_resources sr ON s.id = sr.service_id
    WHERE s.client_id = clients.id
    AND sr.operator_id = (
      SELECT id FROM public.operators WHERE user_id = auth.uid()
    )
  )
);

-- 5. FIX AUDIT LOG (Audit Tampering Fix)
-- ============================================================

-- Drop the permissive policy
DROP POLICY IF EXISTS "audit_log_system_insert" ON public.audit_log;

-- Create secure logging function
CREATE OR REPLACE FUNCTION public.log_audit_entry(
  p_table_name text,
  p_operation text,
  p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (
    user_id, table_name, operation, old_data, new_data
  ) VALUES (
    auth.uid(), p_table_name, p_operation, p_old_data, p_new_data
  );
END;
$$;

-- Block direct inserts to audit_log
CREATE POLICY "audit_log_no_direct_insert"
ON public.audit_log FOR INSERT
WITH CHECK (false);

-- 6. UPDATE USER ROLE MANAGEMENT FUNCTION
-- ============================================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.update_user_role(uuid, app_role);

-- Recreate with correct implementation
CREATE FUNCTION public.update_user_role(
  target_user_id uuid,
  new_role app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Only admins can update user roles';
  END IF;

  -- Update in user_roles table
  INSERT INTO public.user_roles (user_id, role, assigned_by)
  VALUES (target_user_id, new_role, auth.uid())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    role = EXCLUDED.role,
    assigned_by = EXCLUDED.assigned_by,
    assigned_at = now();
    
  -- Update profiles for backward compatibility
  UPDATE public.profiles 
  SET role = new_role 
  WHERE id = target_user_id;
END;
$$;

-- 7. SYNC TRIGGER FOR BACKWARD COMPATIBILITY
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_role_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET role = NEW.role WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_role_to_profile_trigger ON public.user_roles;

CREATE TRIGGER sync_role_to_profile_trigger
AFTER INSERT OR UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.sync_role_to_profile();

-- 8. PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- 9. GRANT PERMISSIONS
-- ============================================================

GRANT SELECT ON public.user_roles TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role_from_table(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_entry(text, text, jsonb, jsonb) TO authenticated;