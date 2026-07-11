BEGIN;

-- Bug: create_service_tracking_link fallaba con 42883
-- ("function gen_random_bytes(integer) does not exist"). pgcrypto esta
-- instalado en el schema extensions en este proyecto, pero la funcion
-- tenia SET search_path = public, pg_temp (sin extensions), asi que
-- gen_random_bytes no resolvia. Se agrega extensions al search_path.
CREATE OR REPLACE FUNCTION public.create_service_tracking_link(p_service_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
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

REVOKE EXECUTE ON FUNCTION public.create_service_tracking_link(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_service_tracking_link(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_service_tracking_link(uuid) TO authenticated;

COMMIT;
