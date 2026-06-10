-- Fix Supabase authentication and security warnings definitively

-- 1. Update all RLS policies to remove anonymous access and be more secure
-- First, drop all existing policies that allow anonymous access

-- Drop profiles policies and recreate properly
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON public.profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Create secure profiles policies that require authentication
CREATE POLICY "profiles_authenticated_users_own_read" ON public.profiles
  FOR SELECT USING (auth.uid() = id AND auth.role() = 'authenticated');

CREATE POLICY "profiles_authenticated_users_own_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id AND auth.role() = 'authenticated');

CREATE POLICY "profiles_authenticated_admins_all_read" ON public.profiles
  FOR SELECT USING (
    auth.role() = 'authenticated' AND 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "profiles_authenticated_admins_all_update" ON public.profiles
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "profiles_authenticated_insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id AND auth.role() = 'authenticated');

-- 2. Fix function search_path warnings by updating key functions
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verificar si ya existe un perfil para este usuario
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RAISE NOTICE 'Profile already exists for user %', NEW.id;
    RETURN NEW;
  END IF;

  -- Verificar si ya existe un perfil con este email
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = NEW.email) THEN
    RAISE NOTICE 'Profile with email % already exists', NEW.email;
    RETURN NEW;
  END IF;

  -- Insertar nuevo perfil solo si no existe
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'viewer'
  );
  
  RETURN NEW;
END;
$$;

-- 3. Enable proper authentication settings to avoid connection issues
-- Create a function to check auth health
CREATE OR REPLACE FUNCTION public.check_auth_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  auth_user_count INTEGER;
  profile_count INTEGER;
  result jsonb;
BEGIN
  -- Count authenticated users
  SELECT COUNT(*) INTO profile_count FROM public.profiles;
  
  result := jsonb_build_object(
    'profiles_count', profile_count,
    'rls_enabled', (SELECT relrowsecurity FROM pg_class WHERE relname = 'profiles'),
    'policies_count', (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'profiles'),
    'timestamp', now()
  );
  
  RETURN result;
END;
$$;