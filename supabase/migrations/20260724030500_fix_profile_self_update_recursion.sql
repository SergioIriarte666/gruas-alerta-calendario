BEGIN;

CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.id
     AND (
       NEW.id IS DISTINCT FROM OLD.id
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.client_id IS DISTINCT FROM OLD.client_id
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
     ) THEN
    RAISE EXCEPTION 'No puedes modificar los permisos ni la asignación de tu cuenta'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_profile_sensitive_fields() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_profile_sensitive_fields() FROM anon;
REVOKE ALL ON FUNCTION public.protect_profile_sensitive_fields() FROM authenticated;

DROP TRIGGER IF EXISTS protect_profile_sensitive_fields_before_update
  ON public.profiles;
CREATE TRIGGER protect_profile_sensitive_fields_before_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_sensitive_fields();

DROP POLICY IF EXISTS "profiles_update_own_restricted" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

COMMIT;
