BEGIN;

-- Extrae la logica de generar/reutilizar token de create_service_tracking_link
-- a una funcion compartida SIN el check de admin, para que send-whatsapp-tracking
-- (service role, sin auth.uid()) pueda generar/reutilizar el token del envio
-- automatico sin duplicar la logica ni exponer un bypass del check de admin
-- a usuarios autenticados (solo se otorga EXECUTE a service_role).
CREATE OR REPLACE FUNCTION public.get_or_create_tracking_token(
  p_service_id uuid,
  p_created_by uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_existing_token text;
  v_token text;
BEGIN
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
      VALUES (p_service_id, p_created_by, v_token);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- token colisiono, reintentar con uno nuevo
    END;
  END LOOP;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_tracking_token(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_or_create_tracking_token(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_or_create_tracking_token(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_tracking_token(uuid, uuid) TO service_role;

-- create_service_tracking_link conserva firma y search_path intactos: solo
-- delega la generacion del token a la funcion compartida de arriba.
CREATE OR REPLACE FUNCTION public.create_service_tracking_link(p_service_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo los administradores pueden generar links de seguimiento' USING ERRCODE = '42501';
  END IF;

  RETURN public.get_or_create_tracking_token(p_service_id, auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_service_tracking_link(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_service_tracking_link(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_service_tracking_link(uuid) TO authenticated;

COMMIT;
