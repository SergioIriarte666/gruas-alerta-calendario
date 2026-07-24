BEGIN;

CREATE TABLE IF NOT EXISTS public.client_portal_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_updates boolean NOT NULL DEFAULT true,
  request_updates boolean NOT NULL DEFAULT true,
  purchase_order_alerts boolean NOT NULL DEFAULT true,
  invoice_alerts boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  portal_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_portal_preferences_channel_check
    CHECK (email_enabled OR portal_enabled)
);

COMMENT ON TABLE public.client_portal_preferences IS
  'Preferencias individuales de notificación para usuarios del Portal Clientes.';

ALTER TABLE public.client_portal_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_portal_preferences_select_own"
  ON public.client_portal_preferences;
CREATE POLICY "client_portal_preferences_select_own"
  ON public.client_portal_preferences
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "client_portal_preferences_insert_own"
  ON public.client_portal_preferences;
CREATE POLICY "client_portal_preferences_insert_own"
  ON public.client_portal_preferences
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_client_user_safe()
  );

DROP POLICY IF EXISTS "client_portal_preferences_update_own"
  ON public.client_portal_preferences;
CREATE POLICY "client_portal_preferences_update_own"
  ON public.client_portal_preferences
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_client_user_safe()
  );

DROP POLICY IF EXISTS "client_portal_preferences_delete_own"
  ON public.client_portal_preferences;
CREATE POLICY "client_portal_preferences_delete_own"
  ON public.client_portal_preferences
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_client_portal_preferences_updated_at
  ON public.client_portal_preferences;
CREATE TRIGGER update_client_portal_preferences_updated_at
  BEFORE UPDATE ON public.client_portal_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sync_profile_email_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles
    SET email = NEW.email,
        updated_at = now()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_email_from_auth();

REVOKE ALL ON FUNCTION public.sync_profile_email_from_auth() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_profile_email_from_auth() FROM anon;
REVOKE ALL ON FUNCTION public.sync_profile_email_from_auth() FROM authenticated;

COMMIT;
