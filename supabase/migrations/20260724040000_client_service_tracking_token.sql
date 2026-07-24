BEGIN;

-- Permite que un usuario CLIENTE del portal obtenga (o cree) el token de
-- seguimiento en vivo SOLO de sus propios servicios, para poder enlazar al
-- tracker público /track/:token desde el hero del servicio en curso.
--
-- get_or_create_tracking_token está revocada para authenticated (solo
-- service_role) y create_service_tracking_link exige admin, así que el
-- cliente no tenía forma de obtener el token. Esta función es el único punto
-- de entrada para clientes y está estrictamente acotada por propiedad: mismo
-- predicado que la policy services_client_own_data
-- (is_client_user_safe() AND client_id = get_user_client_id_safe()).
CREATE OR REPLACE FUNCTION public.get_client_service_tracking_token(
  p_service_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_client_id uuid;
  v_service_client_id uuid;
BEGIN
  -- Solo usuarios cliente con client_id resuelto.
  IF NOT public.is_client_user_safe() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  v_client_id := public.get_user_client_id_safe();
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  -- El servicio debe pertenecer al cliente del usuario. No revelamos si el
  -- servicio existe: mismo mensaje para "no existe" y "no es tuyo".
  SELECT client_id INTO v_service_client_id
  FROM public.services
  WHERE id = p_service_id;

  IF v_service_client_id IS NULL OR v_service_client_id <> v_client_id THEN
    RAISE EXCEPTION 'Servicio no encontrado' USING ERRCODE = '42501';
  END IF;

  -- Delega en la función compartida (reutiliza token vigente o crea uno).
  RETURN public.get_or_create_tracking_token(p_service_id, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.get_client_service_tracking_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_client_service_tracking_token(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_client_service_tracking_token(uuid) TO authenticated;

COMMIT;
