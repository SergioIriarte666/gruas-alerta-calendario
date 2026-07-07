CREATE TABLE public.app_bundle_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  bundle_url text NOT NULL,
  checksum text,
  min_native_version text NOT NULL,
  platform text NOT NULL DEFAULT 'all' CHECK (platform IN ('all', 'ios', 'android')),
  is_active boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_bundle_versions IS
  'Bundles OTA publicados para las apps nativas Capacitor.';

CREATE INDEX idx_app_bundle_versions_platform_created_at
  ON public.app_bundle_versions(platform, created_at DESC);

CREATE UNIQUE INDEX uq_app_bundle_versions_active_platform
  ON public.app_bundle_versions(platform)
  WHERE is_active = true;

ALTER TABLE public.app_bundle_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read app bundle versions"
  ON public.app_bundle_versions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert app bundle versions"
  ON public.app_bundle_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user_safe());

CREATE POLICY "Admins can update app bundle versions"
  ON public.app_bundle_versions
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user_safe())
  WITH CHECK (public.is_admin_user_safe());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-bundles',
  'app-bundles',
  true,
  104857600,
  ARRAY['application/zip']
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.activate_app_bundle_version(p_version text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_platform text;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Only admins can activate OTA bundles';
  END IF;

  SELECT platform
  INTO target_platform
  FROM public.app_bundle_versions
  WHERE version = p_version;

  IF target_platform IS NULL THEN
    RAISE EXCEPTION 'Bundle version % not found', p_version;
  END IF;

  UPDATE public.app_bundle_versions
  SET is_active = false
  WHERE platform = target_platform
    AND is_active = true;

  UPDATE public.app_bundle_versions
  SET is_active = true
  WHERE version = p_version;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_app_bundle_version(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_app_bundle_version(text) TO authenticated;
