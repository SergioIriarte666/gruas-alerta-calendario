BEGIN;

-- Coordenadas geocodificadas del origen del servicio (Fase 1 seguimiento publico)
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS origin_lat double precision,
  ADD COLUMN IF NOT EXISTS origin_lng double precision;

-- Links de seguimiento publico por servicio (sin login, acceso via Edge Function con service role)
CREATE TABLE IF NOT EXISTS public.service_tracking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  revoked_at timestamptz,
  access_count integer NOT NULL DEFAULT 0,
  last_accessed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_service_tracking_links_service_id
  ON public.service_tracking_links(service_id);

ALTER TABLE public.service_tracking_links ENABLE ROW LEVEL SECURITY;

-- Solo admin puede ver/crear/actualizar links. El acceso publico pasa exclusivamente
-- por la Edge Function service-tracking usando el service role (sin policies para anon).
DROP POLICY IF EXISTS "service_tracking_links_admin_select" ON public.service_tracking_links;
CREATE POLICY "service_tracking_links_admin_select"
  ON public.service_tracking_links
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "service_tracking_links_admin_insert" ON public.service_tracking_links;
CREATE POLICY "service_tracking_links_admin_insert"
  ON public.service_tracking_links
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "service_tracking_links_admin_update" ON public.service_tracking_links;
CREATE POLICY "service_tracking_links_admin_update"
  ON public.service_tracking_links
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT, INSERT, UPDATE ON public.service_tracking_links TO authenticated;

-- RPC: crea (o reutiliza) el link de seguimiento activo de un servicio. Solo admin.
CREATE OR REPLACE FUNCTION public.create_service_tracking_link(p_service_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_token text;
  v_token text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo los administradores pueden generar links de seguimiento' USING ERRCODE = '42501';
  END IF;

  SELECT token INTO v_existing_token
  FROM public.service_tracking_links
  WHERE service_id = p_service_id
    AND revoked_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_token IS NOT NULL THEN
    RETURN v_existing_token;
  END IF;

  LOOP
    v_token := substr(
      regexp_replace(encode(gen_random_bytes(16), 'base64'), '[^a-zA-Z0-9]', '', 'g'),
      1, 16
    );

    BEGIN
      INSERT INTO public.service_tracking_links (service_id, created_by, token)
      VALUES (p_service_id, auth.uid(), v_token);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- token colisiono, reintentar con uno nuevo
    END;
  END LOOP;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.create_service_tracking_link(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_service_tracking_link(uuid) TO authenticated;

COMMIT;
